"""
Order/Trading endpoints
POST /api/orders - Create manual order
GET /api/orders - Get active orders
DELETE /api/orders/{order_id} - Cancel order
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.supabase import get_supabase
from datetime import datetime

router = APIRouter()


class CreateOrderRequest(BaseModel):
    ticker: str  # e.g., "BTC-USD"
    side: str  # "BUY" or "SELL"
    order_type: str  # "MARKET", "LIMIT", "STOP_LOSS"
    amount: float
    limit_price: float = None  # Required for LIMIT and STOP_LOSS orders


@router.get("/orders")
async def get_orders():
    """Get all active orders (pending execution)"""
    db = get_supabase()

    # Orders are trades with status='OPEN' and no entry_price
    result = db.table("trades")\
        .select("*")\
        .eq("status", "OPEN")\
        .is_("entry_price", "null")\
        .order("created_at", desc=True)\
        .execute()

    orders = []
    for trade in result.data:
        order_type_display = f"{trade['order_type']} {trade['side']}"

        orders.append({
            "id": trade["id"],
            "ticker": trade["ticker"].replace("-", "/"),
            "order_type": order_type_display,
            "amount": float(trade["amount"]),
            "limit_price": float(trade["limit_price"]) if trade["limit_price"] else None,
            "created_at": trade["created_at"],
            "placed_ago": ""  # TODO: Calculate on frontend or here
        })

    return orders


@router.post("/orders")
async def create_order(order: CreateOrderRequest):
    """Create a new manual order"""
    db = get_supabase()
 
    # Validate order_type
    valid_order_types = ["MARKET", "LIMIT", "STOP_LOSS"]
    if order.order_type not in valid_order_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid order_type. Must be one of: {', '.join(valid_order_types)}"
        )

    # Validate side
    valid_sides = ["BUY", "SELL"]
    if order.side not in valid_sides:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid side. Must be one of: {', '.join(valid_sides)}"
        )

    # Validate limit_price for LIMIT and STOP_LOSS orders
    if order.order_type in ["LIMIT", "STOP_LOSS"] and order.limit_price is None:
        raise HTTPException(
            status_code=400,
            detail=f"{order.order_type} orders require a limit_price"
        )

    # Check if portfolio is locked
    portfolio_result = db.table("portfolio").select("is_locked").limit(1).execute()
    if portfolio_result.data and portfolio_result.data[0]["is_locked"]:
        raise HTTPException(
            status_code=403,
            detail="Trading is locked. Portfolio is currently locked by the agent."
        )

    # Create order
    order_data = {
        "ticker": order.ticker,
        "side": order.side,
        "order_type": order.order_type,
        "amount": order.amount,
        "status": "OPEN",
        "created_at": datetime.utcnow().isoformat()
    }

    # Add limit_price if provided
    if order.limit_price is not None:
        order_data["limit_price"] = order.limit_price

    result = db.table("trades").insert(order_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create order")

    created_order = result.data[0]

    return {
        "id": created_order["id"],
        "ticker": created_order["ticker"].replace("-", "/"),
        "side": created_order["side"],
        "order_type": created_order["order_type"],
        "amount": float(created_order["amount"]),
        "limit_price": float(created_order["limit_price"]) if created_order.get("limit_price") else None,
        "status": created_order["status"],
        "created_at": created_order["created_at"],
        "message": "Order created successfully"
    }


@router.delete("/orders/{order_id}")
async def cancel_order(order_id: str):
    """Cancel an active order"""
    db = get_supabase()

    # Verify order exists and is still OPEN
    check_result = db.table("trades")\
        .select("*")\
        .eq("id", order_id)\
        .eq("status", "OPEN")\
        .is_("entry_price", "null")\
        .execute()

    if not check_result.data:
        raise HTTPException(
            status_code=404,
            detail="Order not found or already cancelled/filled"
        )

    # Update status to CANCELLED
    result = db.table("trades")\
        .update({"status": "CANCELLED"})\
        .eq("id", order_id)\
        .execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to cancel order")

    cancelled_order = result.data[0]

    return {
        "id": cancelled_order["id"],
        "ticker": cancelled_order["ticker"].replace("-", "/"),
        "status": cancelled_order["status"],
        "message": "Order cancelled successfully"
    }
