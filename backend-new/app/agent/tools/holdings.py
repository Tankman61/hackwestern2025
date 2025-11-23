"""
Tool: list_holdings()
Reads portfolio balance and all open positions from Alpaca
Returns: balance, total value, P&L, locked status, open positions
"""
import httpx
import os
from langchain_core.tools import tool


API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")


@tool
async def list_holdings() -> str:
    """
    Get user's portfolio balance and all open positions.

    Returns:
    - Portfolio balance (USD cash)
    - Total portfolio value
    - Overall P&L (profit/loss)
    - Account lock status
    - All open positions with entry price, current price, and P&L

    Use this to check user's current holdings before giving advice.
    """
    try:
        async with httpx.AsyncClient() as client:
            # Fetch portfolio data
            portfolio_response = await client.get(
                f"{API_BASE_URL}/api/portfolio",
                timeout=10.0
            )
            portfolio_response.raise_for_status()
            portfolio = portfolio_response.json()

            # Fetch positions
            positions_response = await client.get(
                f"{API_BASE_URL}/api/positions",
                timeout=10.0
            )
            positions_response.raise_for_status()
            positions = positions_response.json()

        # Helper function to convert numbers to speech-friendly format
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

        # Format portfolio info (no markdown)
        balance = portfolio.get('balance_usd', 0)
        total_value = portfolio.get('total_value', 0)
        pnl_total = portfolio.get('pnl_total', 0)
        pnl_percent = portfolio.get('pnl_percent', 0)

        result = f"""PORTFOLIO BALANCE: {format_price_speech(balance)}
TOTAL VALUE: {format_price_speech(total_value)}
P&L: {"up" if pnl_total >= 0 else "down"} {format_price_speech(abs(pnl_total))} ({pnl_percent:+.2f}%)"""

        # Add lock status if locked
        if portfolio.get('is_locked', False):
            result += f"\n\nWARNING ACCOUNT LOCKED: {portfolio.get('lock_reason', 'Unknown reason')}"

        # Add positions
        if positions and len(positions) > 0:
            result += f"\n\nOPEN POSITIONS ({len(positions)}):"
            for pos in positions:
                # Use correct field names from /api/positions endpoint
                side = pos.get('side', 'UNKNOWN')
                ticker = pos.get('symbol', 'UNKNOWN')
                amount = pos.get('qty', 0)
                entry = pos.get('avg_entry_price', 0)
                current = pos.get('current_price', 0)
                pnl = pos.get('live_pnl', 0)
                pnl_pct = pos.get('live_pnl_percent', 0)

                # Format entry and current price for speech
                entry_speech = format_price_speech(entry)
                current_speech = format_price_speech(current)
                pnl_speech = format_price_speech(abs(pnl))
                pnl_direction = "profit" if pnl >= 0 else "loss"

                result += f"\n- {side} {amount} {ticker} bought at {entry_speech}, now worth {current_speech}, {pnl_direction} of {pnl_speech} ({pnl_pct:+.2f}%)"
        else:
            result += "\n\nNO OPEN POSITIONS"

        return result.strip()

    except httpx.HTTPError as e:
        return f"ERROR: Failed to fetch holdings. Trading service might be disabled or Alpaca keys missing. ({str(e)})"
    except Exception as e:
        return f"ERROR: Unexpected error fetching holdings: {str(e)}"