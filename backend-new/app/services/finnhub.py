"""
Finnhub Market Data Service
Manages live crypto price streaming from Finnhub WebSocket API
"""
import asyncio
import os
import json
import logging
from typing import Dict, Optional, Set, Callable, Awaitable
from datetime import datetime
import time
import websockets
from websockets.client import WebSocketClientProtocol
from websockets.exceptions import InvalidStatus

logger = logging.getLogger(__name__)


class FinnhubMarketDataService:
    """
    Service to stream live crypto market data from Finnhub WebSocket API
    Supports real-time trade and quote data for cryptocurrencies
    """
    
    def __init__(self):
        self.api_key = os.getenv("FINNHUB_API_KEY")
        
        if not self.api_key:
            logger.warning("Finnhub API key not found, service will run in mock mode")
        
        # In-memory price storage: { "BTCUSDT": 98742.31, "ETHUSDT": 3500.50, ... }
        self.live_prices: Dict[str, float] = {}
        
        # Track subscribed symbols (crypto and stocks)
        self.crypto_symbols: Set[str] = set()
        self.stock_symbols: Set[str] = set()
        
        # Callback for price updates
        self.price_update_callbacks: list[Callable[[str, str, dict], Awaitable[None]]] = []
        
        # Store the FastAPI event loop for thread-safe callback execution
        self.fastapi_loop: Optional[asyncio.AbstractEventLoop] = None
        
        # WebSocket connection
        self.ws: Optional[WebSocketClientProtocol] = None
        self.ws_task: Optional[asyncio.Task] = None
        
        # Trade aggregation for bars
        # {symbol: {trades: [], last_bar_time: timestamp}}
        self.crypto_trade_aggregator: Dict[str, Dict] = {}
        
        self._running = False
        # Override injection for demos/debug
        self.override_prices: Dict[str, Dict[str, any]] = {}  # symbol -> {target_price, data_type, start_price, start_time, ramp_seconds}
        self.override_task: Optional[asyncio.Task] = None
        self.override_interval_seconds = 0.25
        self._last_subscribe_error: Dict[str, float] = {}
        
    def add_price_update_callback(self, callback: Callable[[str, str, dict], Awaitable[None]]):
        """Add a callback to be called when prices update"""
        self.price_update_callbacks.append(callback)
    
    async def _start_override_loop(self):
        """Continuously broadcast override prices for active scenarios"""
        if self.override_task and not self.override_task.done():
            return

        async def _loop():
            while self.override_prices:
                try:
                    now_ts = datetime.utcnow().timestamp()
                    for symbol, meta in list(self.override_prices.items()):
                        target = meta.get("target_price")
                        data_type = meta.get("data_type", "crypto")
                        start_price = meta.get("start_price", target)
                        start_time = meta.get("start_time", now_ts)
                        ramp_seconds = meta.get("ramp_seconds", 5.0)

                        elapsed = max(0.0, now_ts - start_time)
                        progress = min(1.0, elapsed / ramp_seconds) if ramp_seconds > 0 else 1.0
                        price = start_price + (target - start_price) * progress

                        # Update in-memory cache for both clean and USD/USDT variants
                        variants = [
                            symbol,
                            f"{symbol}USD",
                            f"{symbol}USDT",
                            f"{symbol}/USD"
                        ]
                        for variant in variants:
                            self.live_prices[variant] = price

                        # Broadcast synthetic trade to subscribers
                        trade_message = {
                            "type": "trade",
                            "data": {
                                "symbol": symbol,
                                "timestamp": int(now_ts),
                                "price": price,
                                "size": 0
                            }
                        }
                        await self._broadcast_update(data_type, symbol, trade_message)

                        # Broadcast synthetic bar for bar-driven charts
                        bar_message = {
                            "type": "bar",
                            "data": {
                                "symbol": symbol,
                                "timestamp": int(now_ts),
                                "open": price,
                                "high": price,
                                "low": price,
                                "close": price,
                                "volume": 0
                            }
                        }
                        await self._broadcast_update(data_type, symbol, bar_message)

                        # Persist ramp meta
                        meta["start_price"] = start_price
                        meta["start_time"] = start_time
                        meta["ramp_seconds"] = ramp_seconds

                    await asyncio.sleep(self.override_interval_seconds)
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Override loop error: {e}", exc_info=True)
                    await asyncio.sleep(self.override_interval_seconds)

        self.override_task = asyncio.create_task(_loop())

    async def set_override_price(self, symbol: str, target_price: float, data_type: str = "crypto", ramp_seconds: float = 20.0):
        """Enable persistent override for a symbol (crash/moon demos)"""
        clean = symbol.replace("USDT", "").replace("USD", "").replace("/", "").upper()
        # Use current price as start to ramp from wherever we are
        current = self.get_price(clean) or self.get_price(f"{clean}USD") or target_price
        self.override_prices[clean] = {
            "target_price": target_price,
            "data_type": data_type,
            "start_price": current,
            "start_time": datetime.utcnow().timestamp(),
            "ramp_seconds": ramp_seconds,
        }
        await self._start_override_loop()

    async def clear_override(self, symbol: Optional[str] = None):
        """Clear override for a symbol or all overrides"""
        if symbol:
            clean = symbol.replace("USDT", "").replace("USD", "").replace("/", "").upper()
            self.override_prices.pop(clean, None)
        else:
            self.override_prices.clear()

        if not self.override_prices and self.override_task:
            self.override_task.cancel()
            try:
                await self.override_task
            except asyncio.CancelledError:
                pass
            self.override_task = None
        
    def set_fastapi_loop(self, loop: asyncio.AbstractEventLoop):
        """Set the FastAPI event loop for thread-safe callback execution"""
        self.fastapi_loop = loop
        
    async def _handle_message(self, message: dict):
        """Handle incoming WebSocket message from Finnhub"""
        try:
            message_type = message.get("type")
            
            if message_type == "trade":
                # Trade data format: {"type":"trade","data":[{"s":"BINANCE:BTCUSDT","p":98742.31,"v":0.001,"t":1700000000000}]}
                trades = message.get("data", [])
                for trade in trades:
                    await self._handle_trade(trade)
            elif message_type == "ping":
                # Respond to ping with pong
                if self.ws:
                    await self.ws.send(json.dumps({"type": "pong"}))
            elif message_type == "error":
                logger.error(f"Finnhub WebSocket error: {message.get('msg', 'Unknown error')}")
        except Exception as e:
            logger.error(f"Error handling Finnhub message: {e}", exc_info=True)
    
    async def _handle_trade(self, trade: dict):
        """Handle incoming trade data and aggregate into bars"""
        try:
            # Finnhub format: {"s":"BINANCE:BTCUSDT","p":98742.31,"v":0.001,"t":1700000000000}
            # Or for stocks: {"s":"AAPL","p":178.50,"v":100,"t":1700000000000}
            symbol_full = trade.get("s", "")  # e.g., "BINANCE:BTCUSDT" or "AAPL"
            price = float(trade.get("p", 0))
            volume = float(trade.get("v", 0))
            timestamp_ms = int(trade.get("t", 0))

            if not symbol_full or price <= 0:
                return

            # NO LOGGING - trade data comes in constantly and spams logs
            
            # Determine if this is crypto or stock
            is_crypto = ":" in symbol_full or "BINANCE" in symbol_full.upper()
            data_type = "crypto" if is_crypto else "stocks"
            
            # Extract symbol
            if is_crypto:
                # Crypto: BINANCE:BTCUSDT -> BTCUSDT -> BTC
                symbol = symbol_full.split(":")[-1] if ":" in symbol_full else symbol_full
                clean_symbol = symbol.replace("USDT", "").replace("USD", "")
            else:
                # Stock: AAPL -> AAPL
                symbol = symbol_full
                clean_symbol = symbol

            # If an override is active for this symbol, ignore real ticks to avoid flicker
            clean_upper = clean_symbol.upper()
            if clean_upper in self.override_prices:
                return
            
            # Update in-memory price
            self.live_prices[clean_symbol] = price
            self.live_prices[symbol] = price  # Also store with suffix
            
            # Convert timestamp from milliseconds to seconds
            trade_timestamp = timestamp_ms // 1000
            
            # Initialize aggregator for this symbol if needed
            if clean_symbol not in self.crypto_trade_aggregator:
                self.crypto_trade_aggregator[clean_symbol] = {
                    "trades": [],
                    "last_bar_time": None
                }
            
            aggregator = self.crypto_trade_aggregator[clean_symbol]
            
            # Calculate 4-second bar timestamp (floor to nearest 4 seconds)
            bar_timestamp = (trade_timestamp // 4) * 4
            
            # If this is a new 4-second interval, emit the previous bar
            if aggregator["last_bar_time"] is not None and bar_timestamp > aggregator["last_bar_time"]:
                # Create bar from accumulated trades
                if aggregator["trades"]:
                    trades = aggregator["trades"]
                    prices = [t["price"] for t in trades]
                    volumes = [t["size"] for t in trades]
                    
                    bar_message = {
                        "type": "bar",
                        "data": {
                            "symbol": clean_symbol,
                            "timestamp": aggregator["last_bar_time"],
                            "open": trades[0]["price"],
                            "high": max(prices),
                            "low": min(prices),
                            "close": trades[-1]["price"],
                            "volume": sum(volumes)
                        }
                    }
                    
                    # Broadcast the 4-second bar
                    await self._broadcast_update(data_type, clean_symbol, bar_message)
                    
                    # Clear trades for new bar
                    aggregator["trades"] = []
            
            # Add current trade to aggregator
            aggregator["trades"].append({
                "price": price,
                "size": volume,
                "timestamp": trade_timestamp
            })
            
            # Update last_bar_time if this is a new interval or first trade
            if aggregator["last_bar_time"] is None or bar_timestamp > aggregator["last_bar_time"]:
                aggregator["last_bar_time"] = bar_timestamp
            
            # Send updated bar in real-time (every trade updates the current bar)
            if aggregator["trades"]:
                trades = aggregator["trades"]
                prices = [t["price"] for t in trades]
                volumes = [t["size"] for t in trades]
                
                bar_message = {
                    "type": "bar",
                    "data": {
                        "symbol": clean_symbol,
                        "timestamp": aggregator["last_bar_time"],
                        "open": trades[0]["price"],
                        "high": max(prices),
                        "low": min(prices),
                        "close": trades[-1]["price"],
                        "volume": sum(volumes)
                    }
                }
                
                # Broadcast updated bar in real-time
                await self._broadcast_update(data_type, clean_symbol, bar_message)
            
            # Also send individual trade for real-time price updates
            trade_message = {
                "type": "trade",
                "data": {
                    "symbol": clean_symbol,
                    "timestamp": trade_timestamp,
                    "price": price,
                    "size": volume
                }
            }
            
            # Broadcast trade
            await self._broadcast_update(data_type, clean_symbol, trade_message)
            
        except Exception as e:
            logger.error(f"Error handling trade: {e}", exc_info=True)
    
    async def _broadcast_update(self, data_type: str, symbol: str, message: dict):
        """Broadcast update to all registered callbacks"""
        if self.fastapi_loop and self.fastapi_loop.is_running():
            for callback in self.price_update_callbacks:
                try:
                    asyncio.run_coroutine_threadsafe(
                        callback(data_type, symbol, message),
                        self.fastapi_loop
                    )
                except Exception as e:
                    logger.error(f"Error scheduling price update callback: {e}", exc_info=True)
        else:
            # If no FastAPI loop, call directly (for testing)
            for callback in self.price_update_callbacks:
                try:
                    await callback(data_type, symbol, message)
                except Exception as e:
                    logger.error(f"Error in price update callback: {e}")
    
    async def _websocket_loop(self):
        """Main WebSocket connection loop"""
        if not self.api_key:
            logger.error("❌ FINNHUB_API_KEY not set, cannot connect to WebSocket")
            logger.error("   Market data will not be available. Please set FINNHUB_API_KEY in your .env file")
            logger.error("   Get a free API key at: https://finnhub.io/register")
            return

        ws_url = f"wss://ws.finnhub.io?token={self.api_key}"

        # Disable SSL verification for development (fixes macOS Python 3.13 SSL issues)
        import ssl
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE

        retry_count = 0
        max_retry_delay = 300  # Max 5 minutes
        base_delay = 5

        while self._running:
            try:
                logger.info(f"Connecting to Finnhub WebSocket: {ws_url}")
                async with websockets.connect(ws_url, ssl=ssl_context) as websocket:
                    self.ws = websocket
                    logger.info("Connected to Finnhub WebSocket")
                    retry_count = 0  # Reset retry count on successful connection
                    
                    # Resubscribe to all symbols
                    for symbol in self.crypto_symbols:
                        await self._subscribe_symbol(symbol, is_crypto=True)
                    for symbol in self.stock_symbols:
                        await self._subscribe_symbol(symbol, is_crypto=False)
                    
                    # Listen for messages
                    async for message in websocket:
                        try:
                            data = json.loads(message)
                            await self._handle_message(data)
                        except json.JSONDecodeError as e:
                            logger.error(f"Failed to parse WebSocket message: {e}")
                        except Exception as e:
                            logger.error(f"Error processing WebSocket message: {e}")
                            
            except InvalidStatus as e:
                # Handle HTTP 429 (rate limiting) and other HTTP errors
                status_code = getattr(e, 'status_code', None) or (str(e).split(':')[0] if ':' in str(e) else None)
                if status_code == 429 or "429" in str(e):
                    retry_count += 1
                    delay = min(base_delay * (2 ** retry_count), max_retry_delay)
                    logger.warning(f"⚠️  Finnhub rate limit (HTTP 429) - waiting {delay}s before retry (attempt {retry_count})")
                    logger.warning(f"   Finnhub has rate limits. Consider reducing subscription frequency or upgrading your plan.")
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"Finnhub WebSocket HTTP error: {e}")
                    retry_count += 1
                    delay = min(base_delay * (2 ** retry_count), max_retry_delay)
                    await asyncio.sleep(delay)
            except websockets.exceptions.ConnectionClosed:
                logger.warning("Finnhub WebSocket connection closed, reconnecting...")
                retry_count = 0  # Reset on normal disconnect
                await asyncio.sleep(base_delay)
            except Exception as e:
                logger.error(f"Finnhub WebSocket error: {e}", exc_info=True)
                retry_count += 1
                delay = min(base_delay * (2 ** retry_count), max_retry_delay)
                await asyncio.sleep(delay)
            finally:
                self.ws = None
    
    async def _subscribe_symbol(self, symbol: str, is_crypto: bool = True):
        """Subscribe to a symbol on Finnhub WebSocket"""
        if not self.ws:
            return
        
        # Convert symbol to Finnhub format
        finnhub_symbol = self._convert_to_finnhub_symbol(symbol, is_crypto=is_crypto)
        
        subscribe_msg = {
            "type": "subscribe",
            "symbol": finnhub_symbol
        }
        
        try:
            await self.ws.send(json.dumps(subscribe_msg))
            logger.info(f"Subscribed to Finnhub symbol: {finnhub_symbol} (original: {symbol}, crypto={is_crypto})")
        except Exception as e:
            now = time.time()
            last = self._last_subscribe_error.get(finnhub_symbol, 0)
            if now - last > 30:
                logger.error(f"Error subscribing to {finnhub_symbol}: {e}")
                self._last_subscribe_error[finnhub_symbol] = now
            else:
                logger.debug(f"Suppressed repeated subscribe error for {finnhub_symbol}: {e}")
    
    def _convert_to_finnhub_symbol(self, symbol: str, is_crypto: bool = True) -> str:
        """Convert symbol to Finnhub format"""
        clean = symbol.replace("USDT", "").replace("USD", "").replace("/", "").upper()
        
        if is_crypto:
            # Crypto: BTC -> BINANCE:BTCUSDT
            return f"BINANCE:{clean}USDT"
        else:
            # Stocks: AAPL -> AAPL (Finnhub uses direct symbol for stocks)
            return clean
    
    async def subscribe_crypto(self, symbols: list[str]):
        """Subscribe to crypto symbols"""
        if not self.api_key:
            logger.error("❌ Cannot subscribe: FINNHUB_API_KEY environment variable not set!")
            logger.error("   Please set FINNHUB_API_KEY in your .env file to enable market data streaming")
            logger.error("   Get a free API key at: https://finnhub.io/register")
            return
        
        # Normalize symbols
        normalized_symbols = []
        for symbol in symbols:
            clean = symbol.replace("USDT", "").replace("USD", "").replace("/", "").upper()
            normalized_symbols.append(clean)
        
        # Add to subscribed symbols
        self.crypto_symbols.update(normalized_symbols)
        
        # Subscribe via WebSocket if connected
        if self.ws:
            for symbol in normalized_symbols:
                await self._subscribe_symbol(symbol, is_crypto=True)
        
        # Start WebSocket if not running
        if not self._running:
            self._running = True
            if self.ws_task is None or self.ws_task.done():
                self.ws_task = asyncio.create_task(self._websocket_loop())
                logger.info("Started Finnhub WebSocket connection")
        
        logger.info(f"Subscribed to crypto symbols: {normalized_symbols}")
    
    async def subscribe_stocks(self, symbols: list[str]):
        """Subscribe to stock symbols"""
        if not self.api_key:
            logger.error("❌ Cannot subscribe: FINNHUB_API_KEY environment variable not set!")
            logger.error("   Please set FINNHUB_API_KEY in your .env file to enable market data streaming")
            logger.error("   Get a free API key at: https://finnhub.io/register")
            return
        
        # Normalize symbols (stocks are usually already clean like AAPL, TSLA)
        normalized_symbols = []
        for symbol in symbols:
            clean = symbol.replace("/", "").upper()
            normalized_symbols.append(clean)
        
        # Add to subscribed symbols
        self.stock_symbols.update(normalized_symbols)
        
        # Subscribe via WebSocket if connected
        if self.ws:
            for symbol in normalized_symbols:
                await self._subscribe_symbol(symbol, is_crypto=False)
        
        # Start WebSocket if not running
        if not self._running:
            self._running = True
            if self.ws_task is None or self.ws_task.done():
                self.ws_task = asyncio.create_task(self._websocket_loop())
                logger.info("Started Finnhub WebSocket connection")
        
        logger.info(f"Subscribed to stock symbols: {normalized_symbols}")
    
    def get_price(self, symbol: str) -> Optional[float]:
        """Get the current price for a symbol"""
        # Try exact match first
        if symbol in self.live_prices:
            return self.live_prices[symbol]
        
        # Try normalized version
        clean = symbol.replace("USDT", "").replace("USD", "").replace("/", "").upper()
        return self.live_prices.get(clean)
        
    def get_all_prices(self) -> Dict[str, float]:
        """Get all current prices"""
        return self.live_prices.copy()
    
    async def unsubscribe_crypto(self, symbols: list[str]):
        """Unsubscribe from crypto symbols"""
        normalized_symbols = []
        for symbol in symbols:
            clean = symbol.replace("USDT", "").replace("USD", "").replace("/", "").upper()
            normalized_symbols.append(clean)
        
        self.crypto_symbols.difference_update(normalized_symbols)
        
        # Unsubscribe via WebSocket if connected
        if self.ws:
            for symbol in normalized_symbols:
                finnhub_symbol = self._convert_to_finnhub_symbol(symbol, is_crypto=True)
                unsubscribe_msg = {
                    "type": "unsubscribe",
                    "symbol": finnhub_symbol
                }
                try:
                    await self.ws.send(json.dumps(unsubscribe_msg))
                    logger.info(f"Unsubscribed from Finnhub symbol: {finnhub_symbol}")
                except Exception as e:
                    logger.error(f"Error unsubscribing from {finnhub_symbol}: {e}")
        
        logger.info(f"Unsubscribed from crypto symbols: {normalized_symbols}")
    
    async def unsubscribe_stocks(self, symbols: list[str]):
        """Unsubscribe from stock symbols"""
        normalized_symbols = []
        for symbol in symbols:
            clean = symbol.replace("/", "").upper()
            normalized_symbols.append(clean)
        
        self.stock_symbols.difference_update(normalized_symbols)
        
        # Unsubscribe via WebSocket if connected
        if self.ws:
            for symbol in normalized_symbols:
                finnhub_symbol = self._convert_to_finnhub_symbol(symbol, is_crypto=False)
                unsubscribe_msg = {
                    "type": "unsubscribe",
                    "symbol": finnhub_symbol
                }
                try:
                    await self.ws.send(json.dumps(unsubscribe_msg))
                    logger.info(f"Unsubscribed from Finnhub symbol: {finnhub_symbol}")
                except Exception as e:
                    logger.error(f"Error unsubscribing from {finnhub_symbol}: {e}")
        
        logger.info(f"Unsubscribed from stock symbols: {normalized_symbols}")
    
    async def stop(self):
        """Stop all data streams"""
        logger.info("Stopping Finnhub market data service")
        self._running = False
        
        if self.ws:
            try:
                await self.ws.close()
            except Exception as e:
                logger.error(f"Error closing WebSocket: {e}")
        
        if self.ws_task and not self.ws_task.done():
            self.ws_task.cancel()
            try:
                await self.ws_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Finnhub market data service stopped")


