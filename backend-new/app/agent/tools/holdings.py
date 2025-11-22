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

        # Format portfolio info
        result = f"""
PORTFOLIO BALANCE: ${portfolio.get('balance_usd', 0):,.2f}
TOTAL VALUE: ${portfolio.get('total_value', 0):,.2f}
P&L: ${portfolio.get('pnl_total', 0):+,.2f} ({portfolio.get('pnl_percent', 0):+.2f}%)
"""

        # Add lock status if locked
        if portfolio.get('is_locked', False):
            result += f"⚠️ ACCOUNT LOCKED: {portfolio.get('lock_reason', 'Unknown reason')}\n"

        # Add positions
        if positions and len(positions) > 0:
            result += f"\nOPEN POSITIONS ({len(positions)}):\n"
            for pos in positions:
                side = pos.get('side', 'UNKNOWN')
                ticker = pos.get('ticker', 'UNKNOWN')
                amount = pos.get('amount', 0)
                entry = pos.get('entry_price', 0)
                current = pos.get('current_price', 0)
                pnl = pos.get('pnl', 0)
                pnl_pct = pos.get('pnl_percent', 0)

                result += f"- {side} {amount} {ticker} @ ${entry:,.2f} (now ${current:,.2f}) | P&L: ${pnl:+,.2f} ({pnl_pct:+.2f}%)\n"
        else:
            result += "\nNO OPEN POSITIONS\n"

        return result.strip()

    except httpx.HTTPError as e:
        return f"ERROR: Failed to fetch holdings. Trading service might be disabled or Alpaca keys missing. ({str(e)})"
    except Exception as e:
        return f"ERROR: Unexpected error fetching holdings: {str(e)}"