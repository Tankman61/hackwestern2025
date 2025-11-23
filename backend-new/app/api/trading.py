"""
Trading API endpo   ints
Handles orders, positions, and account management via Alpaca paper trading
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
import logging

from app.services.alpaca_trading import trading_service
from app.services.alpaca import alpaca_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ========== REQUEST MODELS ==========

class MarketOrderRequest(BaseModel):
    symbol: str = Field(..., description="Trading symbol (e.g., AAPL, BTC/USD)")
    qty: float = Field(..., gt=0, description="Quantity to trade")
    side: Literal["buy", "sell"] = Field(..., description="Order side")
    time_in_force: Literal["day", "gtc", "ioc", "fok"] = Field(default="gtc", description="Time in force")


class LimitOrderRequest(BaseModel):
    symbol: str = Field(..., description="Trading symbol")
    qty: float = Field(..., gt=0, description="Quantity to trade")
    side: Literal["buy", "sell"] = Field(..., description="Order side")
    limit_price: float = Field(..., gt=0, description="Limit price")
    time_in_force: Literal["day", "gtc", "ioc", "fok"] = Field(default="gtc", description="Time in force")


class StopOrderRequest(BaseModel):
    symbol: str = Field(..., description="Trading symbol")
    qty: float = Field(..., gt=0, description="Quantity to trade")
    side: Literal["buy", "sell"] = Field(..., description="Order side")
    stop_price: float = Field(..., gt=0, description="Stop price")
    time_in_force: Literal["day", "gtc", "ioc", "fok"] = Field(default="gtc", description="Time in force")


class StopLimitOrderRequest(BaseModel):
    symbol: str = Field(..., description="Trading symbol")
    qty: float = Field(..., gt=0, description="Quantity to trade")
    side: Literal["buy", "sell"] = Field(..., description="Order side")
    stop_price: float = Field(..., gt=0, description="Stop price")
    limit_price: float = Field(..., gt=0, description="Limit price")
    time_in_force: Literal["day", "gtc", "ioc", "fok"] = Field(default="gtc", description="Time in force")


class ClosePositionRequest(BaseModel):
    qty: Optional[float] = Field(None, gt=0, description="Quantity to close (None = close all)")


# ========== ACCOUNT ENDPOINTS ==========

@router.get("/api/account")
async def get_account():
    """
    Get account information
    
    Returns account equity, buying power, cash, positions value, etc.
    """
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled. Add Alpaca API keys to .env")
    
    account = await trading_service.get_account()
    if not account:
        raise HTTPException(status_code=500, detail="Failed to fetch account information")
    
    return account


# ========== POSITION ENDPOINTS ==========

@router.get("/api/positions")
async def get_positions():
    """
    Get all open positions
    
    Returns list of positions with current P&L calculated using live prices
    """
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")
    
    positions = await trading_service.get_positions()
    
    # Enhance positions with live prices from our price cache
    for pos in positions:
        symbol = pos["symbol"].replace("/", "")  # BTC/USD -> BTCUSD
        live_price = alpaca_service.get_price(symbol)
        
        if live_price:
            # Recalculate P&L with live price
            pnl_data = trading_service.calculate_pnl(
                side=pos["side"],
                qty=pos["qty"],
                entry_price=pos["avg_entry_price"],
                current_price=live_price
            )
            pos["live_price"] = live_price
            pos["live_pnl"] = pnl_data["pnl"]
            pos["live_pnl_percent"] = pnl_data["pnl_percent"]
    
    return {"positions": positions}


@router.get("/api/positions/{symbol}")
async def get_position(symbol: str):
    """
    Get a specific position by symbol
    """
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")
    
    position = await trading_service.get_position(symbol)
    if not position:
        raise HTTPException(status_code=404, detail=f"Position {symbol} not found")
    
    # Enhance with live price
    clean_symbol = symbol.replace("/", "")
    live_price = alpaca_service.get_price(clean_symbol)
    
    if live_price:
        pnl_data = trading_service.calculate_pnl(
            side=position["side"],
            qty=position["qty"],
            entry_price=position["avg_entry_price"],
            current_price=live_price
        )
        position["live_price"] = live_price
        position["live_pnl"] = pnl_data["pnl"]
        position["live_pnl_percent"] = pnl_data["pnl_percent"]
    
    return position


@router.delete("/api/positions/{symbol}")
async def close_position(symbol: str, request: Optional[ClosePositionRequest] = None):
    """
    Close a position (full or partial)
    
    If qty is provided, closes partial position. Otherwise closes entire position.
    """
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")
    
    qty = request.qty if request else None
    success = await trading_service.close_position(symbol, qty)
    
    if not success:
        raise HTTPException(status_code=500, detail=f"Failed to close position {symbol}")
    
    return {
        "success": True,
        "message": f"Closed {qty if qty else 'all'} of {symbol}"
    }


# ========== ORDER ENDPOINTS ==========

@router.post("/api/orders/market")
async def place_market_order(order: MarketOrderRequest):
    """
    Place a market order
    
    Market orders execute immediately at current market price
    """
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")
    
    result = await trading_service.place_market_order(
        symbol=order.symbol,
        qty=order.qty,
        side=order.side,
        time_in_force=order.time_in_force
    )
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to place market order")
    
    return result


@router.post("/api/orders/limit")
async def place_limit_order(order: LimitOrderRequest):
    """
    Place a limit order
    
    Limit orders execute only at specified price or better
    """
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")
    
    result = await trading_service.place_limit_order(
        symbol=order.symbol,
        qty=order.qty,
        side=order.side,
        limit_price=order.limit_price,
        time_in_force=order.time_in_force
    )
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to place limit order")
    
    return result


@router.post("/api/orders/stop")
async def place_stop_order(order: StopOrderRequest):
    """
    Place a stop order
    
    Stop orders trigger a market order when stop price is reached
    """
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")
    
    result = await trading_service.place_stop_order(
        symbol=order.symbol,
        qty=order.qty,
        side=order.side,
        stop_price=order.stop_price,
        time_in_force=order.time_in_force
    )
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to place stop order")
    
    return result


@router.post("/api/orders/stop-limit")
async def place_stop_limit_order(order: StopLimitOrderRequest):
    """
    Place a stop-limit order
    
    Stop-limit orders trigger a limit order when stop price is reached
    """
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")
    
    result = await trading_service.place_stop_limit_order(
        symbol=order.symbol,
        qty=order.qty,
        side=order.side,
        stop_price=order.stop_price,
        limit_price=order.limit_price,
        time_in_force=order.time_in_force
    )
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to place stop-limit order")
    
    return result


@router.get("/api/orders")
async def get_orders(
    status: Literal["open", "closed", "all"] = Query(default="open", description="Order status filter"),
    limit: int = Query(default=100, ge=1, le=500, description="Max orders to return"),
    symbols: Optional[str] = Query(default=None, description="Comma-separated symbols to filter")
):
    """
    Get orders
    
    Returns list of orders filtered by status
    """
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")
    
    symbol_list = symbols.split(",") if symbols else None
    orders = await trading_service.get_orders(
        status=status,
        limit=limit,
        symbols=symbol_list
    )
    
    return {"orders": orders}


@router.get("/api/orders/{order_id}")
async def get_order(order_id: str):
    """
    Get a specific order by ID
    """
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")
    
    order = await trading_service.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    
    return order


@router.delete("/api/orders/{order_id}")
async def cancel_order(order_id: str):
    """
    Cancel a specific order
    """
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")
    
    success = await trading_service.cancel_order(order_id)
    if not success:
        raise HTTPException(status_code=500, detail=f"Failed to cancel order {order_id}")
    
    return {
        "success": True,
        "message": f"Order {order_id} cancelled"
    }


@router.delete("/api/orders")
async def cancel_all_orders():
    """
    Cancel all open orders
    """
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")
    
    success = await trading_service.cancel_all_orders()
    if not success:
        raise HTTPException(status_code=500, detail="Failed to cancel orders")
    
    return {
        "success": True,
        "message": "All orders cancelled"
    }


# ========== UTILITY ENDPOINTS ==========

@router.get("/api/trading/status")
async def get_trading_status():
    """
    Check if trading service is enabled and get service info
    """
    return {
        "enabled": trading_service.is_enabled(),
        "paper_trading": trading_service.paper if trading_service.is_enabled() else None,
        "message": "Trading service ready" if trading_service.is_enabled() else "Add Alpaca API keys to enable trading"
    }