# Global service instance
finnhub_service = FinnhubMarketDataService()


async def get_btc_data() -> Dict[str, any]:
    """
    Get current BTC price data from Finnhub WebSocket via FastAPI (SOURCE OF TRUTH).
    Used by Data Ingest Worker to populate database.

    Returns:
        {
            "btc_price": float,
            "price_change_24h": float (percentage),
            "volume_24h": str (formatted),
            "price_high_24h": float,
            "price_low_24h": float
        }
    """
    import httpx
    import os

    # Prefer live price directly from Finnhub service to avoid HTTP dependency
    btc_price = finnhub_service.get_price("BTC") or finnhub_service.get_price("BTCUSD")
    if btc_price is None:
        logger.error("❌ BTC price not available from Finnhub live cache. Is Finnhub WebSocket connected and subscribed?")
        raise ValueError("BTC price not available from Finnhub.")

    logger.info(f"✅ Got BTC price from Finnhub service: ${btc_price:,.2f}")

    # For MVP: Return live price with estimated 24h values
    # TODO: Track historical data to calculate real 24h change, high, low, volume
    return {
        "btc_price": round(btc_price, 2),
        "price_change_24h": 0.0,  # TODO: Calculate from historical data
        "volume_24h": "$0",  # TODO: Aggregate from trade volumes
        "price_high_24h": round(btc_price, 2),  # TODO: Track 24h high
        "price_low_24h": round(btc_price, 2)  # TODO: Track 24h low
    }
