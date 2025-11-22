"""
Alpaca Market Data Service
Manages live price streaming from Alpaca API and maintains current prices in memory
"""
import asyncio
import os
from typing import Dict, Optional, Set, Callable, Awaitable
from datetime import datetime
import logging

from alpaca.data.live import StockDataStream, CryptoDataStream
from alpaca.data.models import Bar, Trade, Quote

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
        
        # Data streams
        self.crypto_stream: Optional[CryptoDataStream] = None
        self.stock_stream: Optional[StockDataStream] = None
        
        # Stream tasks
        self.crypto_task: Optional[asyncio.Task] = None
        self.stock_task: Optional[asyncio.Task] = None
        
        self._running = False
        
    def add_price_update_callback(self, callback: Callable[[str, str, dict], Awaitable[None]]):
        """Add a callback to be called when prices update"""
        self.price_update_callbacks.append(callback)
        
    async def _handle_crypto_bar(self, bar: Bar):
        """Handle incoming crypto bar data"""
        symbol = bar.symbol.replace("/", "")  # BTCUSD instead of BTC/USD
        price = float(bar.close)
        
        # Update in-memory price
        self.live_prices[symbol] = price
        
        # Create message for frontend
        message = {
            "type": "bar",
            "data": {
                "symbol": symbol,
                "timestamp": int(bar.timestamp.timestamp()),
                "open": float(bar.open),
                "high": float(bar.high),
                "low": float(bar.low),
                "close": float(bar.close),
                "volume": float(bar.volume) if bar.volume else 0
            }
        }
        
        # Broadcast to all registered callbacks
        for callback in self.price_update_callbacks:
            try:
                await callback("crypto", symbol, message)
            except Exception as e:
                logger.error(f"Error in price update callback: {e}")
                
    async def _handle_crypto_trade(self, trade: Trade):
        """Handle incoming crypto trade data"""
        symbol = trade.symbol.replace("/", "")
        price = float(trade.price)
        
        # Update in-memory price
        self.live_prices[symbol] = price
        
        message = {
            "type": "trade",
            "data": {
                "symbol": symbol,
                "timestamp": int(trade.timestamp.timestamp()),
                "price": price,
                "size": float(trade.size)
            }
        }
        
        for callback in self.price_update_callbacks:
            try:
                await callback("crypto", symbol, message)
            except Exception as e:
                logger.error(f"Error in price update callback: {e}")
                
    async def _handle_stock_bar(self, bar: Bar):
        """Handle incoming stock bar data"""
        symbol = bar.symbol
        price = float(bar.close)
        
        self.live_prices[symbol] = price
        
        message = {
            "type": "bar",
            "data": {
                "symbol": symbol,
                "timestamp": int(bar.timestamp.timestamp()),
                "open": float(bar.open),
                "high": float(bar.high),
                "low": float(bar.low),
                "close": float(bar.close),
                "volume": float(bar.volume) if bar.volume else 0
            }
        }
        
        for callback in self.price_update_callbacks:
            try:
                await callback("stocks", symbol, message)
            except Exception as e:
                logger.error(f"Error in price update callback: {e}")
                
    async def _handle_stock_trade(self, trade: Trade):
        """Handle incoming stock trade data"""
        symbol = trade.symbol
        price = float(trade.price)
        
        self.live_prices[symbol] = price
        
        message = {
            "type": "trade",
            "data": {
                "symbol": symbol,
                "timestamp": int(trade.timestamp.timestamp()),
                "price": price,
                "size": float(trade.size)
            }
        }
        
        for callback in self.price_update_callbacks:
            try:
                await callback("stocks", symbol, message)
            except Exception as e:
                logger.error(f"Error in price update callback: {e}")
                
    async def subscribe_crypto(self, symbols: list[str]):
        """Subscribe to crypto symbols"""
        if not self.api_key or not self.secret_key:
            logger.warning("Cannot subscribe: Alpaca API keys not configured")
            return
            
        # Initialize crypto stream if not already done
        if self.crypto_stream is None:
            self.crypto_stream = CryptoDataStream(
                api_key=self.api_key,
                secret_key=self.secret_key
            )
            
            # Register handlers
            self.crypto_stream.subscribe_bars(self._handle_crypto_bar, *symbols)
            self.crypto_stream.subscribe_trades(self._handle_crypto_trade, *symbols)
            
        else:
            # Subscribe to new symbols
            self.crypto_stream.subscribe_bars(self._handle_crypto_bar, *symbols)
            self.crypto_stream.subscribe_trades(self._handle_crypto_trade, *symbols)
        
        # Track subscribed symbols
        self.crypto_symbols.update(symbols)
        
        # Start stream if not running
        if self.crypto_task is None or self.crypto_task.done():
            self.crypto_task = asyncio.create_task(self._run_crypto_stream())
            
        logger.info(f"Subscribed to crypto symbols: {symbols}")
        
    async def subscribe_stocks(self, symbols: list[str]):
        """Subscribe to stock symbols"""
        if not self.api_key or not self.secret_key:
            logger.warning("Cannot subscribe: Alpaca API keys not configured")
            return
            
        # Initialize stock stream if not already done
        if self.stock_stream is None:
            self.stock_stream = StockDataStream(
                api_key=self.api_key,
                secret_key=self.secret_key
            )
            
            # Register handlers
            self.stock_stream.subscribe_bars(self._handle_stock_bar, *symbols)
            self.stock_stream.subscribe_trades(self._handle_stock_trade, *symbols)
            
        else:
            # Subscribe to new symbols
            self.stock_stream.subscribe_bars(self._handle_stock_bar, *symbols)
            self.stock_stream.subscribe_trades(self._handle_stock_trade, *symbols)
        
        # Track subscribed symbols
        self.stock_symbols.update(symbols)
        
        # Start stream if not running
        if self.stock_task is None or self.stock_task.done():
            self.stock_task = asyncio.create_task(self._run_stock_stream())
            
        logger.info(f"Subscribed to stock symbols: {symbols}")
        
    async def _run_crypto_stream(self):
        """Run the crypto data stream"""
        try:
            logger.info("Starting Alpaca crypto data stream")
            await self.crypto_stream.run()
        except Exception as e:
            logger.error(f"Crypto stream error: {e}")
            
    async def _run_stock_stream(self):
        """Run the stock data stream"""
        try:
            logger.info("Starting Alpaca stock data stream")
            await self.stock_stream.run()
        except Exception as e:
            logger.error(f"Stock stream error: {e}")
            
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
            
    async def stop(self):
        """Stop all data streams"""
        logger.info("Stopping Alpaca market data service")
        self._running = False
        
        if self.crypto_stream:
            await self.crypto_stream.close()
            
        if self.stock_stream:
            await self.stock_stream.close()
            
        if self.crypto_task:
            self.crypto_task.cancel()
            
        if self.stock_task:
            self.stock_task.cancel()


# Global service instance
alpaca_service = AlpacaMarketDataService()
