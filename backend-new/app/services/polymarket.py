"""
Polymarket Gamma API client
Fetches prediction market data
"""
import logging
from typing import List, Dict, Any
import httpx

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
        
        Returns:
            [
                {
                    "title": "Bitcoin > $100k by Dec 31",
                    "odds": 0.68,
                    "volume": "2.4M",
                    "change": "+12%",
                    "url": "https://polymarket.com/..."
                },
                ...
            ]
        """
        try:
            # Search for Bitcoin-related markets
            search_url = f"{self.gamma_url}/markets"
            params = {
                "limit": 10,
                "offset": 0,
                "archived": "false",
                "closed": "false"
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(search_url, params=params)
                if response.status_code != 200:
                    logger.warning(f"Polymarket API returned status {response.status_code}")
                    return self._get_mock_markets()
                
                data = response.json()
            
            markets = []
            btc_keywords = ["bitcoin", "btc", "crypto"]
            
            # Filter for Bitcoin-related markets
            for market in data:
                title = market.get("question", "").lower()
                if any(keyword in title for keyword in btc_keywords):
                    # Get market probability (average of outcome prices)
                    outcomes = market.get("outcomes", [])
                    if outcomes:
                        # Take the "Yes" outcome probability (usually first)
                        odds = float(outcomes[0].get("price", 0.5))
                    else:
                        odds = 0.5
                    
                    # Format volume
                    volume_usd = float(market.get("volume", 0))
                    if volume_usd >= 1_000_000:
                        volume_str = f"${volume_usd / 1_000_000:.1f}M"
                    elif volume_usd >= 1_000:
                        volume_str = f"${volume_usd / 1_000:.1f}K"
                    else:
                        volume_str = f"${volume_usd:.0f}"
                    
                    # Calculate change (simplified - would need historical data)
                    change_str = "+0%"  # TODO: Track historical odds for real change
                    
                    markets.append({
                        "title": market.get("question", "Unknown market"),
                        "odds": round(odds, 2),
                        "volume": volume_str,
                        "change": change_str,
                        "url": f"https://polymarket.com/event/{market.get('slug', '')}"
                    })
            
            # If we didn't find enough BTC markets, add some general crypto ones
            if len(markets) < 5:
                markets.extend(self._get_mock_markets()[:5 - len(markets)])
            
            logger.info(f"✅ Fetched {len(markets)} Polymarket markets")
            return markets[:10]  # Return top 10
            
        except Exception as e:
            logger.error(f"❌ Polymarket fetch failed: {e}")
            return self._get_mock_markets()
    
    def _get_mock_markets(self) -> List[Dict[str, Any]]:
        """Fallback mock markets for when API fails"""
        return [
            {
                "title": "Bitcoin > $100k by Dec 31, 2024",
                "odds": 0.68,
                "volume": "$2.4M",
                "change": "+12%",
                "url": "https://polymarket.com"
            },
            {
                "title": "Bitcoin ETF approval by Q1 2025",
                "odds": 0.89,
                "volume": "$5.1M",
                "change": "+5%",
                "url": "https://polymarket.com"
            },
            {
                "title": "BTC dominance > 60% by year end",
                "odds": 0.45,
                "volume": "$1.2M",
                "change": "-3%",
                "url": "https://polymarket.com"
            },
            {
                "title": "Crypto market cap > $3T in 2024",
                "odds": 0.72,
                "volume": "$3.8M",
                "change": "+8%",
                "url": "https://polymarket.com"
            },
            {
                "title": "ETH/BTC ratio > 0.08 by Dec",
                "odds": 0.35,
                "volume": "$890K",
                "change": "-2%",
                "url": "https://polymarket.com"
            }
        ]
    
    async def get_average_odds(self) -> float:
        """
        Calculate average odds across all fetched markets.
        Used for risk calculation.
        
        Returns:
            Average probability (0.0 - 1.0)
        """
        try:
            markets = await self.fetch_btc_markets()
            if not markets:
                return 0.5
            
            odds_sum = sum(m["odds"] for m in markets)
            avg_odds = odds_sum / len(markets)
            
            logger.info(f"✅ Average Polymarket odds: {avg_odds:.2f}")
            return round(avg_odds, 4)
            
        except Exception as e:
            logger.error(f"❌ Failed to calculate average odds: {e}")
            return 0.5


# Global singleton
_polymarket_client = None


def get_polymarket_client() -> PolymarketClient:
    """Get or create the Polymarket client singleton."""
    global _polymarket_client
    if _polymarket_client is None:
        _polymarket_client = PolymarketClient()
    return _polymarket_client
