"""
Debug endpoints for testing
Allows injecting fake price data to simulate market crashes

TODO: This inject price endpoint is a TEMPORARY TESTING HACK!
It directly manipulates Finnhub's in-memory price cache, which:
1. Only works for the FastAPI process (not workers running separately)
2. Gets overwritten when real Finnhub WebSocket data arrives
3. Doesn't persist across server restarts
4. Is not suitable for production crash simulation

PROPER SOLUTION for testing crash scenarios:
- Create a dedicated "mock price service" that can:
  - Override real prices for testing
  - Persist overrides across processes
  - Simulate gradual price changes (not just instant jumps)
  - Support time-based scenarios (e.g., "crash for 5 minutes")
- OR use a proper WebSocket mock/proxy that intercepts Finnhub data
- OR create a "test mode" flag that switches to mock price provider
"""
import time
import random
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.finnhub import finnhub_service
from app.api.market_websocket import broadcast_price_update

router = APIRouter()


class InjectPriceRequest(BaseModel):
    symbol: str
    price: float


@router.post("/debug/inject-price")
async def inject_price(request: InjectPriceRequest):
    """
    Inject fake price data into Finnhub service (for testing crashes)

    Example:
        POST /debug/inject-price
        {"symbol": "BTC", "price": 85000}

    This simulates a crash by overriding the live price.
    The agent will see this fake price when calling get_current_price().
    """
    try:
        # Inject into Finnhub's live_prices dict
        finnhub_service.live_prices[request.symbol] = request.price

        # Also inject common variants
        variants = [
            request.symbol,
            f"{request.symbol}USD",
            f"{request.symbol}USDT",
            f"{request.symbol}/USD"
        ]

        for variant in variants:
            finnhub_service.live_prices[variant] = request.price

        return {
            "success": True,
            "message": f"Injected fake price for {request.symbol}",
            "symbol": request.symbol,
            "price": request.price,
            "variants_updated": variants
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to inject price: {str(e)}")


@router.get("/debug/prices")
async def get_all_prices():
    """
    Get all current prices in Finnhub service

    Returns all prices currently stored in memory (real + injected).
    """
    return {
        "prices": finnhub_service.get_all_prices(),
        "count": len(finnhub_service.live_prices)
    }


@router.delete("/debug/clear-prices")
async def clear_prices():
    """
    Clear all prices from Finnhub service

    Useful for resetting after testing.
    """
    finnhub_service.live_prices.clear()
    return {
        "success": True,
        "message": "All prices cleared"
    }


@router.post("/debug/trigger-alert")
async def trigger_alert(alert_type: str = "RISK_CRITICAL"):
    """
    Force trigger an alert (for testing AlertBanner in frontend)

    Example:
        POST /debug/trigger-alert?alert_type=RISK_CRITICAL
        POST /debug/trigger-alert?alert_type=HYPE_EXTREME

    NOTE: This endpoint is simplified now. To actually trigger alerts:
    - Run the monitor worker (it sends WebSocket broadcasts automatically)
    - Or manually inject fake prices with /inject-price to trigger risk thresholds
    """
    # Prepare fake alert data for reference
    if alert_type == "RISK_CRITICAL":
        payload = {
            "alert_type": "RISK_CRITICAL",
            "risk_score": 95,
            "hype_score": 50,
            "btc_price": 75000.0,
            "price_change_24h": -8.5,
            "message": "[TEST] Bitcoin CRASHING! Down 8.5% in the last hour! Risk at 95/100!",
            "sentiment": "PANIC"
        }
    else:  # HYPE_EXTREME
        payload = {
            "alert_type": "HYPE_EXTREME",
            "risk_score": 40,
            "hype_score": 95,
            "btc_price": 92000.0,
            "price_change_24h": 12.3,
            "message": "[TEST] Bitcoin MOONING! Up 12% today! Social hype at 95/100!",
            "sentiment": "EUPHORIA"
        }

    return {
        "success": True,
        "message": f"Test alert configured: {alert_type}",
        "payload": payload,
        "note": "To actually trigger alerts, use /inject-price to manipulate prices and let the monitor worker detect it."
    }


async def _inject_and_broadcast(symbol: str, price: float, data_type: str = "crypto"):
    """
    Helper to inject price into Finnhub cache and broadcast to websocket subscribers.
    """
    # Normalize symbol variants
    variants = [
        symbol,
        f"{symbol}USD",
        f"{symbol}USDT",
        f"{symbol}/USD"
    ]
    for variant in variants:
        finnhub_service.live_prices[variant] = price

    # Broadcast a synthetic trade event so frontend updates immediately
    message = {
        "type": "trade",
        "data": {
            "symbol": symbol,
            "timestamp": int(time.time() * 1000),
            "price": price,
            "size": 0
        }
    }
    await broadcast_price_update(data_type, symbol, message)
    return variants


@router.post("/debug/scenario/crash")
async def scenario_crash(symbol: str = "BTC", target_price: float = 15000.0, ramp_seconds: float = 20.0):
    """
    Force a price crash for the given symbol and broadcast it immediately.
    Default: BTC to ~15,000 (randomized +/-10%).
    """
    base = target_price or 15000.0
    randomized = random.uniform(base * 0.9, base * 1.1)
    await finnhub_service.set_override_price(symbol, randomized, data_type="crypto", ramp_seconds=ramp_seconds)
    variants = await _inject_and_broadcast(symbol, randomized)
    return {
        "success": True,
        "scenario": "crash",
        "symbol": symbol,
        "price": randomized,
        "variants_updated": variants
    }


@router.post("/debug/scenario/moon")
async def scenario_moon(symbol: str = "BTC", target_price: float = 120000.0, ramp_seconds: float = 20.0):
    """
    Force a price moonshot for the given symbol and broadcast it immediately.
    Default: BTC to ~120,000 (randomized +/-10%).
    """
    base = target_price or 120000.0
    randomized = random.uniform(base * 0.9, base * 1.1)
    await finnhub_service.set_override_price(symbol, randomized, data_type="crypto", ramp_seconds=ramp_seconds)
    variants = await _inject_and_broadcast(symbol, randomized)
    return {
        "success": True,
        "scenario": "moon",
        "symbol": symbol,
        "price": randomized,
        "variants_updated": variants
    }


@router.post("/debug/scenario/clear")
async def scenario_clear(symbol: str = "BTC"):
    """
    Clear override for the given symbol (or all if symbol omitted).
    """
    await finnhub_service.clear_override(symbol or None)
    return {
        "success": True,
        "scenario": "clear",
        "symbol": symbol or "all"
    }
