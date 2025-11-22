"""
Alpaca Market Data Service
Manages live price streaming from Alpaca API and maintains current prices in memory
"""
import asyncio
import os
from typing import Dict, Optional, Set, Callable, Awaitable
from datetime import datetime
import logging
import httpx

from alpaca.data.live import StockDataStream, CryptoDataStream
from alpaca.data.models import Bar, Trade, Quote
from alpaca.data.historical import CryptoHistoricalDataClient, StockHistoricalDataClient
from alpaca.data.requests import CryptoBarsRequest, StockBarsRequest
from alpaca.data.timeframe import TimeFrame

logger = logging.getLogger(__name__)


class AlpacaMarketDataService:
    """
    Service to stream live market data from Alpaca and maintain current prices
    Supports both crypto and stock data streams
    """
    
    def __init__(self):
        self.api_key = os.getenv("ALPACA_API_KEY")
        self.secret_key = os.getenv("ALPACA_SECRET_KEY")
        
        if not self.api_key or not self.secret_key:
            logger.warning("Alpaca API keys not found, service will run in mock mode")
        
        # In-memory price storage: { "BTCUSD": 98742.31, "AAPL": 178.50, ... }
        self.live_prices: Dict[str, float] = {}
        
        # Track subscribed symbols per data type
        self.crypto_symbols: Set[str] = set()
        self.stock_symbols: Set[str] = set()
        
        # Callback for price updates
        self.price_update_callbacks: list[Callable[[str, str, dict], Awaitable[None]]] = []
        
        # Store the FastAPI event loop for thread-safe callback execution
        self.fastapi_loop: Optional[asyncio.AbstractEventLoop] = None
        
        # Trade aggregation for 4-second bars
        # {symbol: {trades: [], last_bar_time: timestamp}}
        self.crypto_trade_aggregator: Dict[str, Dict] = {}
        self.stock_trade_aggregator: Dict[str, Dict] = {}
        
        # Data streams
        self.crypto_stream: Optional[CryptoDataStream] = None
        self.stock_stream: Optional[StockDataStream] = None
        
        # Stream tasks
        self.crypto_task: Optional[asyncio.Task] = None
        self.stock_task: Optional[asyncio.Task] = None
        self.crypto_poll_task: Optional[asyncio.Task] = None
        
        # Historical data clients for fallback polling
        self.crypto_hist_client: Optional[CryptoHistoricalDataClient] = None
        self.stock_hist_client: Optional[StockHistoricalDataClient] = None
        
        self._running = False
        
    def add_price_update_callback(self, callback: Callable[[str, str, dict], Awaitable[None]]):
        """Add a callback to be called when prices update"""
        self.price_update_callbacks.append(callback)
        
    def set_fastapi_loop(self, loop: asyncio.AbstractEventLoop):
        """Set the FastAPI event loop for thread-safe callback execution"""
        self.fastapi_loop = loop
        
    async def _handle_crypto_bar(self, bar: Bar):
        """Handle incoming crypto bar data - DISABLED for fastest updates (using trades only)"""
        # Skipping 1-minute bars - we generate 4-second bars from trades for faster updates
        pass
                
    async def _handle_crypto_trade(self, trade: Trade):
        """Handle incoming crypto trade data - aggregates into 4-second bars"""
        symbol = trade.symbol.replace("/", "")
        price = float(trade.price)
        trade_timestamp = int(trade.timestamp.timestamp())
        
        # Update in-memory price
        self.live_prices[symbol] = price
        
        # Initialize aggregator for this symbol if needed
        if symbol not in self.crypto_trade_aggregator:
            self.crypto_trade_aggregator[symbol] = {
                "trades": [],
                "last_bar_time": None
            }
        
        aggregator = self.crypto_trade_aggregator[symbol]
        
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
                        "symbol": symbol,
                        "timestamp": aggregator["last_bar_time"],
                        "open": trades[0]["price"],
                        "high": max(prices),
                        "low": min(prices),
                        "close": trades[-1]["price"],
                        "volume": sum(volumes)
                    }
                }
                
                # Broadcast the 4-second bar (no logging for performance)
                if self.fastapi_loop and self.fastapi_loop.is_running():
                    for callback in self.price_update_callbacks:
                        try:
                            asyncio.run_coroutine_threadsafe(
                                callback("crypto", symbol, bar_message),
                                self.fastapi_loop
                            )
                        except Exception as e:
                            logger.error(f"Error scheduling price update callback: {e}", exc_info=True)
                
                # Clear trades for new bar
                aggregator["trades"] = []
            else:
                # No trades in this interval - create a bar from the last known price
                if symbol in self.live_prices:
                    last_price = self.live_prices[symbol]
                    bar_message = {
                        "type": "bar",
                        "data": {
                            "symbol": symbol,
                            "timestamp": aggregator["last_bar_time"],
                            "open": last_price,
                            "high": last_price,
                            "low": last_price,
                            "close": last_price,
                            "volume": 0
                        }
                    }
                    # Send bar with last known price (no logging)
                    if self.fastapi_loop and self.fastapi_loop.is_running():
                        for callback in self.price_update_callbacks:
                            try:
                                asyncio.run_coroutine_threadsafe(
                                    callback("crypto", symbol, bar_message),
                                    self.fastapi_loop
                                )
                            except Exception as e:
                                logger.error(f"Error scheduling price update callback: {e}", exc_info=True)
        
        # Add current trade to aggregator
        aggregator["trades"].append({
            "price": price,
            "size": float(trade.size) if trade.size else 0,
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
                    "symbol": symbol,
                    "timestamp": aggregator["last_bar_time"],
                    "open": trades[0]["price"],
                    "high": max(prices),
                    "low": min(prices),
                    "close": trades[-1]["price"],
                    "volume": sum(volumes)
                }
            }
            
            # Broadcast updated bar in real-time
            if not self.fastapi_loop:
                logger.warning(f"FastAPI loop not set for crypto bar update: {symbol}")
            elif not self.fastapi_loop.is_running():
                logger.warning(f"FastAPI loop not running for crypto bar update: {symbol}")
            elif not self.price_update_callbacks:
                logger.warning(f"No price update callbacks registered for crypto bar: {symbol}")
            else:
                for callback in self.price_update_callbacks:
                    try:
                        asyncio.run_coroutine_threadsafe(
                            callback("crypto", symbol, bar_message),
                            self.fastapi_loop
                        )
                    except Exception as e:
                        logger.error(f"Error scheduling crypto bar callback: {e}", exc_info=True)
        
        # Also send individual trade for real-time price updates
        trade_message = {
            "type": "trade",
            "data": {
                "symbol": symbol,
                "timestamp": trade_timestamp,
                "price": price,
                "size": float(trade.size) if trade.size else 0
            }
        }
        
        # Broadcast trade (for real-time price display and chart updates)
        # No logging - just send the data
        if self.fastapi_loop and self.fastapi_loop.is_running():
            for callback in self.price_update_callbacks:
                try:
                    asyncio.run_coroutine_threadsafe(
                        callback("crypto", symbol, trade_message),
                        self.fastapi_loop
                    )
                except Exception as e:
                    logger.error(f"Error scheduling price update callback: {e}", exc_info=True)
                
    async def _handle_stock_bar(self, bar: Bar):
        """Handle incoming stock bar data - DISABLED for fastest updates (using trades only)"""
        # Skipping 1-minute bars - we generate 4-second bars from trades for faster updates
        pass
                
    async def _handle_stock_trade(self, trade: Trade):
        """Handle incoming stock trade data - aggregates into 4-second bars"""
        symbol = trade.symbol
        price = float(trade.price)
        trade_timestamp = int(trade.timestamp.timestamp())
        
        # Update in-memory price
        self.live_prices[symbol] = price
        
        # Initialize aggregator for this symbol if needed
        if symbol not in self.stock_trade_aggregator:
            self.stock_trade_aggregator[symbol] = {
                "trades": [],
                "last_bar_time": None
            }
        
        aggregator = self.stock_trade_aggregator[symbol]
        
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
                        "symbol": symbol,
                        "timestamp": aggregator["last_bar_time"],
                        "open": trades[0]["price"],
                        "high": max(prices),
                        "low": min(prices),
                        "close": trades[-1]["price"],
                        "volume": sum(volumes)
                    }
                }
                
                # Broadcast the 4-second bar
                if self.fastapi_loop and self.fastapi_loop.is_running():
                    for callback in self.price_update_callbacks:
                        try:
                            asyncio.run_coroutine_threadsafe(
                                callback("stocks", symbol, bar_message),
                                self.fastapi_loop
                            )
                        except Exception as e:
                            logger.error(f"Error scheduling price update callback: {e}", exc_info=True)
                
                # Clear trades for new bar
                aggregator["trades"] = []
        
        # Add current trade to aggregator
        aggregator["trades"].append({
            "price": price,
            "size": float(trade.size) if trade.size else 0,
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
                    "symbol": symbol,
                    "timestamp": aggregator["last_bar_time"],
                    "open": trades[0]["price"],
                    "high": max(prices),
                    "low": min(prices),
                    "close": trades[-1]["price"],
                    "volume": sum(volumes)
                }
            }
            
            # Broadcast updated bar in real-time
            if not self.fastapi_loop:
                logger.warning(f"FastAPI loop not set for stock bar update: {symbol}")
            elif not self.fastapi_loop.is_running():
                logger.warning(f"FastAPI loop not running for stock bar update: {symbol}")
            elif not self.price_update_callbacks:
                logger.warning(f"No price update callbacks registered for stock bar: {symbol}")
            else:
                for callback in self.price_update_callbacks:
                    try:
                        asyncio.run_coroutine_threadsafe(
                            callback("stocks", symbol, bar_message),
                            self.fastapi_loop
                        )
                    except Exception as e:
                        logger.error(f"Error scheduling stock bar callback: {e}", exc_info=True)
        
        # Also send individual trade for real-time price updates
        trade_message = {
            "type": "trade",
            "data": {
                "symbol": symbol,
                "timestamp": trade_timestamp,
                "price": price,
                "size": float(trade.size) if trade.size else 0
            }
        }
        
        # Broadcast trade (for real-time price display)
        if self.fastapi_loop and self.fastapi_loop.is_running():
            for callback in self.price_update_callbacks:
                try:
                    asyncio.run_coroutine_threadsafe(
                        callback("stocks", symbol, trade_message),
                        self.fastapi_loop
                    )
                except Exception as e:
                    logger.error(f"Error scheduling price update callback: {e}", exc_info=True)
                
    async def subscribe_crypto(self, symbols: list[str]):
        """Subscribe to crypto symbols"""
        if not self.api_key or not self.secret_key:
            logger.warning("Cannot subscribe: Alpaca API keys not configured")
            return
        
        # Convert symbols to Alpaca format (BTC -> BTC/USD)
        formatted_symbols = []
        for symbol in symbols:
            # Remove /USD if already present, then add it back
            clean_symbol = symbol.replace("/USD", "").replace("USD", "")
            formatted_symbols.append(f"{clean_symbol}/USD")
            
        # Initialize crypto stream if not already done
        if self.crypto_stream is None:
            try:
                logger.info(f"Initializing crypto stream for symbols: {formatted_symbols}")
                self.crypto_stream = CryptoDataStream(
                    api_key=self.api_key,
                    secret_key=self.secret_key
                )
                
                logger.info("Crypto stream created, subscribing to trades only (fastest updates)")
                # Subscribe only to trades - we'll generate 4-second bars from trades for fastest updates
                # Skip 1-minute bars as they're slower (60 seconds vs 4 seconds)
                self.crypto_stream.subscribe_trades(self._handle_crypto_trade, *formatted_symbols)
                
                # Track subscribed symbols
                self.crypto_symbols.update(formatted_symbols)
                logger.info(f"Subscribed to symbols, starting stream in background thread...")
                
                # Start stream in a separate thread since it manages its own event loop
                if self.crypto_task is None or self.crypto_task.done():
                    import threading
                    def run_stream():
                        try:
                            import asyncio
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                            loop.run_until_complete(self.crypto_stream._run_forever())
                        except Exception as e:
                            logger.error(f"Crypto stream thread error: {e}")
                    
                    thread = threading.Thread(target=run_stream, daemon=True)
                    thread.start()
                    logger.info(f"Started crypto stream in background thread")
                    
                    # Also start polling as fallback (in case WebSocket doesn't deliver data)
                    if self.crypto_poll_task is None or self.crypto_poll_task.done():
                        self.crypto_poll_task = asyncio.create_task(self._poll_crypto_prices())
                        logger.info("Started crypto price polling as fallback")
                
            except Exception as e:
                logger.error(f"Error initializing crypto stream: {e}")
                import traceback
                traceback.print_exc()
                return
            
        else:
            # Subscribe to new symbols on existing stream
            try:
                # Only subscribe to trades for fastest updates
                self.crypto_stream.subscribe_trades(self._handle_crypto_trade, *formatted_symbols)
                self.crypto_symbols.update(formatted_symbols)
            except Exception as e:
                logger.error(f"Error subscribing to crypto symbols: {e}")
                return
            
        logger.info(f"Subscribed to crypto symbols: {formatted_symbols}")
        
    async def subscribe_stocks(self, symbols: list[str]):
        """Subscribe to stock symbols"""
        if not self.api_key or not self.secret_key:
            logger.warning("Cannot subscribe: Alpaca API keys not configured")
            return
            
        # Initialize stock stream if not already done
        if self.stock_stream is None:
            try:
                logger.info(f"Initializing stock stream for symbols: {symbols}")
                self.stock_stream = StockDataStream(
                    api_key=self.api_key,
                    secret_key=self.secret_key
                )
                
                logger.info("Stock stream created, subscribing to trades only (fastest updates)")
                # Subscribe only to trades - we'll generate 4-second bars from trades for fastest updates
                # Skip 1-minute bars as they're slower (60 seconds vs 4 seconds)
                self.stock_stream.subscribe_trades(self._handle_stock_trade, *symbols)
                
                # Track subscribed symbols
                self.stock_symbols.update(symbols)
                logger.info(f"Subscribed to symbols, starting stream in background thread...")
                
                # Start stream in a separate thread since it manages its own event loop
                if self.stock_task is None or self.stock_task.done():
                    import threading
                    def run_stream():
                        try:
                            import asyncio
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                            loop.run_until_complete(self.stock_stream._run_forever())
                        except Exception as e:
                            logger.error(f"Stock stream thread error: {e}")
                    
                    thread = threading.Thread(target=run_stream, daemon=True)
                    thread.start()
                    logger.info(f"Started stock stream in background thread")
                
            except Exception as e:
                logger.error(f"Error initializing stock stream: {e}")
                import traceback
                traceback.print_exc()
                return
            
        else:
            # Subscribe to new symbols on existing stream
            try:
                # Only subscribe to trades for fastest updates
                self.stock_stream.subscribe_trades(self._handle_stock_trade, *symbols)
                self.stock_symbols.update(symbols)
            except Exception as e:
                logger.error(f"Error subscribing to stock symbols: {e}")
                return
            
        logger.info(f"Subscribed to stock symbols: {symbols}")
        

            
    def get_price(self, symbol: str) -> Optional[float]:
        """Get the current price for a symbol"""
        return self.live_prices.get(symbol)
        
    def get_all_prices(self) -> Dict[str, float]:
        """Get all current prices"""
        return self.live_prices.copy()
        
    async def unsubscribe_crypto(self, symbols: list[str]):
        """Unsubscribe from crypto symbols"""
        if self.crypto_stream:
            self.crypto_stream.unsubscribe_bars(*symbols)
            self.crypto_stream.unsubscribe_trades(*symbols)
            self.crypto_symbols.difference_update(symbols)
            logger.info(f"Unsubscribed from crypto symbols: {symbols}")
            
    async def unsubscribe_stocks(self, symbols: list[str]):
        """Unsubscribe from stock symbols"""
        if self.stock_stream:
            self.stock_stream.unsubscribe_bars(*symbols)
            self.stock_stream.unsubscribe_trades(*symbols)
            self.stock_symbols.difference_update(symbols)
            logger.info(f"Unsubscribed from stock symbols: {symbols}")
    
    async def _poll_crypto_prices(self):
        """Poll crypto prices via REST API as fallback when WebSocket doesn't deliver data"""
        logger.info("Starting crypto price polling")
        
        # Initialize historical data client
        if self.crypto_hist_client is None:
            self.crypto_hist_client = CryptoHistoricalDataClient(
                api_key=self.api_key,
                secret_key=self.secret_key
            )
        
        while True:
            try:
                if not self.crypto_symbols:
                    logger.debug("No crypto symbols to poll, waiting...")
                    await asyncio.sleep(5)
                    continue
                
                logger.info(f"Polling prices for symbols: {list(self.crypto_symbols)}")
                
                # Get latest bars for all subscribed symbols
                symbols_list = list(self.crypto_symbols)
                
                request_params = CryptoBarsRequest(
                    symbol_or_symbols=symbols_list,
                    timeframe=TimeFrame.Minute,
                    limit=1
                )
                
                bars = self.crypto_hist_client.get_crypto_bars(request_params)
                logger.info(f"Received bars: {bars}")
                
                # Process bars and broadcast
                # BarSet has a .data attribute which is a dict
                if hasattr(bars, 'data'):
                    bars_dict = bars.data
                else:
                    bars_dict = bars
                
                for symbol in symbols_list:
                    if symbol in bars_dict:
                        bar_list = bars_dict[symbol]
                        if bar_list and len(bar_list) > 0:
                            latest_bar = bar_list[-1]
                            price = float(latest_bar.close)
                            clean_symbol = symbol.replace("/", "")
                            
                            logger.info(f"Price for {clean_symbol}: ${price}")
                            
                            # Update in-memory price
                            self.live_prices[clean_symbol] = price
                            
                            # Create message for frontend
                            message = {
                                "type": "bar",
                                "data": {
                                    "symbol": clean_symbol,
                                    "timestamp": int(latest_bar.timestamp.timestamp()),
                                    "open": float(latest_bar.open),
                                    "high": float(latest_bar.high),
                                    "low": float(latest_bar.low),
                                    "close": price,
                                    "volume": float(latest_bar.volume) if latest_bar.volume else 0
                                }
                            }
                            
                            logger.info(f"Broadcasting message to {len(self.price_update_callbacks)} callbacks")
                            
                            # Broadcast to all registered callbacks
                            for callback in self.price_update_callbacks:
                                try:
                                    await callback("crypto", clean_symbol, message)
                                except Exception as e:
                                    logger.error(f"Error in price update callback: {e}")
                        else:
                            logger.warning(f"No bars found for {symbol}")
                    else:
                        logger.warning(f"Symbol {symbol} not in bars data: {list(bars_dict.keys())}")
                
                # Poll every 1 second for faster updates
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.error(f"Error polling crypto prices: {e}")
                import traceback
                traceback.print_exc()
                await asyncio.sleep(5)
            
    async def stop(self):
        """Stop all data streams"""
        logger.info("Stopping Alpaca market data service")
        self._running = False
        
        # Cancel polling task if it exists
        if self.crypto_poll_task and not self.crypto_poll_task.done():
            self.crypto_poll_task.cancel()
            try:
                await self.crypto_poll_task
            except asyncio.CancelledError:
                pass
        
        # Close streams - they run in separate threads/loops, so we can't await them directly
        # The streams are running in daemon threads with their own event loops
        # We'll just set them to None and let the threads exit naturally
        # Since they're daemon threads, they'll be cleaned up when the process exits
        if self.crypto_stream:
            logger.info("Stopping crypto stream (running in separate thread)")
            # Don't try to await close() - it's in a different event loop
            # Just set to None and let the daemon thread exit
            self.crypto_stream = None
            
        if self.stock_stream:
            logger.info("Stopping stock stream (running in separate thread)")
            # Don't try to await close() - it's in a different event loop
            self.stock_stream = None
        
        # Tasks are in separate threads, so we can't cancel them from here
        # They'll be cleaned up when the threads exit
        
        logger.info("Alpaca market data service stopped")


# Global service instance
alpaca_service = AlpacaMarketDataService()
