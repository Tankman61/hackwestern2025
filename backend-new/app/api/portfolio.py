"""
Portfolio endpoints backed by Alpaca
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict

from app.services.supabase import get_supabase
from app.services.alpaca_trading import trading_service
from app.services.alpaca import alpaca_service

router = APIRouter()


class AdjustPositionRequest(BaseModel):
    amount: float


class ClosePositionRequest(BaseModel):
    qty: Optional[float] = None


def _format_symbol(symbol: str) -> str:
    if "/" in symbol:
        return symbol
    if symbol.endswith("USD") and len(symbol) > 3:
        return f"{symbol[:-3]}/USD"
    return symbol


def _get_lock_state() -> Dict[str, Optional[str]]:
    db = get_supabase()
    result = db.table("portfolio").select("is_locked, lock_reason, lock_expires_at").limit(1).execute()
    if result.data:
        return result.data[0]
    return {"is_locked": False, "lock_reason": None, "lock_expires_at": None}


@router.get("/portfolio")
async def get_portfolio():
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")

    account = await trading_service.get_account()
    if not account:
        raise HTTPException(status_code=500, detail="Failed to fetch Alpaca account")

    lock_state = _get_lock_state()

    balance = float(account.get("cash", 0))
    portfolio_value = float(account.get("portfolio_value", balance))
    equity = float(account.get("equity", portfolio_value))
    last_equity = float(account.get("last_equity", equity))

    pnl_total = equity - last_equity
    pnl_percent = (pnl_total / last_equity * 100) if last_equity else 0

    return {
        "balance_usd": round(balance, 2),
        "total_value": round(portfolio_value, 2),
        "pnl_total": round(pnl_total, 2),
        "pnl_percent": round(pnl_percent, 2),
        "is_locked": lock_state.get("is_locked", False),
        "lock_reason": lock_state.get("lock_reason"),
        "lock_expires_at": lock_state.get("lock_expires_at")
    }


@router.get("/positions")
async def get_positions():
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")

    positions = await trading_service.get_positions()
    formatted = []

    for pos in positions:
        symbol = _format_symbol(pos["symbol"])
        clean_symbol = pos["symbol"].replace("/", "")
        live_price = alpaca_service.get_price(clean_symbol) or pos.get("live_price") or pos.get("current_price")
        entry_price = float(pos.get("avg_entry_price", 0))

        pnl = trading_service.calculate_pnl(
            side=pos["side"],
            qty=float(pos["qty"]),
            entry_price=entry_price,
            current_price=float(live_price or entry_price)
        )

        formatted.append({
            "id": pos["symbol"],
            "ticker": symbol,
            "side": pos["side"],
            "amount": float(pos["qty"]),
            "entry_price": entry_price,
            "current_price": float(live_price or entry_price),
            "pnl": round(pnl["pnl"], 2),
            "pnl_percent": round(pnl["pnl_percent"], 2)
        })

    return formatted


@router.patch("/positions/{symbol}")
async def adjust_position(symbol: str, request: AdjustPositionRequest):
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")

    position = await trading_service.get_position(symbol)
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")

    current_qty = float(position["qty"])
    delta = request.amount - current_qty

    if abs(delta) < 1e-8:
        return position

    side = position["side"].upper()
    if delta > 0:
        order_side = "buy" if side == "LONG" else "sell"
        await trading_service.place_market_order(symbol, abs(delta), order_side)
    else:
        order_side = "sell" if side == "LONG" else "buy"
        await trading_service.place_market_order(symbol, abs(delta), order_side)

    updated = await trading_service.get_position(symbol)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to adjust position")

    updated["ticker"] = _format_symbol(updated["symbol"])
    return updated


@router.post("/positions/{symbol}/close")
async def close_position(symbol: str, request: ClosePositionRequest):
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")

    success = await trading_service.close_position(symbol, request.qty)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to close position")

    return {"success": True, "message": f"Closed {symbol}"}


@router.get("/history")
async def get_history():
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")

    orders = await trading_service.get_orders(status="closed", limit=50)
    history = []

    for order in orders:
        if not order.get("filled_at"):
            continue
        history.append({
            "id": order["id"],
            "ticker": _format_symbol(order["symbol"]),
            "side": order["side"].upper(),
            "amount": float(order.get("filled_qty") or order.get("qty") or 0),
            "entry_price": float(order.get("filled_avg_price") or order.get("limit_price") or 0),
            "exit_price": float(order.get("filled_avg_price") or order.get("limit_price") or 0),
            "pnl": 0.0,
            "filled_at": order.get("filled_at"),
            "time_ago": ""
        })

    return history
