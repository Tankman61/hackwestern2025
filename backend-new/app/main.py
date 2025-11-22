"""
FastAPI main application entry point
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.services.finnhub import finnhub_service
from app.services.alpaca_trading import trading_service  # Alpaca only for trading, not market data
from app.api.market_websocket import router as market_ws_router, broadcast_price_update
from app.api.trading import router as trading_router
from app.api.portfolio import router as portfolio_router
from app.api.orders import router as orders_router
from app.api.market_data import router as market_data_router

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
    
    # Get the FastAPI event loop and store it in the market data service
    loop = asyncio.get_event_loop()
    
    # Initialize Finnhub service for all market data display
    # Note: Alpaca is only used for trading execution, not market data
    finnhub_service.set_fastapi_loop(loop)
    finnhub_service.add_price_update_callback(broadcast_price_update)
    logger.info("Finnhub market data service initialized (all market data display)")
    
    yield
    
    # Shutdown
    logger.info("Shutting down VibeTrade API...")
    await finnhub_service.stop()
    logger.info("Market data service stopped")


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

# Register routers
app.include_router(market_ws_router, tags=["market-data"])
app.include_router(trading_router, tags=["trading"])
app.include_router(portfolio_router, prefix="/api", tags=["portfolio"])
app.include_router(orders_router, prefix="/api", tags=["orders"])
app.include_router(market_data_router, prefix="/api", tags=["market"])

@app.get("/")
async def root():
    return {"message": "VibeTrade API is running"}


@app.get("/health")
async def health():
    account = await trading_service.get_account() if trading_service.is_enabled() else None
    
    return {
        "status": "healthy",
        "finnhub_market_data": {
            "connected": len(finnhub_service.live_prices) > 0,
            "tracked_symbols": len(finnhub_service.live_prices),
            "note": "Finnhub used for all market data display"
        },
        "alpaca_trading": {
            "enabled": trading_service.is_enabled(),
            "paper_trading": trading_service.paper if trading_service.is_enabled() else None,
            "account_value": float(account["portfolio_value"]) if account else None,
            "note": "Alpaca used only for trading execution"
        }
    }

