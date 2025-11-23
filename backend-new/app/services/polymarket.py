import httpx
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


class PolymarketClient:
    """Client for fetching prediction market data from Polymarket"""

    def __init__(self):
        self.gamma_url = "https://gamma-api.polymarket.com"
        logger.info("✅ Polymarket client initialized")

    async def fetch_btc_markets(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Fetch Bitcoin-related prediction markets with real URLs."""
        try:
            # Try the /events endpoint first (returns events with nested markets)
            # This gives us the event slug which is needed for proper URLs
            url = f"{self.gamma_url}/events"
            params = {
                "limit": 1000,
                "offset": 0,
                "active": True,
                "closed": False,
                "archived": False
            }

            logger.info(f"Fetching from {url} with params {params}")

            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url, params=params)

            logger.info(f"Polymarket API status: {resp.status_code}")

            if resp.status_code != 200:
                logger.warning(f"Polymarket API error {resp.status_code}, using mock data")
                return self._get_mock_markets()[:limit]

            # Parse response - could be events or markets
            response_data = resp.json()
            
            # Log structure to debug
            if response_data:
                response_type = type(response_data)
                logger.info(f"Response type: {response_type}")
                
                if isinstance(response_data, list) and len(response_data) > 0:
                    logger.info(f"First item keys: {list(response_data[0].keys())}")
                elif isinstance(response_data, dict):
                    logger.info(f"Response keys: {list(response_data.keys())}")
            else:
                logger.warning("Empty response from Polymarket API")
                return self._get_mock_markets()[:limit]

            # Extract events array
            events_list = []
            if isinstance(response_data, list):
                events_list = response_data
            elif isinstance(response_data, dict):
                # Try common wrapper keys
                events_list = response_data.get("data", response_data.get("events", response_data.get("markets", [])))
            
            if not events_list:
                logger.error(f"No events/markets found in response")
                return self._get_mock_markets()[:limit]
            
            logger.info(f"Processing {len(events_list)} events/markets")

            btc_keywords = ["bitcoin", "btc", "crypto", "eth", "ethereum"]
            results = []
            seen_events = set()  # Track which events we've already added
            
            # Debug: Log first item structure
            if events_list and len(events_list) > 0:
                logger.info(f"📋 Sample event structure:")
                sample = events_list[0]
                logger.info(f"   ticker: '{sample.get('ticker', 'N/A')}'")  
                logger.info(f"   slug: '{sample.get('slug', 'N/A')}'")
                logger.info(f"   title: '{sample.get('title', 'N/A')}'")
                logger.info(f"   URL will be: https://polymarket.com/event/{sample.get('ticker') or sample.get('slug', 'N/A')}")
            
            # Process each event/market
            for item in events_list:
                # Get the CLEAN slug from event level - prefer 'ticker' over 'slug'
                # ticker seems to be the clean URL-friendly version
                event_slug = item.get("ticker") or item.get("slug", "")
                event_title = item.get("title") or item.get("question", "")
                
                # Skip if we've already added a market from this event (avoid duplicates)
                if event_slug in seen_events:
                    logger.debug(f"Skipping duplicate event: {event_slug}")
                    continue
                
                # Check if it's an event with markets inside
                markets_in_event = item.get("markets", [])
                
                # If no nested markets, treat the item itself as a market
                if not markets_in_event:
                    markets_in_event = [item]
                
                # For events with multiple markets, pick the most interesting one
                # (highest volume) to avoid showing 20 variations of the same question
                if len(markets_in_event) > 1:
                    # Sort by volume and take the top one
                    markets_in_event = sorted(
                        markets_in_event,
                        key=lambda x: float(x.get("volume", x.get("volumeNum", 0))),
                        reverse=True
                    )[:1]
                    logger.debug(f"Event '{event_title}' has {len(item.get('markets', []))} markets, picking top by volume")
                
                # Process the market(s) for this event
                for m in markets_in_event:
                    # Get title/question
                    title = m.get("question") or m.get("title") or event_title or m.get("description", "")
                    
                    if not title:
                        continue
                    
                    # Check for crypto relevance
                    if not any(k in title.lower() for k in btc_keywords):
                        continue

                    # Extract "Yes" probability
                    yes_prob = 0.5
                    
                    # Method 1: outcomePrices array
                    if "outcomePrices" in m and isinstance(m["outcomePrices"], list) and len(m["outcomePrices"]) > 0:
                        yes_prob = float(m["outcomePrices"][0])
                    # Method 2: outcomes array
                    elif "outcomes" in m and isinstance(m["outcomes"], list) and len(m["outcomes"]) > 0:
                        yes_prob = float(m["outcomes"][0].get("price", 0.5))
                    # Method 3: tokens array
                    elif "tokens" in m and isinstance(m["tokens"], list) and len(m["tokens"]) > 0:
                        token_data = m["tokens"][0]
                        yes_prob = float(token_data.get("price", token_data.get("lastPrice", 0.5)))
                    # Method 4: direct price field
                    elif "price" in m:
                        yes_prob = float(m["price"])

                    # Format volume
                    volume = float(m.get("volume", m.get("volumeNum", m.get("volume24hr", item.get("volume", 0)))))
                    if volume >= 1_000_000:
                        volume_str = f"${volume/1_000_000:.1f}M"
                    elif volume >= 1_000:
                        volume_str = f"${volume/1_000:.1f}K"
                    else:
                        volume_str = f"${volume:.0f}"

                    # Build correct URL using the clean event ticker/slug
                    # Polymarket URLs are: https://polymarket.com/event/{event-ticker}
                    market_url = "https://polymarket.com"
                    
                    if event_slug:
                        # Use the parent event's ticker/slug (this is the clean one!)
                        market_url = f"https://polymarket.com/event/{event_slug}"
                        logger.debug(f"✅ URL: {market_url}")
                    else:
                        # Fallback: try to get ticker/slug from the item itself
                        fallback_slug = item.get("ticker") or item.get("slug")
                        if fallback_slug:
                            market_url = f"https://polymarket.com/event/{fallback_slug}"
                            logger.debug(f"✅ URL from item: {market_url}")
                        else:
                            logger.warning(f"⚠️  No ticker/slug for: {title[:50]}")

                    results.append({
                        "title": title[:200],
                        "odds": round(yes_prob, 2),
                        "volume": volume_str,
                        "change": "+0%",
                        "url": market_url
                    })
                    
                    # Mark this event as processed so we don't show duplicates
                    seen_events.add(event_slug)

            logger.info(f"✅ Found {len(results)} unique crypto-related events/markets")
            logger.info(f"✅ Deduplicated by showing only 1 market per event")

            # fallback if too few results
            if len(results) < 3:
                logger.warning(f"Only found {len(results)} markets, adding mock data")
                results.extend(self._get_mock_markets()[: max(0, 5 - len(results))])

            return results[:limit]

        except Exception as e:
            logger.error(f"❌ Polymarket fetch failed: {e}", exc_info=True)
            return self._get_mock_markets()[:limit]

    def _get_mock_markets(self) -> List[Dict[str, Any]]:
        return [
            {
                "title": "Bitcoin > $100k by Dec 31, 2024",
                "odds": 0.68,
                "volume": "$2.4M",
                "change": "+12%",
                "url": "https://polymarket.com/event/will-bitcoin-btc-hit-100k-by-dec-31-2024"
            },
            {
                "title": "Bitcoin ETF approval by Q1 2025",
                "odds": 0.89,
                "volume": "$5.1M",
                "change": "+5%",
                "url": "https://polymarket.com/event/will-a-bitcoin-etf-be-approved-in-2024"
            },
            {
                "title": "BTC dominance > 60% by year end",
                "odds": 0.45,
                "volume": "$1.2M",
                "change": "-3%",
                "url": "https://polymarket.com/event/will-bitcoin-dominance-exceed-60-by-eoy"
            },
            {
                "title": "Crypto market cap > $3T in 2024",
                "odds": 0.72,
                "volume": "$3.8M",
                "change": "+8%",
                "url": "https://polymarket.com/event/will-crypto-market-cap-exceed-3-trillion-in-2024"
            },
            {
                "title": "ETH/BTC ratio > 0.08 by Dec",
                "odds": 0.35,
                "volume": "$890K",
                "change": "-2%",
                "url": "https://polymarket.com/event/will-eth-btc-ratio-exceed-008-by-december"
            }
        ]

    async def get_average_odds(self) -> float:
        """Compute average odds across BTC markets."""
        try:
            markets = await self.fetch_btc_markets()
            if not markets:
                return 0.5
            avg = sum(m["odds"] for m in markets) / len(markets)
            return round(avg, 4)
        except Exception as e:
            logger.error(f"Failed to compute average odds: {e}")
            return 0.5


# singleton
_polymarket_client: PolymarketClient | None = None


def get_polymarket_client() -> PolymarketClient:
    global _polymarket_client
    if _polymarket_client is None:
        _polymarket_client = PolymarketClient()
    return _polymarket_client
