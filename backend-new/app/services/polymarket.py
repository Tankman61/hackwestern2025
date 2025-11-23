import httpx
import json
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
            # Try the /markets endpoint first (more direct, has prices)
            markets_url = f"{self.gamma_url}/markets"
            markets_params = {
                "limit": 100,
                "offset": 0,
                "active": True,
                "closed": False
            }
            
            logger.info(f"Fetching markets from {markets_url}")
            
            async with httpx.AsyncClient(timeout=15.0) as client:
                markets_resp = await client.get(markets_url, params=markets_params)
            
            markets_data = None
            if markets_resp.status_code == 200:
                markets_data = markets_resp.json()
                logger.info(f"✅ Markets API returned {len(markets_data) if isinstance(markets_data, list) else 'dict'} items")
            
            # Also try the /events endpoint for event metadata (URLs)
            url = f"{self.gamma_url}/events"
            params = {
                "limit": 1000,
                "offset": 0,
                "active": True,
                "closed": False,
                "archived": False
            }

            logger.info(f"Fetching events from {url}")

            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url, params=params)

            logger.info(f"Polymarket Events API status: {resp.status_code}")

            if resp.status_code != 200:
                logger.warning(f"Polymarket Events API error {resp.status_code}")
                if markets_data:
                    # Use markets data if events fail
                    response_data = markets_data
                else:
                    logger.warning("Both APIs failed, using mock data")
                    return self._get_mock_markets()[:limit]
            else:
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
            
            # Create a map of market prices from markets endpoint if available
            market_prices = {}
            if markets_data and isinstance(markets_data, list):
                for market in markets_data:
                    market_id = market.get("id") or market.get("marketId")
                    if market_id:
                        # Extract price from various possible fields
                        price = None
                        if "outcomePrices" in market and isinstance(market["outcomePrices"], list) and len(market["outcomePrices"]) > 0:
                            price = float(market["outcomePrices"][0])
                        elif "tokens" in market and isinstance(market["tokens"], list) and len(market["tokens"]) > 0:
                            price = float(market["tokens"][0].get("price", market["tokens"][0].get("lastPrice", 0.5)))
                        elif "price" in market:
                            price = float(market["price"])
                        
                        if price is not None:
                            market_prices[market_id] = price
                            # Also map by question/title for matching
                            question = market.get("question") or market.get("title")
                            if question:
                                market_prices[question] = price
            
            if not events_list:
                logger.error(f"No events/markets found in response")
                return self._get_mock_markets()[:limit]
            
            logger.info(f"Processing {len(events_list)} events/markets, {len(market_prices)} market prices available")

            btc_keywords = ["bitcoin", "btc", "crypto", "eth", "ethereum"]
            results = []
            seen_events = set()  # Track which events we've already added
            
            # Debug: Log first item structure and check for direct URL field
            if events_list and len(events_list) > 0:
                logger.info(f"📋 Sample event structure:")
                sample = events_list[0]
                logger.info(f"   ticker: '{sample.get('ticker', 'N/A')}'")  
                logger.info(f"   slug: '{sample.get('slug', 'N/A')}'")
                logger.info(f"   id: '{sample.get('id', 'N/A')}'")
                logger.info(f"   title: '{sample.get('title', 'N/A')}'")
                
                # Check for direct URL fields
                url_fields = [k for k in sample.keys() if 'url' in k.lower() or 'link' in k.lower()]
                if url_fields:
                    logger.info(f"   Found URL fields: {url_fields}")
                    for field in url_fields:
                        logger.info(f"      {field}: {sample.get(field, 'N/A')}")
                
                # Check markets for URL fields too
                if sample.get('markets') and len(sample['markets']) > 0:
                    market_sample = sample['markets'][0]
                    market_url_fields = [k for k in market_sample.keys() if 'url' in k.lower() or 'link' in k.lower()]
                    if market_url_fields:
                        logger.info(f"   Market URL fields: {market_url_fields}")
                        for field in market_url_fields:
                            logger.info(f"      {field}: {market_sample.get(field, 'N/A')}")
            
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

                    # Extract "Yes" probability - try multiple methods
                    yes_prob = None
                    
                    # Method 0: Check market_prices map first (from markets endpoint)
                    market_id = m.get("id") or m.get("marketId")
                    if market_id and market_id in market_prices:
                        yes_prob = market_prices[market_id]
                        logger.debug(f"✅ Found probability via market_prices map: {yes_prob}")
                    elif title in market_prices:
                        yes_prob = market_prices[title]
                        logger.debug(f"✅ Found probability via market_prices map (by title): {yes_prob}")
                    
                    # Method 1: outcomePrices - can be a list OR a JSON string
                    if yes_prob is None and "outcomePrices" in m:
                        outcome_prices = m["outcomePrices"]
                        # Parse if it's a JSON string
                        if isinstance(outcome_prices, str):
                            try:
                                outcome_prices = json.loads(outcome_prices)
                            except Exception as e:
                                logger.debug(f"Failed to parse outcomePrices JSON: {e}")
                                pass
                        # Extract first price if it's a list
                        if isinstance(outcome_prices, list) and len(outcome_prices) > 0:
                            yes_prob = float(outcome_prices[0])
                            logger.debug(f"✅ Found probability via outcomePrices: {yes_prob}")
                    # Method 2: outcomes array
                    elif yes_prob is None and "outcomes" in m and isinstance(m["outcomes"], list) and len(m["outcomes"]) > 0:
                        # Look for "Yes" outcome or first outcome
                        for outcome in m["outcomes"]:
                            if outcome.get("outcome", "").upper() == "YES" or outcome.get("title", "").upper() == "YES":
                                yes_prob = float(outcome.get("price", outcome.get("lastPrice", 0.5)))
                                logger.debug(f"✅ Found probability via outcomes[YES]: {yes_prob}")
                                break
                        if yes_prob is None:
                            yes_prob = float(m["outcomes"][0].get("price", m["outcomes"][0].get("lastPrice", 0.5)))
                            logger.debug(f"✅ Found probability via outcomes[0]: {yes_prob}")
                    # Method 3: tokens array
                    elif yes_prob is None and "tokens" in m and isinstance(m["tokens"], list) and len(m["tokens"]) > 0:
                        # Look for "Yes" token or first token
                        for token in m["tokens"]:
                            if token.get("outcome", "").upper() == "YES" or token.get("side", "").upper() == "YES":
                                yes_prob = float(token.get("price", token.get("lastPrice", 0.5)))
                                logger.debug(f"✅ Found probability via tokens[YES]: {yes_prob}")
                                break
                        if yes_prob is None:
                            token_data = m["tokens"][0]
                            yes_prob = float(token_data.get("price", token_data.get("lastPrice", 0.5)))
                            logger.debug(f"✅ Found probability via tokens[0]: {yes_prob}")
                    # Method 4: direct price field
                    elif yes_prob is None and "price" in m:
                        yes_prob = float(m["price"])
                        logger.debug(f"✅ Found probability via price field: {yes_prob}")
                    # Method 5: Check parent event for market data
                    elif yes_prob is None and "markets" in item and isinstance(item["markets"], list):
                        # Try to get price from nested markets
                        for nested_market in item["markets"]:
                            if nested_market.get("question") == title or nested_market.get("title") == title:
                                if "outcomePrices" in nested_market:
                                    # Parse outcomePrices (could be JSON string or list)
                                    outcome_prices = nested_market["outcomePrices"]
                                    if isinstance(outcome_prices, str):
                                        try:
                                            outcome_prices = json.loads(outcome_prices)
                                        except Exception as e:
                                            logger.debug(f"Failed to parse nested outcomePrices JSON: {e}")
                                            pass
                                    if isinstance(outcome_prices, list) and len(outcome_prices) > 0:
                                        yes_prob = float(outcome_prices[0])
                                        logger.debug(f"✅ Found probability via nested market: {yes_prob}")
                                        break
                    
                    # If still no probability found, log warning and use 0.5 as fallback
                    if yes_prob is None:
                        logger.warning(f"⚠️  Could not extract probability for '{title[:50]}'. Market ID: {market_id}, Available keys: {list(m.keys())[:10]}")
                        yes_prob = 0.5

                    # Format volume
                    volume = float(m.get("volume", m.get("volumeNum", m.get("volume24hr", item.get("volume", 0)))))
                    if volume >= 1_000_000:
                        volume_str = f"${volume/1_000_000:.1f}M"
                    elif volume >= 1_000:
                        volume_str = f"${volume/1_000:.1f}K"
                    else:
                        volume_str = f"${volume:.0f}"

                    # Build URL - Use search URLs (reliable and always work!)
                    # Direct event URLs (numeric IDs, slugs, etc.) often 404
                    # Search URLs will find the market even if exact URL format is wrong
                    market_url = None
                    
                    # Method 1: Check for direct URL field (if API provides it - rare)
                    if item.get("url"):
                        market_url = item["url"]
                    elif m.get("url"):
                        market_url = m["url"]
                    # Method 2: Use search URL (most reliable - always works!)
                    else:
                        # Create search query from market title/question
                        search_query = title.replace("?", "").replace("$", "").replace(",", "")
                        # Clean up for URL encoding
                        search_query = search_query.replace(" ", "+").replace("&", "and")[:80]
                        market_url = f"https://polymarket.com/search?q={search_query}"
                        logger.debug(f"✅ Using search URL for: {title[:50]}")
                    
                    # Final fallback
                    if not market_url:
                        market_url = "https://polymarket.com"
                        logger.warning(f"⚠️  No URL available for: {title[:50]}")

                    # Calculate change percentage (will be calculated in ingest worker based on previous data)
                    # For now, set to "+0%" - will be updated by comparing with previous feed_items
                    results.append({
                        "title": title[:50],
                        "odds": round(yes_prob, 2),
                        "volume": volume_str,
                        "change": None,  # Will be calculated in ingest worker
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
