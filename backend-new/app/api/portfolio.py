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
    result = db.client.table("portfolio").select("is_locked, lock_reason, lock_expires_at").limit(1).execute()
    if result.data:
        return result.data[0]
    return {"is_locked": False, "lock_reason": None, "lock_expires_at": None}


@router.get("/portfolio")
async def get_portfolio():
    if not trading_service.is_enabled():
        raise HTTPException(status_code=503, detail="Trading service not enabled")

    # Try to get account info, but handle errors gracefully
    account = None
    try:
        account = await trading_service.get_account()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Failed to fetch Alpaca account: {e}")

    lock_state = _get_lock_state()

    # If account fetch failed, return default values
    if not account:
        return {
            "balance_usd": 0.0,
            "total_value": 0.0,
            "pnl_total": 0.0,
            "pnl_percent": 0.0,
            "is_locked": lock_state.get("is_locked", False),
            "lock_reason": lock_state.get("lock_reason"),
            "lock_expires_at": lock_state.get("lock_expires_at"),
            "error": "Unable to fetch account data from Alpaca"
        }

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
            # Keep full Alpaca position data for frontend compatibility
            "asset_id": pos["asset_id"],
            "symbol": pos["symbol"],
            "exchange": pos.get("exchange"),
            "asset_class": pos["asset_class"],
            "avg_entry_price": entry_price,
            "qty": float(pos["qty"]),
            "qty_available": pos.get("qty_available", float(pos["qty"])),
            "side": pos["side"],
            "market_value": pos["market_value"],
            "cost_basis": pos["cost_basis"],
            "unrealized_pl": pos["unrealized_pl"],
            "unrealized_plpc": pos["unrealized_plpc"],
            "unrealized_intraday_pl": pos.get("unrealized_intraday_pl", 0),
            "unrealized_intraday_plpc": pos.get("unrealized_intraday_plpc", 0),
            "current_price": float(live_price or entry_price),
            "lastday_price": pos.get("lastday_price", entry_price),
            "change_today": pos.get("change_today", 0),
            # Add calculated fields with live price
            "live_price": float(live_price) if live_price else None,
            "live_pnl": round(pnl["pnl"], 2),
            "live_pnl_percent": round(pnl["pnl_percent"], 2)
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

    import logging
    logger = logging.getLogger(__name__)

    # Get all orders (including new, filled, and closed)
    all_orders = await trading_service.get_orders(status="all", limit=100)
    logger.info(f"📋 Fetched {len(all_orders)} orders from Alpaca for history")

    history = []
    seen_ids = set()

    # Add all orders that have been filled or are market orders (which execute immediately)
    for order in all_orders:
        order_id = order.get("id")
        if order_id in seen_ids:
            continue

        filled_at = order.get("filled_at")
        filled_qty = order.get("filled_qty")
        status = order.get("status", "").lower()
        order_type = order.get("order_type", "").lower()
        qty = float(filled_qty or order.get("qty") or 0)

        # Include orders that:
        # 1. Are filled (have filled_at or filled_qty)
        # 2. Have status "filled", "partially_filled", or "closed"
        # 3. Are market orders (which execute immediately)
        # 4. Have been accepted/new and have a quantity
        is_filled = filled_at is not None or (filled_qty is not None and filled_qty > 0)
        is_filled_status = status in ["filled", "partially_filled", "closed"]
        is_market_order = "market" in order_type
        has_quantity = qty > 0

        if (is_filled or is_filled_status or (is_market_order and has_quantity)) and has_quantity:
            seen_ids.add(order_id)

            # Use filled_avg_price if available, otherwise use limit_price or stop_price
            entry_price = float(order.get("filled_avg_price") or order.get("limit_price") or order.get("stop_price") or 0)

            # Get current price for P&L calculation
            symbol = order["symbol"]
            clean_symbol = symbol.replace("/", "")

            # Try to get price from live cache first (cache uses no slash)
            current_price = alpaca_service.get_price(clean_symbol)

            # If not in cache, fetch latest price from Alpaca REST API
            if not current_price:
                try:
                    from alpaca.data.historical import CryptoHistoricalDataClient
                    from alpaca.data.requests import CryptoBarsRequest
                    from alpaca.data.timeframe import TimeFrame
                    from datetime import datetime, timedelta
                    import os

                    crypto_client = CryptoHistoricalDataClient(
                        api_key=os.getenv("ALPACA_API_KEY"),
                        secret_key=os.getenv("ALPACA_SECRET_KEY")
                    )

                    # Use formatted symbol with slash for API (BTC/USD not BTCUSD)
                    api_symbol = _format_symbol(symbol)

                    # Get latest bar (last minute)
                    request = CryptoBarsRequest(
                        symbol_or_symbols=api_symbol,
                        timeframe=TimeFrame.Minute,
                        start=datetime.now() - timedelta(minutes=5),
                        end=datetime.now()
                    )

                    bars = crypto_client.get_crypto_bars(request)

                    # BarSet has a .data attribute which is a dict
                    bars_dict = bars.data if hasattr(bars, 'data') else bars

                    # Check both with and without slash
                    symbol_key = None
                    if bars_dict:
                        if api_symbol in bars_dict:
                            symbol_key = api_symbol
                        elif clean_symbol in bars_dict:
                            symbol_key = clean_symbol
                        else:
                            # Log what symbols ARE available
                            logger.warning(f"Symbol {api_symbol} not in response. Available: {list(bars_dict.keys())}")

                    if symbol_key and bars_dict:
                        bar_list = list(bars_dict[symbol_key])
                        if bar_list:
                            current_price = float(bar_list[-1].close)
                            logger.info(f"💰 Fetched latest price for {symbol_key} from API: ${current_price:.2f}")
                except Exception as e:
                    logger.warning(f"Failed to fetch current price for {symbol}: {e}")

            logger.info(f"💰 Price lookup for {symbol}: cache_live={alpaca_service.get_price(clean_symbol)}, current={current_price}, entry={entry_price}")

            # If no live price available, use entry price (P&L will be 0)
            if not current_price:
                current_price = entry_price

            # Calculate P&L based on side
            # For BUY orders: if price went down, it's a loss (negative P&L)
            # For SELL orders: if price went up since we sold, we missed gains (but P&L is locked in)
            side = order["side"].upper()
            if side == "BUY":
                # P&L = (current_price - entry_price) * qty
                pnl = (current_price - entry_price) * qty
            else:  # SELL
                # P&L = (entry_price - current_price) * qty (reversed for sells)
                pnl = (entry_price - current_price) * qty

            logger.info(f"📊 {side} {qty} {symbol}: entry=${entry_price:.2f}, current=${current_price:.2f}, P&L=${pnl:.2f}")

            history.append({
                "id": order_id,
                "ticker": _format_symbol(symbol),
                "side": side,
                "amount": qty,
                "entry_price": entry_price,
                "exit_price": current_price,
                "pnl": round(pnl, 2),
                "filled_at": filled_at or order.get("created_at") or order.get("submitted_at"),
                "time_ago": "",
                "status": status
            })

    logger.info(f"📊 Returning {len(history)} orders in history")

    # Sort by filled_at or created_at (most recent first)
    def get_sort_key(x):
        filled = x.get("filled_at") or ""
        return filled if filled else "0000-00-00T00:00:00"

    history.sort(key=get_sort_key, reverse=True)

    # Limit to 50 most recent
    return history[:50]
