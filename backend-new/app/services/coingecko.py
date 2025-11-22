"""
CoinGecko API client
Fetches BTC price, 24h change, volume
"""
import os
import logging
from typing import Dict, Any, Optional
import aiohttp

logger = logging.getLogger(__name__)


class CoinGeckoClient:
    """Client for fetching cryptocurrency price data from CoinGecko"""
    
    def __init__(self):
        self.base_url = "https://api.coingecko.com/api/v3"
        self.api_key = os.getenv("COINGECKO_API_KEY")  # Optional, for higher rate limits
        self._last_known_data: Optional[Dict[str, Any]] = None
        logger.info("✅ CoinGecko client initialized")
    
    async def fetch_btc_data(self) -> Dict[str, Any]:
        """
        Fetch Bitcoin price data from CoinGecko.
        
        Returns:
            {
                "btc_price": float,
                "price_change_24h": float (percentage),
                "volume_24h": str (formatted),
                "price_high_24h": float,
                "price_low_24h": float
            }
        """
        try:
            url = f"{self.base_url}/simple/price"
            params = {
                "ids": "bitcoin",
                "vs_currencies": "usd",
                "include_24hr_vol": "true",
                "include_24hr_change": "true",
                "include_last_updated_at": "true"
            }
            
            # Add API key if available
            headers = {}
            if self.api_key:
                headers["x-cg-pro-api-key"] = self.api_key
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status != 200:
                        raise Exception(f"CoinGecko API returned status {response.status}")
                    
                    data = await response.json()
            
            # Also fetch additional market data
            market_url = f"{self.base_url}/coins/bitcoin/market_chart"
            market_params = {
                "vs_currency": "usd",
                "days": "1",
                "interval": "hourly"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(market_url, params=market_params, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    market_data = await response.json() if response.status == 200 else {}
            
            # Extract data
            btc_data = data.get("bitcoin", {})
            current_price = btc_data.get("usd", 0)
            price_change_24h = btc_data.get("usd_24h_change", 0)
            volume_24h = btc_data.get("usd_24h_vol", 0)
            
            # Calculate high/low from market chart data
            prices = [p[1] for p in market_data.get("prices", [])] if market_data else [current_price]
            price_high_24h = max(prices) if prices else current_price
            price_low_24h = min(prices) if prices else current_price
            
            # Format volume
            if volume_24h >= 1_000_000_000:
                volume_str = f"${volume_24h / 1_000_000_000:.1f}B"
            elif volume_24h >= 1_000_000:
                volume_str = f"${volume_24h / 1_000_000:.1f}M"
            else:
                volume_str = f"${volume_24h:,.0f}"
            
            result = {
                "btc_price": round(current_price, 2),
                "price_change_24h": round(price_change_24h, 2),
                "volume_24h": volume_str,
                "price_high_24h": round(price_high_24h, 2),
                "price_low_24h": round(price_low_24h, 2)
            }
            
            # Cache for fallback
            self._last_known_data = result
            
            logger.info(f"✅ Fetched BTC data: ${current_price:,.2f} ({price_change_24h:+.2f}%)")
            return result
            
        except Exception as e:
            logger.error(f"❌ CoinGecko fetch failed: {e}")
            # Return last known data or default
            if self._last_known_data:
                logger.warning("⚠️  Using cached BTC data")
                return self._last_known_data
            else:
                logger.warning("⚠️  Using default BTC data")
                return {
                    "btc_price": 96500.00,
                    "price_change_24h": 0.0,
                    "volume_24h": "$0",
                    "price_high_24h": 96500.00,
                    "price_low_24h": 96500.00
                }
    
    async def fetch_watchlist_prices(self, tickers: list[str]) -> Dict[str, Dict[str, Any]]:
        """
        Fetch prices for multiple cryptocurrencies.
        
        Args:
            tickers: List of tickers like ["ETH-USD", "SOL-USD", "AVAX-USD"]
            
        Returns:
            {
                "ETH-USD": {"current_price": 3500.00, "price_change_24h": 2.5},
                "SOL-USD": {"current_price": 105.00, "price_change_24h": -1.2},
                ...
            }
        """
        try:
            # Convert tickers to CoinGecko IDs
            ticker_to_id = {
                "ETH-USD": "ethereum",
                "SOL-USD": "solana",
                "AVAX-USD": "avalanche-2",
                "MATIC-USD": "matic-network"
            }
            
            coin_ids = [ticker_to_id.get(t, t.lower().replace("-usd", "")) for t in tickers]
            
            url = f"{self.base_url}/simple/price"
            params = {
                "ids": ",".join(coin_ids),
                "vs_currencies": "usd",
                "include_24hr_change": "true"
            }
            
            headers = {}
            if self.api_key:
                headers["x-cg-pro-api-key"] = self.api_key
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status != 200:
                        raise Exception(f"CoinGecko API returned status {response.status}")
                    
                    data = await response.json()
            
            # Convert back to ticker format
            result = {}
            for ticker, coin_id in zip(tickers, coin_ids):
                coin_data = data.get(coin_id, {})
                result[ticker] = {
                    "current_price": round(coin_data.get("usd", 0), 2),
                    "price_change_24h": round(coin_data.get("usd_24h_change", 0), 2)
                }
            
            logger.info(f"✅ Fetched watchlist data for {len(result)} coins")
            return result
            
        except Exception as e:
            logger.error(f"❌ Watchlist fetch failed: {e}")
            # Return defaults
            return {ticker: {"current_price": 0, "price_change_24h": 0} for ticker in tickers}


# Global singleton
_coingecko_client: Optional[CoinGeckoClient] = None


def get_coingecko_client() -> CoinGeckoClient:
    """Get or create the CoinGecko client singleton."""
    global _coingecko_client
    if _coingecko_client is None:
        _coingecko_client = CoinGeckoClient()
    return _coingecko_client
