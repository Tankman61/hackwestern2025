"""
Tool: execute_trade()
Initiates a trade on Alpaca paper account via /api/orders
NOTE: This tool will pause for user approval in the LangGraph flow
"""
import httpx
import os
from langchain_core.tools import tool


API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")


@tool
async def execute_trade(
    ticker: str,
    side: str,
    order_type: str,
    amount: float,
    limit_price: float = None
) -> str:
    """
    Execute a trade on the user's Alpaca paper account.

    CRITICAL: This tool will PAUSE and ask for user approval before executing.

    Args:
        ticker: Trading symbol (e.g., "BTC-USD", "ETH-USD")
        side: "BUY" or "SELL"
        order_type: "MARKET", "LIMIT", or "STOP_LOSS"
        amount: Quantity to trade (in coins, e.g., 0.5 BTC)
        limit_price: Price for LIMIT/STOP_LOSS orders (optional for MARKET)

    Examples:
        - execute_trade("BTC-USD", "BUY", "MARKET", 0.1)
        - execute_trade("BTC-USD", "SELL", "LIMIT", 0.05, 99500.00)

    Returns confirmation or error message.
    """
    try:
        # Validate inputs
        if side.upper() not in ["BUY", "SELL"]:
            return f"ERROR: Invalid side '{side}'. Must be BUY or SELL."

        if order_type.upper() not in ["MARKET", "LIMIT", "STOP_LOSS"]:
            return f"ERROR: Invalid order_type '{order_type}'. Must be MARKET, LIMIT, or STOP_LOSS."

        if amount <= 0:
            return f"ERROR: Amount must be positive (got {amount})."

        if order_type.upper() in ["LIMIT", "STOP_LOSS"] and limit_price is None:
            return f"ERROR: {order_type} orders require limit_price."

        # Prepare order payload
        payload = {
            "ticker": ticker,
            "side": side.upper(),
            "order_type": order_type.upper(),
            "amount": amount,
        }

        if limit_price is not None:
            payload["limit_price"] = limit_price

        # Submit order to Alpaca via API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_BASE_URL}/api/orders",
                json=payload,
                timeout=15.0
            )
            response.raise_for_status()
            data = response.json()

        # Format success response
        order_id = data.get("id", "UNKNOWN")
        status = data.get("status", "UNKNOWN")

        result = f"""
✅ ORDER PLACED SUCCESSFULLY
Order ID: {order_id}
Type: {order_type.upper()} {side.upper()}
Ticker: {ticker}
Amount: {amount}
"""
        if limit_price:
            result += f"Limit Price: ${limit_price:,.2f}\n"

        result += f"Status: {status}\n"

        return result.strip()

    except httpx.HTTPStatusError as e:
        error_detail = e.response.text
        return f"ERROR: Failed to place order. API returned {e.response.status_code}: {error_detail}"
    except httpx.HTTPError as e:
        return f"ERROR: Failed to connect to trading API. Service might be down. ({str(e)})"
    except Exception as e:
        return f"ERROR: Unexpected error executing trade: {str(e)}"