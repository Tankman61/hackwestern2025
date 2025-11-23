"""
Tool: get_current_price()
Gets real-time BTC price from Finnhub WebSocket stream (SOURCE OF TRUTH)
"""
import httpx
import os
from langchain_core.tools import tool

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")


@tool
async def get_current_price(symbol: str = "BTC") -> str:
    """
    Get the current live price for Bitcoin or other crypto.

    Args:
        symbol: Trading symbol (default: "BTC", can also use "ETH", etc.)

    Returns:
        Current price from Finnhub's live WebSocket stream.
        This is the SOURCE OF TRUTH for market prices.

    Use this to check the current market price before making trading decisions.
    """
    try:
        # Call FastAPI server's price endpoint (works across processes)
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{API_BASE_URL}/api/prices/{symbol}",
                timeout=5.0
            )

            if response.status_code == 404:
                return f"ERROR: No live price data available for {symbol}. Finnhub WebSocket might not be connected yet, or symbol not subscribed."

            response.raise_for_status()
            data = response.json()

            price = data.get("price")
            if price is None:
                return f"ERROR: No price data in response for {symbol}"

        # Format price for speech-friendly output
        dollars = int(price)
        cents = int((price - dollars) * 100)

        # Create speech-friendly price string
        if cents > 0:
            price_speech = f"${dollars:,} and {cents} cents"
        else:
            price_speech = f"${dollars:,}"

        return f"""
LIVE PRICE: {price_speech} (${price:,.2f})
Symbol: {symbol}
Source: Finnhub WebSocket (real-time)

This is the CURRENT market price right now.
""".strip()

    except httpx.HTTPError as e:
        return f"ERROR: Failed to fetch price for {symbol} from API: {str(e)}"
    except Exception as e:
        return f"ERROR: Unexpected error fetching price for {symbol}: {str(e)}"
