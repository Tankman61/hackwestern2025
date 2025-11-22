"""
FastAPI main application entry point
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.services.alpaca import alpaca_service
from app.services.alpaca_trading import trading_service
from app.api.market_websocket import router as market_ws_router, broadcast_price_update
from app.api.trading import router as trading_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager - startup and shutdown events"""
    # Startup
    logger.info("Starting VibeTrade API...")
    
    # Register price update callback with Alpaca service
    alpaca_service.add_price_update_callback(broadcast_price_update)
    logger.info("Alpaca market data service initialized")
    
    yield
    
    # Shutdown
    logger.info("Shutting down VibeTrade API...")
    await alpaca_service.stop()
    logger.info("Alpaca market data service stopped")


app = FastAPI(
    title="VibeTrade API",
    description="Agentic Risk Terminal Backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import routers
from app.api import portfolio, orders, market_data
# from app.api import websocket  # TODO: Implement WebSocket

# Register routers
app.include_router(portfolio.router, prefix="/api", tags=["portfolio"])
app.include_router(orders.router, prefix="/api", tags=["orders"])
app.include_router(market_data.router, prefix="/api", tags=["market"])
# app.include_router(websocket.router, prefix="/ws", tags=["websocket"])  # TODO: Implement WebSocket

@app.get("/")
async def root():
    return {"message": "VibeTrade API is running"}


@app.get("/health")
async def health():
    account = await trading_service.get_account() if trading_service.is_enabled() else None
    
    return {
        "status": "healthy",
        "alpaca_market_data": {
            "connected": len(alpaca_service.live_prices) > 0,
            "tracked_symbols": len(alpaca_service.live_prices)
        },
        "alpaca_trading": {
            "enabled": trading_service.is_enabled(),
            "paper_trading": trading_service.paper if trading_service.is_enabled() else None,
            "account_value": float(account["portfolio_value"]) if account else None
        }
    }

