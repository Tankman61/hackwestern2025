"""
Market Data WebSocket Manager
Handles WebSocket connections from frontend and broadcasts live price updates
"""
import asyncio
from typing import Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging
import json

from app.services.finnhub import finnhub_service
# Note: Alpaca is only used for trading, not market data display

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
        logger.info(f"📥 Subscribe request: data_type={data_type}, symbols={symbols}")
        
        if websocket not in self.connection_symbols:
            self.connection_symbols[websocket] = set()
        
        # Normalize symbols (remove any /USD or USD suffixes for storage)
        normalized_symbols = []
        for s in symbols:
            clean_s = s.replace("/USD", "").replace("USD", "").replace("/", "")
            normalized_symbols.append(clean_s)
            logger.info(f"   Normalized symbol: '{s}' -> '{clean_s}'")
            
        self.connection_symbols[websocket].update(normalized_symbols)
        logger.info(f"   Connection now subscribed to: {self.connection_symbols[websocket]}")
        
        # Subscribe to Finnhub for all market data display
        if data_type == "crypto":
            await finnhub_service.subscribe_crypto(normalized_symbols)
        elif data_type in ["stocks", "etfs", "options"]:
            # Use Finnhub for stocks/etfs/options display too
            # Note: Alpaca is only used for actual trading execution
            await finnhub_service.subscribe_stocks(normalized_symbols)
            
        logger.info(f"✅ Subscribed {data_type} connection to symbols: {normalized_symbols}")
        
        # Send confirmation
        await websocket.send_json({
            "type": "subscribed",
            "symbols": normalized_symbols
        })
        
    async def unsubscribe(self, websocket: WebSocket, symbols: list[str]):
        """Unsubscribe a connection from specific symbols"""
        if websocket in self.connection_symbols:
            self.connection_symbols[websocket].difference_update(symbols)
            
    async def broadcast_to_subscribers(self, data_type: str, symbol: str, message: dict):
        """Broadcast message to all connections subscribed to this symbol"""
        disconnected = set()
        
        # Log every message for debugging
        logger.info(f"🌐 Broadcasting {data_type} message for symbol '{symbol}' to {len(self.active_connections[data_type])} connections")
        
        # Normalize the incoming symbol for comparison
        # BTCUSD -> BTC, BTC/USD -> BTC, BTC -> BTC
        def normalize_symbol(s: str) -> str:
            # Remove /USD first, then remove USD suffix, then remove any remaining /
            normalized = s.replace("/USD", "").replace("/", "")
            # Remove USD suffix if present (e.g., BTCUSD -> BTC)
            if normalized.endswith("USD"):
                normalized = normalized[:-3]
            return normalized.upper()
        
        normalized_incoming = normalize_symbol(symbol)
        logger.info(f"   Normalized incoming symbol: '{symbol}' -> '{normalized_incoming}'")
        
        messages_sent = 0
        for websocket in self.active_connections[data_type]:
            # Check if this connection is subscribed to this symbol
            subscribed_symbols = self.connection_symbols.get(websocket, set())
            logger.info(f"   Checking connection with subscribed symbols: {subscribed_symbols}")
            
            # Check if any subscribed symbol matches (normalized)
            should_send = False
            for sub_symbol in subscribed_symbols:
                normalized_sub = normalize_symbol(sub_symbol)
                logger.info(f"      Comparing: '{normalized_incoming}' == '{normalized_sub}' (from '{sub_symbol}')")
                if normalized_incoming == normalized_sub:
                    should_send = True
                    logger.info(f"      ✅ Symbol match found: '{normalized_incoming}' == '{normalized_sub}'")
                    break
            
            # Also check direct match
            if not should_send:
                should_send = symbol in subscribed_symbols or normalized_incoming in subscribed_symbols
                if should_send:
                    logger.info(f"      ✅ Direct symbol match found")
            
            if should_send:
                try:
                    await websocket.send_json(message)
                    messages_sent += 1
                    logger.info(f"      ✅ Message sent to WebSocket")
                except Exception as e:
                    logger.error(f"      ❌ Error sending to WebSocket: {e}")
                    disconnected.add(websocket)
            else:
                logger.info(f"      ⏭️  Skipping - no symbol match")
                    
        logger.info(f"   📊 Sent {messages_sent} message(s) to {len(self.active_connections[data_type])} connection(s)")
        
        # Clean up disconnected websockets
        for ws in disconnected:
            self.disconnect(ws, data_type)


# Global connection manager
manager = ConnectionManager()


# Register callback with market data services to broadcast price updates
async def broadcast_price_update(data_type: str, symbol: str, message: dict):
    """Callback for market data services to broadcast price updates"""
    logger.info(f"🔥 broadcast_price_update called! type={data_type}, symbol={symbol}, message={message}")
    logger.info(f"🔥 Active connections for {data_type}: {len(manager.active_connections[data_type])}")
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
    """Get all current prices from memory (Finnhub for display)"""
    return {
        "prices": finnhub_service.get_all_prices()
    }


@router.get("/api/prices/{symbol}")
async def get_symbol_price(symbol: str):
    """Get current price for a specific symbol (from Finnhub)"""
    symbol_upper = symbol.upper()
    price = finnhub_service.get_price(symbol_upper)
    
    if price is None:
        return {"error": "Symbol not found or not subscribed"}, 404
    return {
        "symbol": symbol_upper,
        "price": price
    }
