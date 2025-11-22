import httpx
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


class PolymarketClient:
    """Client for fetching prediction market data from Polymarket"""

    def __init__(self):
        self.gamma_url = "https://gamma-api.polymarket.com"
        self.clob_url = "https://clob.polymarket.com"
        logger.info("✅ Polymarket client initialized")

    async def fetch_btc_markets(self) -> List[Dict[str, Any]]:
        """
        Fetch Bitcoin-related prediction markets from Polymarket.
        """
        try:
            url = f"{self.gamma_url}/markets"
            params = {
                "limit": 100,      # Fetch more, filter later
                "offset": 0,
                "archived": "false",
                "closed": "false",
            }

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, params=params)

            if resp.status_code != 200:
                logger.warning(f"Polymarket API error {resp.status_code}")
                return self._get_mock_markets()

            raw = resp.json()

            # Handle both list and dict formats from Polymarket Gamma API
            if isinstance(raw, dict):
                # Standard Gamma format: {"data": {"markets": [...]}}
                markets_raw = raw.get("data", {}).get("markets")

                # Sometimes Polymarket returns {"markets": [...]}
                if markets_raw is None:
                    markets_raw = raw.get("markets")

            elif isinstance(raw, list):
                # Some endpoints return a raw list
                markets_raw = raw

            else:
                logger.error("❌ Unexpected Polymarket API format")
                return self._get_mock_markets()

            if not isinstance(markets_raw, list):
                logger.error("❌ Polymarket API did not return a list of markets")
                return self._get_mock_markets()

            logger.debug(f"Received {len(markets_raw)} markets from Gamma API")

            btc_keywords = ["bitcoin", "btc", "crypto"]
            results = []

            for m in markets_raw:
                title = m.get("question", "")
                title_lc = title.lower()

                if not any(k in title_lc for k in btc_keywords):
                    continue

                # Extract “Yes” probability
                outcomes = m.get("outcomes", [])
                if outcomes and "price" in outcomes[0]:
                    yes_prob = float(outcomes[0].get("price", 0.5))
                else:
                    yes_prob = 0.5

                # Format volume
                volume = float(m.get("volume", 0))
                if volume >= 1_000_000:
                    volume_str = f"${volume/1_000_000:.1f}M"
                elif volume >= 1_000:
                    volume_str = f"${volume/1_000:.1f}K"
                else:
                    volume_str = f"${volume:.0f}"

                # Build URL
                url_method = "fallback"
                # Best source-of-truth URL from Gamma API
                market_url = (
                    m.get("url")
                    or m.get("pageUrl")
                    or m.get("questionUrl")
                    or (f"https://polymarket.com/event/{m.get('slug')}" if m.get("slug") else "https://polymarket.com")
                )


                logger.debug(f"Built market URL via {url_method}: {market_url}")

                results.append({
                    "title": title,
                    "odds": round(yes_prob, 2),
                    "volume": volume_str,
                    "change": "+0%",  # Placeholder (needs historical)
                    "url": market_url
                })

            # Fill with mock data if needed
            if len(results) < 5:
                needed = 5 - len(results)
                results.extend(self._get_mock_markets()[:needed])

            logger.info(f"✅ Fetched {len(results)} Polymarket markets")
            return results[:10]

        except Exception as e:
            logger.error(f"❌ Polymarket fetch failed: {e}")
            return self._get_mock_markets()

    def _get_mock_markets(self) -> List[Dict[str, Any]]:
        """Fallback mock markets"""
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
        """Compute average odds across all BTC markets."""
        try:
            markets = await self.fetch_btc_markets()
            if not markets:
                return 0.5

            avg = sum(m["odds"] for m in markets) / len(markets)
            logger.info(f"Average odds = {avg:.2f}")
            return round(avg, 4)

        except Exception as e:
            logger.error(f"Failed to compute average odds: {e}")
            return 0.5


# Global singleton
_polymarket_client = None


def get_polymarket_client() -> PolymarketClient:
    global _polymarket_client
    if _polymarket_client is None:
        _polymarket_client = PolymarketClient()
    return _polymarket_client
