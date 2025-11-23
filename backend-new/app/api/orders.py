"""
Order endpoints powered by Alpaca
Maps legacy /api/orders routes to Alpaca paper trading
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

from app.services.alpaca_trading import trading_service
from app.api.market_websocket import manager
from app.services.supabase import get_supabase

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


def _check_account_lock() -> None:
    """
    Check if trading account is locked. Raises HTTPException if locked.
    Used to enforce emergency lockout from lock_user_account() tool.
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.info("🔒 Checking account lock...")

    db = get_supabase()
    result = db.client.table("portfolio").select("id, is_locked, lock_reason, lock_expires_at").limit(1).execute()
    logger.info(f"Lock check result: {result.data}")

    if not result.data:
        return  # No portfolio record, allow trade

    lock_state = result.data[0]
    is_locked = lock_state.get("is_locked", False)

    # Check if lock has expired
    if is_locked:
        lock_expires_at = lock_state.get("lock_expires_at")
        if lock_expires_at:
            try:
                expiry = datetime.fromisoformat(lock_expires_at.replace("Z", "+00:00"))
                if datetime.utcnow() > expiry.replace(tzinfo=None):
                    # Lock expired, auto-unlock
                    db.client.table("portfolio").update({
                        "is_locked": False,
                        "lock_reason": None,
                        "lock_expires_at": None
                    }).eq("id", lock_state.get("id")).execute()
                    return  # Lock expired, allow trade
            except (ValueError, AttributeError):
                pass  # Invalid date format, treat as locked

        # Account is locked and not expired
        reason = lock_state.get("lock_reason", "Emergency lockout active")
        raise HTTPException(
            status_code=403,
            detail=f"🔒 Trading locked: {reason}"
        )


@router.get("/orders")
async def get_orders(status: str = Query(default="open", regex="^(open|closed|all)$")):
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")

    orders = await trading_service.get_orders(status=status)
    formatted: List[dict] = []

    for order in orders:
        qty = order.get("qty") or order.get("notional") or 0
        # Convert UUID to string for JSON serialization
        order_id = str(order["id"]) if order["id"] is not None else None
        formatted.append({
            "id": order_id,
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

    # Check if account is locked (enforces lock_user_account() tool)
    _check_account_lock()

    symbol = _normalize_symbol(order.ticker)
    # Convert symbol to Alpaca format (BTC/USD -> BTCUSD)
    alpaca_symbol = symbol.replace("/", "").replace("-", "").upper()
    side = order.side.lower()

    try:
        if order.order_type.upper() == "MARKET":
            result = await trading_service.place_market_order(alpaca_symbol, order.amount, side)
        elif order.order_type.upper() == "LIMIT":
            if order.limit_price is None:
                raise HTTPException(status_code=400, detail="LIMIT orders require limit_price")
            result = await trading_service.place_limit_order(alpaca_symbol, order.amount, side, order.limit_price)
        elif order.order_type.upper() == "STOP_LOSS":
            if order.limit_price is None:
                raise HTTPException(status_code=400, detail="STOP_LOSS orders require limit_price (stop price)")
            result = await trading_service.place_stop_order(alpaca_symbol, order.amount, side, order.limit_price)
        else:
            raise HTTPException(status_code=400, detail="Unsupported order_type")

        if not result:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Order placement returned None for {order.order_type} {side} {order.amount} {alpaca_symbol}")
            # Check if trading service is enabled
            if not trading_service.is_enabled():
                raise HTTPException(status_code=503, detail="Trading service not enabled - check Alpaca API keys")
            raise HTTPException(status_code=500, detail=f"Failed to place order - check backend logs for details. Symbol: {alpaca_symbol}")
    except HTTPException:
        raise
    except ValueError as e:
        # Trading client not initialized
        raise HTTPException(status_code=503, detail=str(e))
    except RuntimeError as e:
        # Order placement error from trading service
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Order placement error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to place order: {str(e)}")
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error placing order: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to place order: {str(e)}")

    # Ensure result has required fields
    if "symbol" not in result:
        result["symbol"] = symbol
    result["ticker"] = _format_symbol(result.get("symbol", symbol))

    # Convert UUID to string for JSON serialization in response
    if "id" in result and result["id"] is not None:
        result["id"] = str(result["id"])

    # Broadcast order update via WebSocket
    try:
        # Safely extract order fields
        order_type = result.get("order_type", "")
        side = result.get("side", order.side)
        
        # Handle case where order_type might be an enum value
        if hasattr(order_type, 'value'):
            order_type = order_type.value
        if hasattr(side, 'value'):
            side = side.value
            
        order_type_str = str(order_type).upper() if order_type else ""
        side_str = str(side).upper() if side else ""
        
        # Convert UUID to string for JSON serialization
        order_id = result.get("id")
        if order_id is not None:
            order_id = str(order_id)

        order_update = {
            "type": "order_update",
            "data": {
                "id": order_id,
                "ticker": result.get("ticker", _format_symbol(result.get("symbol", ""))),
                "order_type": f"{order_type_str} {side_str}",
                "amount": result.get("qty") or result.get("notional") or order.amount,
                "limit_price": result.get("limit_price"),
                "status": result.get("status", "new"),
                "created_at": result.get("created_at"),
                "side": side_str,
            }
        }
        # Broadcast to all crypto connections (since we're trading BTC)
        await manager.broadcast_to_subscribers("crypto", "BTC", order_update)
    except Exception as e:
        # Don't fail the order placement if WebSocket broadcast fails
        import logging
        logging.getLogger(__name__).warning(f"Failed to broadcast order update: {e}", exc_info=True)
    
    return result


@router.delete("/orders/{order_id}")
async def cancel_order(order_id: str):
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")

    success = await trading_service.cancel_order(order_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to cancel order")

    return {"success": True, "message": f"Order {order_id} cancelled"}
