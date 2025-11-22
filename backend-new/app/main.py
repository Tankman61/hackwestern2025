"""
FastAPI main application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="VibeTrade API",
    description="Agentic Risk Terminal Backend",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import routers
# from app.api import portfolio, orders, market_data, websocket

# Register routers
# app.include_router(portfolio.router, prefix="/api", tags=["portfolio"])
# app.include_router(orders.router, prefix="/api", tags=["orders"])
# app.include_router(market_data.router, prefix="/api", tags=["market"])
# app.include_router(websocket.router, prefix="/ws", tags=["websocket"])

@app.get("/")
async def root():
    return {"message": "VibeTrade API is running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
