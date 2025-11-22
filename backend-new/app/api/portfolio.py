"""
Portfolio endpoints
GET /api/portfolio - Get current portfolio state
GET /api/positions - Get open positions
PATCH /api/positions/{position_id} - Adjust position size
POST /api/positions/{position_id}/close - Close position
GET /api/history - Get trade history
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.supabase import get_supabase
from typing import Optional

router = APIRouter()


class AdjustPositionRequest(BaseModel):
    amount: float


class ClosePositionRequest(BaseModel):
    current_price: float


@router.get("/portfolio")
async def get_portfolio():
    """Get current portfolio state with total value and P&L"""
    db = get_supabase()

    # Get portfolio row
    portfolio_result = db.table("portfolio").select("*").limit(1).execute()

    if not portfolio_result.data:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    portfolio = portfolio_result.data[0]
    balance_usd = float(portfolio["balance_usd"])

    # Get all open positions to calculate total value
    positions_result = db.table("trades")\
        .select("*")\
        .eq("status", "OPEN")\
        .not_.is_("entry_price", "null")\
        .execute()

    # Calculate total position value and P&L
    # Note: This is a simplified calculation. In production, you'd fetch current prices
    # For now, we'll use the stored pnl values
    total_pnl = sum(float(pos.get("pnl", 0)) for pos in positions_result.data)

    # Total value = balance + current position values
    # For simplicity, assuming position value = initial investment + pnl
    position_values = 0
    for pos in positions_result.data:
        entry_value = float(pos["entry_price"]) * float(pos["amount"])
        position_values += entry_value

    total_value = balance_usd + position_values + total_pnl

    # Calculate P&L percentage
    initial_value = 50000.00  # From schema seed
    pnl_percent = ((total_value - initial_value) / initial_value) * 100 if initial_value > 0 else 0

    return {
        "balance_usd": balance_usd,
        "total_value": round(total_value, 2),
        "pnl_total": round(total_pnl, 2),
        "pnl_percent": round(pnl_percent, 2),
        "is_locked": portfolio["is_locked"]
    }


@router.get("/positions")
async def get_positions():
    """Get all open positions"""
    db = get_supabase()

    result = db.table("trades")\
        .select("*")\
        .eq("status", "OPEN")\
        .not_.is_("entry_price", "null")\
        .order("created_at", desc=True)\
        .execute()

    positions = []
    for trade in result.data:
        # Note: current_price and pnl calculation should be done with real-time prices
        # For now, we'll return the stored values
        side = "LONG" if trade["side"] == "BUY" else "SHORT"

        positions.append({
            "id": trade["id"],
            "ticker": trade["ticker"].replace("-", "/"),  # Convert BTC-USD to BTC/USD
            "side": side,
            "amount": float(trade["amount"]),
            "entry_price": float(trade["entry_price"]),
            "current_price": float(trade["entry_price"]),  # TODO: Fetch real-time price
            "pnl": float(trade.get("pnl", 0)),
            "pnl_percent": 0  # TODO: Calculate with real-time price
        })

    return positions


@router.patch("/positions/{position_id}")
async def adjust_position(position_id: str, request: AdjustPositionRequest):
    """Adjust the size of an open position"""
    db = get_supabase()

    # Verify position exists and is open
    check_result = db.table("trades")\
        .select("*")\
        .eq("id", position_id)\
        .eq("status", "OPEN")\
        .not_.is_("entry_price", "null")\
        .execute()

    if not check_result.data:
        raise HTTPException(status_code=404, detail="Open position not found")

    # Update position size
    result = db.table("trades")\
        .update({"amount": request.amount})\
        .eq("id", position_id)\
        .execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update position")

    updated_position = result.data[0]
    side = "LONG" if updated_position["side"] == "BUY" else "SHORT"

    return {
        "id": updated_position["id"],
        "ticker": updated_position["ticker"].replace("-", "/"),
        "side": side,
        "amount": float(updated_position["amount"]),
        "entry_price": float(updated_position["entry_price"]),
        "message": "Position size updated successfully"
    }


@router.post("/positions/{position_id}/close")
async def close_position(position_id: str, request: ClosePositionRequest):
    """Close an open position and update portfolio balance"""
    db = get_supabase()

    # Get the position
    position_result = db.table("trades")\
        .select("*")\
        .eq("id", position_id)\
        .eq("status", "OPEN")\
        .not_.is_("entry_price", "null")\
        .execute()

    if not position_result.data:
        raise HTTPException(status_code=404, detail="Open position not found")

    position = position_result.data[0]

    # Calculate P&L
    entry_price = float(position["entry_price"])
    amount = float(position["amount"])
    current_price = request.current_price

    if position["side"] == "BUY":  # LONG position
        pnl = (current_price - entry_price) * amount
    else:  # SHORT position
        pnl = (entry_price - current_price) * amount

    # Update trade to FILLED
    from datetime import datetime
    update_result = db.table("trades")\
        .update({
            "status": "FILLED",
            "exit_price": current_price,
            "pnl": pnl,
            "filled_at": datetime.utcnow().isoformat()
        })\
        .eq("id", position_id)\
        .execute()

    if not update_result.data:
        raise HTTPException(status_code=500, detail="Failed to close position")

    # Update portfolio balance
    portfolio_result = db.table("portfolio")\
        .select("balance_usd")\
        .limit(1)\
        .execute()

    if portfolio_result.data:
        current_balance = float(portfolio_result.data[0]["balance_usd"])
        new_balance = current_balance + pnl

        db.table("portfolio")\
            .update({"balance_usd": new_balance})\
            .eq("id", portfolio_result.data[0]["id"])\
            .execute()

    closed_position = update_result.data[0]
    side = "LONG" if closed_position["side"] == "BUY" else "SHORT"

    return {
        "id": closed_position["id"],
        "ticker": closed_position["ticker"].replace("-", "/"),
        "side": side,
        "amount": float(closed_position["amount"]),
        "entry_price": entry_price,
        "exit_price": current_price,
        "pnl": round(pnl, 2),
        "pnl_percent": round((pnl / (entry_price * amount)) * 100, 2) if entry_price * amount > 0 else 0,
        "filled_at": closed_position["filled_at"],
        "message": "Position closed successfully"
    }


@router.get("/history")
async def get_history():
    """Get trade history (filled trades)"""
    db = get_supabase()

    result = db.table("trades")\
        .select("*")\
        .eq("status", "FILLED")\
        .order("filled_at", desc=True)\
        .limit(50)\
        .execute()

    history = []
    for trade in result.data:
        side = "LONG" if trade["side"] == "BUY" else "SHORT"

        history.append({
            "id": trade["id"],
            "ticker": trade["ticker"].replace("-", "/"),
            "side": side,
            "amount": float(trade["amount"]),
            "entry_price": float(trade["entry_price"]) if trade["entry_price"] else 0,
            "exit_price": float(trade["exit_price"]) if trade["exit_price"] else 0,
            "pnl": float(trade.get("pnl", 0)),
            "filled_at": trade["filled_at"],
            "time_ago": ""  # TODO: Calculate time ago on frontend or here
        })

    return history
