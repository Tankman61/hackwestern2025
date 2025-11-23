"""
Tool: get_market_sentiment()
Reads latest market context from /api/risk-monitor
Returns: risk_score, summary, btc_price, sentiment, technical indicators
"""
import httpx
import os
from langchain_core.tools import tool


API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")


@tool
async def get_market_sentiment() -> str:
    """
    Get current market risk score, sentiment analysis, and BTC price.

    Returns comprehensive market analysis including:
    - Risk score (0-100) and level (Low/Medium/High)
    - Bitcoin price and 24h change
    - Technical indicators (RSI, MACD)
    - AI-generated market summary

    Use this BEFORE giving any trading advice.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{API_BASE_URL}/api/risk-monitor",
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()

        # Extract key data
        risk_level = data.get("risk_level", {})
        market = data.get("market_overview", {})
        technical = data.get("technical", {})

        # Helper function for speech-friendly pricing
        def format_price_speech(price):
            if price >= 1000:
                thousands = int(price / 1000)
                remainder = price % 1000
                dollars = int(remainder)
                cents = int((remainder - dollars) * 100)
                if cents > 0:
                    return f"{thousands} thousand {dollars} dollars and {cents} cents"
                elif dollars > 0:
                    return f"{thousands} thousand {dollars} dollars"
                else:
                    return f"{thousands} thousand dollars"
            else:
                dollars = int(price)
                cents = int((price - dollars) * 100)
                if cents > 0:
                    return f"{dollars} dollars and {cents} cents"
                return f"{dollars} dollars"

        # Format response for agent (no markdown)
        btc_price = market.get('btc_price', 0)
        price_range = market.get('price_range_24h', {})
        low_price = price_range.get('low', 0)
        high_price = price_range.get('high', 0)

        result = f"""MARKET RISK: {risk_level.get('score', 0)} out of 100 ({risk_level.get('level', 'Unknown')})
SUMMARY: {risk_level.get('summary', 'No data available')}

BITCOIN PRICE: {format_price_speech(btc_price)}
24H CHANGE: {market.get('price_change_24h', 0):+.2f} percent
24H VOLUME: {market.get('volume_24h', 'unknown')}
24H RANGE: {format_price_speech(low_price)} to {format_price_speech(high_price)}

TECHNICAL INDICATORS:
RSI: {technical.get('rsi', 0):.1f}
MACD: {technical.get('macd', 0):.2f}"""

        return result.strip()

    except httpx.HTTPError as e:
        return f"ERROR: Failed to fetch market data. API might be down or database is empty. ({str(e)})"
    except Exception as e:
        return f"ERROR: Unexpected error fetching market sentiment: {str(e)}"