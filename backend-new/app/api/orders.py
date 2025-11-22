"""
Order endpoints powered by Alpaca
Maps legacy /api/orders routes to Alpaca paper trading
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List

from app.services.alpaca_trading import trading_service

router = APIRouter()


class CreateOrderRequest(BaseModel):
    ticker: str
    side: str  # BUY/SELL
    order_type: str  # MARKET/LIMIT/STOP_LOSS
    amount: float
    limit_price: Optional[float] = None


def _format_symbol(symbol: str) -> str:
    # Alpaca may return BTCUSD; convert to BTC/USD for UI
    if "/" in symbol:
        return symbol
    if symbol.endswith("USD") and len(symbol) > 3:
        return f"{symbol[:-3]}/USD"
    return symbol


def _normalize_symbol(ticker: str) -> str:
    return ticker.replace("-", "/")


@router.get("/orders")
async def get_orders(status: str = Query(default="open", regex="^(open|closed|all)$")):
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")

    orders = await trading_service.get_orders(status=status)
    formatted: List[dict] = []

    for order in orders:
        qty = order.get("qty") or order.get("notional") or 0
        formatted.append({
            "id": order["id"],
            "ticker": _format_symbol(order["symbol"]),
            "order_type": f"{order['order_type'].upper()} {order['side'].upper()}",
            "amount": float(qty),
            "limit_price": order.get("limit_price"),
            "created_at": order.get("created_at"),
            "status": order.get("status"),
            "placed_ago": ""
        })

    return formatted


@router.post("/orders")
async def create_order(order: CreateOrderRequest):
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")

    symbol = _normalize_symbol(order.ticker)
    side = order.side.lower()

    if order.order_type.upper() == "MARKET":
        result = await trading_service.place_market_order(symbol, order.amount, side)
    elif order.order_type.upper() == "LIMIT":
        if order.limit_price is None:
            raise HTTPException(status_code=400, detail="LIMIT orders require limit_price")
        result = await trading_service.place_limit_order(symbol, order.amount, side, order.limit_price)
    elif order.order_type.upper() == "STOP_LOSS":
        if order.limit_price is None:
            raise HTTPException(status_code=400, detail="STOP_LOSS orders require limit_price (stop price)")
        result = await trading_service.place_stop_order(symbol, order.amount, side, order.limit_price)
    else:
        raise HTTPException(status_code=400, detail="Unsupported order_type")

    if not result:
        raise HTTPException(status_code=500, detail="Failed to place order")

    result["ticker"] = _format_symbol(result["symbol"])
    return result


@router.delete("/orders/{order_id}")
async def cancel_order(order_id: str):
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")

    success = await trading_service.cancel_order(order_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to cancel order")

    return {"success": True, "message": f"Order {order_id} cancelled"}
