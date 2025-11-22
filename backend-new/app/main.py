"""
FastAPI main application entry point
"""
import os
from dotenv import load_dotenv

# Load environment variables FIRST, before importing services
load_dotenv()

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.services.finnhub import finnhub_service
from app.services.alpaca_trading import trading_service  # Alpaca only for trading, not market data
from app.api.market_websocket import router as market_ws_router, broadcast_price_update
from app.api.trading import router as trading_router
from app.api.portfolio import router as portfolio_router
from app.api.orders import router as orders_router
from app.api.market_data import router as market_data_router
from app.api.debug import router as debug_router
from app.api.agent import router as agent_router
from app.api.voice_websocket import router as voice_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Silence noisy loggers
logging.getLogger("app.services.finnhub").setLevel(logging.ERROR)
logging.getLogger("app.api.market_websocket").setLevel(logging.ERROR)
logging.getLogger("httpx").setLevel(logging.WARNING)


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

    # Auto-subscribe to BTC on startup (for agent to work without frontend)
    await finnhub_service.subscribe_crypto(["BTC", "ETH"])
    logger.info("Finnhub market data service initialized (all market data display)")
    logger.info("Auto-subscribed to BTC and ETH for agent access")
    
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

# CORS middleware - allow requests from frontend
# Note: When allow_credentials=True, you cannot use "*" for origins
# IMPORTANT: CORS middleware must be added BEFORE exception handlers
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],
    expose_headers=["*"],
)

# Exception handlers to ensure CORS headers are added to error responses
# These must be registered AFTER CORS middleware but BEFORE routers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )
    # Add CORS headers to error responses
    origin = request.headers.get("origin")
    if origin and origin in ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"]:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    return response

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    response = JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )
    # Add CORS headers to error responses
    origin = request.headers.get("origin")
    if origin and origin in ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"]:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    return response

# Register routers
app.include_router(market_ws_router, tags=["market-data"])
app.include_router(trading_router, prefix="/api", tags=["trading"])
app.include_router(portfolio_router, prefix="/api", tags=["portfolio"])
app.include_router(orders_router, prefix="/api", tags=["orders"])
app.include_router(market_data_router, prefix="/api", tags=["market"])
app.include_router(agent_router, tags=["agent"])  # LangGraph agent chat
app.include_router(voice_router, tags=["voice"])  # Voice WebSocket for STT/TTS
app.include_router(debug_router, tags=["debug"])  # Debug endpoints for testing crashes

@app.get("/")
async def root():
    return {"message": "VibeTrade API is running"}


@app.get("/health")
async def health():
    account = await trading_service.get_account() if trading_service.is_enabled() else None
    
    # Check if Finnhub API key is configured
    finnhub_configured = finnhub_service.api_key is not None
    finnhub_connected = finnhub_service.ws is not None and finnhub_service._running
    
    return {
        "status": "healthy",
        "finnhub_market_data": {
            "configured": finnhub_configured,
            "connected": finnhub_connected,
            "tracked_symbols": len(finnhub_service.live_prices),
            "subscribed_crypto": list(finnhub_service.crypto_symbols),
            "subscribed_stocks": list(finnhub_service.stock_symbols),
            "note": "Finnhub used for all market data display",
            "warning": "FINNHUB_API_KEY not set" if not finnhub_configured else None
        },
        "alpaca_trading": {
            "enabled": trading_service.is_enabled(),
            "paper_trading": trading_service.paper if trading_service.is_enabled() else None,
            "account_value": float(account["portfolio_value"]) if account else None,
            "note": "Alpaca used only for trading execution"
        }
    }

