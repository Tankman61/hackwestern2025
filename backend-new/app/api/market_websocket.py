"""
Market Data WebSocket Manager
Handles WebSocket connections from frontend and broadcasts live price updates
"""
import asyncio
from typing import Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging
import json

from app.services.alpaca import alpaca_service

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections and symbol subscriptions for each data type"""
    
    def __init__(self):
        # Active connections per data type: { "crypto": {websocket1, websocket2}, "stocks": {...} }
        self.active_connections: Dict[str, Set[WebSocket]] = {
            "crypto": set(),
            "stocks": set(),
            "etfs": set(),
            "options": set()
        }
        
        # Track which symbols each connection is interested in
        # { websocket: {"BTC", "ETH"} }
        self.connection_symbols: Dict[WebSocket, Set[str]] = {}
        
    async def connect(self, websocket: WebSocket, data_type: str):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections[data_type].add(websocket)
        self.connection_symbols[websocket] = set()
        logger.info(f"New {data_type} WebSocket connection. Total: {len(self.active_connections[data_type])}")
        
    def disconnect(self, websocket: WebSocket, data_type: str):
        """Remove WebSocket connection"""
        self.active_connections[data_type].discard(websocket)
        self.connection_symbols.pop(websocket, None)
        logger.info(f"{data_type} WebSocket disconnected. Total: {len(self.active_connections[data_type])}")
        
    async def subscribe(self, websocket: WebSocket, data_type: str, symbols: list[str]):
        """Subscribe a connection to specific symbols"""
        if websocket not in self.connection_symbols:
            self.connection_symbols[websocket] = set()
            
        self.connection_symbols[websocket].update(symbols)
        
        # Subscribe to Alpaca for these symbols if not already subscribed
        if data_type == "crypto":
            # Convert to Alpaca format (BTC/USD)
            alpaca_symbols = [f"{s}/USD" if "/" not in s else s for s in symbols]
            await alpaca_service.subscribe_crypto(alpaca_symbols)
        elif data_type == "stocks":
            await alpaca_service.subscribe_stocks(symbols)
            
        logger.info(f"Subscribed {data_type} connection to symbols: {symbols}")
        
        # Send confirmation
        await websocket.send_json({
            "type": "subscribed",
            "symbols": symbols
        })
        
    async def unsubscribe(self, websocket: WebSocket, symbols: list[str]):
        """Unsubscribe a connection from specific symbols"""
        if websocket in self.connection_symbols:
            self.connection_symbols[websocket].difference_update(symbols)
            
    async def broadcast_to_subscribers(self, data_type: str, symbol: str, message: dict):
        """Broadcast message to all connections subscribed to this symbol"""
        disconnected = set()
        
        for websocket in self.active_connections[data_type]:
            # Check if this connection is subscribed to this symbol
            subscribed_symbols = self.connection_symbols.get(websocket, set())
            
            # Clean symbol for comparison (remove /USD etc)
            clean_symbol = symbol.replace("/USD", "").replace("/", "")
            
            if clean_symbol in subscribed_symbols or symbol in subscribed_symbols:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending to WebSocket: {e}")
                    disconnected.add(websocket)
                    
        # Clean up disconnected websockets
        for ws in disconnected:
            self.disconnect(ws, data_type)


# Global connection manager
manager = ConnectionManager()


# Register callback with Alpaca service to broadcast price updates
async def broadcast_price_update(data_type: str, symbol: str, message: dict):
    """Callback for Alpaca service to broadcast price updates"""
    await manager.broadcast_to_subscribers(data_type, symbol, message)


# WebSocket endpoints for each data type
@router.websocket("/ws/alpaca/crypto")
async def websocket_crypto(websocket: WebSocket):
    """WebSocket endpoint for crypto price streaming"""
    await manager.connect(websocket, "crypto")
    
    try:
        # Send welcome message
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to crypto price stream"
        })
        
        while True:
            # Receive messages from frontend
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("action") == "subscribe":
                symbols = message.get("symbols", [])
                await manager.subscribe(websocket, "crypto", symbols)
                
            elif message.get("action") == "unsubscribe":
                symbols = message.get("symbols", [])
                await manager.unsubscribe(websocket, symbols)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, "crypto")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, "crypto")


@router.websocket("/ws/alpaca/stocks")
async def websocket_stocks(websocket: WebSocket):
    """WebSocket endpoint for stock price streaming"""
    await manager.connect(websocket, "stocks")
    
    try:
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to stocks price stream"
        })
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("action") == "subscribe":
                symbols = message.get("symbols", [])
                await manager.subscribe(websocket, "stocks", symbols)
                
            elif message.get("action") == "unsubscribe":
                symbols = message.get("symbols", [])
                await manager.unsubscribe(websocket, symbols)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, "stocks")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, "stocks")


@router.websocket("/ws/alpaca/etfs")
async def websocket_etfs(websocket: WebSocket):
    """WebSocket endpoint for ETF price streaming"""
    await manager.connect(websocket, "etfs")
    
    try:
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to ETFs price stream"
        })
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("action") == "subscribe":
                symbols = message.get("symbols", [])
                # ETFs use stock data
                await manager.subscribe(websocket, "stocks", symbols)
                
            elif message.get("action") == "unsubscribe":
                symbols = message.get("symbols", [])
                await manager.unsubscribe(websocket, symbols)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, "etfs")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, "etfs")


@router.websocket("/ws/alpaca/options")
async def websocket_options(websocket: WebSocket):
    """WebSocket endpoint for options price streaming"""
    await manager.connect(websocket, "options")
    
    try:
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to options price stream"
        })
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("action") == "subscribe":
                symbols = message.get("symbols", [])
                # Options use stock data
                await manager.subscribe(websocket, "stocks", symbols)
                
            elif message.get("action") == "unsubscribe":
                symbols = message.get("symbols", [])
                await manager.unsubscribe(websocket, symbols)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, "options")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, "options")


# REST endpoint to get current prices
@router.get("/api/prices")
async def get_current_prices():
    """Get all current prices from memory"""
    return {
        "prices": alpaca_service.get_all_prices()
    }


@router.get("/api/prices/{symbol}")
async def get_symbol_price(symbol: str):
    """Get current price for a specific symbol"""
    price = alpaca_service.get_price(symbol.upper())
    if price is None:
        return {"error": "Symbol not found or not subscribed"}, 404
    return {
        "symbol": symbol.upper(),
        "price": price
    }
