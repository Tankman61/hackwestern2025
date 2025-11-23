"""
Alpaca Trading Service
Handles paper trading operations: orders, positions, account management
"""
import os
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging

from alpaca.trading.client import TradingClient
from alpaca.trading.requests import (
    MarketOrderRequest,
    LimitOrderRequest,
    StopOrderRequest,
    StopLimitOrderRequest,
    GetOrdersRequest,
)
from alpaca.trading.enums import OrderSide, TimeInForce, OrderType, QueryOrderStatus
from alpaca.data.models import Bar, Trade

logger = logging.getLogger(__name__)


class AlpacaTradingService:
    """
    Service for Alpaca paper trading operations
    Provides order placement, position tracking, and account management
    """
    
    def __init__(self):
        self.api_key = os.getenv("ALPACA_API_KEY")
        self.secret_key = os.getenv("ALPACA_SECRET_KEY")
        self.paper = os.getenv("ALPACA_PAPER_TRADING", "true").lower() == "true"

        print("API KEY IS:", self.api_key)
        print("SECRET KEY IS:", self.secret_key)
        print("PAPER IS:", self.paper)
        
        if not self.api_key or not self.secret_key:
            logger.warning("Alpaca API keys not found, trading service disabled")
            self.client = None
            return
        
        try:
            self.client = TradingClient(
                api_key=self.api_key,
                secret_key=self.secret_key,
                paper=self.paper
            )
            logger.info(f"Alpaca trading client initialized (paper={self.paper})")
        except Exception as e:
            logger.error(f"Failed to initialize Alpaca trading client: {e}")
            self.client = None
    
    def is_enabled(self) -> bool:
        """Check if trading service is enabled"""
        return self.client is not None
    
    # ========== ACCOUNT MANAGEMENT ==========
    
    async def get_account(self) -> Optional[Dict[str, Any]]:
        """
        Get account information
        Returns account equity, buying power, cash, etc.
        """
        if not self.client:
            logger.warning("Trading client not initialized")
            raise ValueError("Trading client not initialized")
        
        try:
            print("Client is:", self.client)
            account = self.client.get_account()
            print("Account is:", account)
            return {
                "id": account.id,
                "account_number": account.account_number,
                "status": account.status.value,
                "currency": account.currency,
                "cash": float(account.cash),
                "portfolio_value": float(account.portfolio_value),
                "buying_power": float(account.buying_power),
                "equity": float(account.equity),
                "last_equity": float(account.last_equity),
                "multiplier": account.multiplier,
                "initial_margin": float(account.initial_margin),
                "maintenance_margin": float(account.maintenance_margin),
                "daytrade_count": account.daytrade_count,
                "daytrading_buying_power": float(account.daytrading_buying_power),
                "regt_buying_power": float(account.regt_buying_power),
                "pattern_day_trader": account.pattern_day_trader,
                "trading_blocked": account.trading_blocked,
                "transfers_blocked": account.transfers_blocked,
                "account_blocked": account.account_blocked,
                "created_at": account.created_at.isoformat() if account.created_at else None,
            }
        except Exception as e:
            logger.error(f"Error getting account: {e}")
            print("ERROR GETTING ACCOUNT:", e)
            raise ValueError(f"Failed to fetch account information: {e}")
    
    # ========== POSITIONS ==========
    
    async def get_positions(self) -> List[Dict[str, Any]]:
        """
        Get all open positions
        Returns list of positions with P&L calculated
        """
        if not self.client:
            return []
        
        try:
            positions = self.client.get_all_positions()
            result = []
            
            for pos in positions:
                result.append({
                    "asset_id": pos.asset_id,
                    "symbol": pos.symbol,
                    "exchange": pos.exchange.value if pos.exchange else None,
                    "asset_class": pos.asset_class.value,
                    "avg_entry_price": float(pos.avg_entry_price),
                    "qty": float(pos.qty),
                    "qty_available": float(pos.qty_available) if pos.qty_available else float(pos.qty),
                    "side": "LONG" if float(pos.qty) > 0 else "SHORT",
                    "market_value": float(pos.market_value),
                    "cost_basis": float(pos.cost_basis),
                    "unrealized_pl": float(pos.unrealized_pl),
                    "unrealized_plpc": float(pos.unrealized_plpc),
                    "unrealized_intraday_pl": float(pos.unrealized_intraday_pl),
                    "unrealized_intraday_plpc": float(pos.unrealized_intraday_plpc),
                    "current_price": float(pos.current_price),
                    "lastday_price": float(pos.lastday_price),
                    "change_today": float(pos.change_today),
                })
            
            return result
        except Exception as e:
            logger.error(f"Error getting positions: {e}")
            return []
    
    async def get_position(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific position by symbol
        """
        if not self.client:
            return None
        
        try:
            pos = self.client.get_open_position(symbol)
            return {
                "asset_id": pos.asset_id,
                "symbol": pos.symbol,
                "exchange": pos.exchange.value if pos.exchange else None,
                "asset_class": pos.asset_class.value,
                "avg_entry_price": float(pos.avg_entry_price),
                "qty": float(pos.qty),
                "qty_available": float(pos.qty_available) if pos.qty_available else float(pos.qty),
                "side": "LONG" if float(pos.qty) > 0 else "SHORT",
                "market_value": float(pos.market_value),
                "cost_basis": float(pos.cost_basis),
                "unrealized_pl": float(pos.unrealized_pl),
                "unrealized_plpc": float(pos.unrealized_plpc),
                "unrealized_intraday_pl": float(pos.unrealized_intraday_pl),
                "unrealized_intraday_plpc": float(pos.unrealized_intraday_plpc),
                "current_price": float(pos.current_price),
                "lastday_price": float(pos.lastday_price),
                "change_today": float(pos.change_today),
            }
        except Exception as e:
            logger.error(f"Error getting position {symbol}: {e}")
            return None
    
    async def close_position(self, symbol: str, qty: Optional[float] = None) -> bool:
        """
        Close a position (full or partial)
        If qty is None, closes entire position
        """
        if not self.client:
            return False
        
        try:
            if qty:
                self.client.close_position(symbol, close_options={"qty": str(qty)})
            else:
                self.client.close_position(symbol)
            logger.info(f"Closed position {symbol} (qty={qty or 'all'})")
            return True
        except Exception as e:
            logger.error(f"Error closing position {symbol}: {e}")
            return False
    
    # ========== ORDERS ==========
    
    async def place_market_order(
        self,
        symbol: str,
        qty: float,
        side: str,
        time_in_force: str = "gtc"
    ) -> Optional[Dict[str, Any]]:
        """
        Place a market order
        
        Args:
            symbol: Trading symbol (e.g., "AAPL", "BTC/USD")
            qty: Quantity to trade
            side: "buy" or "sell"
            time_in_force: "day", "gtc", "ioc", "fok"
        """
        if not self.client:
            error_msg = "Trading client not initialized - check Alpaca API keys"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        try:
            # Normalize symbol for Alpaca (remove / and convert to uppercase)
            alpaca_symbol = symbol.replace("/", "").replace("-", "").upper()
            
            order_side = OrderSide.BUY if side.lower() == "buy" else OrderSide.SELL
            tif = TimeInForce[time_in_force.upper()]
            
            order_data = MarketOrderRequest(
                symbol=alpaca_symbol,
                qty=qty,
                side=order_side,
                time_in_force=tif
            )
            
            order = self.client.submit_order(order_data)
            logger.info(f"Market order placed: {side} {qty} {alpaca_symbol}")
            
            return self._format_order(order)
        except Exception as e:
            error_str = str(e)
            # Parse Alpaca API errors for better user messages
            if "insufficient balance" in error_str.lower() or "40310000" in error_str:
                # Extract balance info from error message using regex
                import re
                try:
                    available_match = re.search(r'"available":"([\d.]+)"', error_str)
                    requested_match = re.search(r'"requested":"([\d.]+)"', error_str)
                    
                    if available_match and requested_match:
                        available = float(available_match.group(1))
                        requested = float(requested_match.group(1))
                        error_msg = f"Insufficient balance: Requested ${requested:,.2f}, Available ${available:,.2f}. Please reduce order size."
                    else:
                        error_msg = f"Insufficient balance: {error_str}"
                except:
                    error_msg = f"Insufficient balance: {error_str}"
            else:
                error_msg = f"Error placing market order for {alpaca_symbol}: {error_str}"
            
            logger.error(error_msg, exc_info=True)
            raise RuntimeError(error_msg) from e
    
    async def place_limit_order(
        self,
        symbol: str,
        qty: float,
        side: str,
        limit_price: float,
        time_in_force: str = "gtc"
    ) -> Optional[Dict[str, Any]]:
        """
        Place a limit order
        
        Args:
            symbol: Trading symbol
            qty: Quantity to trade
            side: "buy" or "sell"
            limit_price: Limit price
            time_in_force: "day", "gtc", "ioc", "fok"
        """
        if not self.client:
            error_msg = "Trading client not initialized - check Alpaca API keys"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        try:
            # Normalize symbol for Alpaca (remove / and convert to uppercase)
            alpaca_symbol = symbol.replace("/", "").replace("-", "").upper()
            
            order_side = OrderSide.BUY if side.lower() == "buy" else OrderSide.SELL
            tif = TimeInForce[time_in_force.upper()]
            
            order_data = LimitOrderRequest(
                symbol=alpaca_symbol,
                qty=qty,
                side=order_side,
                time_in_force=tif,
                limit_price=limit_price
            )
            
            order = self.client.submit_order(order_data)
            logger.info(f"Limit order placed: {side} {qty} {alpaca_symbol} @ ${limit_price}")
            
            return self._format_order(order)
        except Exception as e:
            error_str = str(e)
            # Parse Alpaca API errors for better user messages
            if "insufficient balance" in error_str.lower() or "40310000" in error_str:
                # Extract balance info from error message using regex
                import re
                try:
                    available_match = re.search(r'"available":"([\d.]+)"', error_str)
                    requested_match = re.search(r'"requested":"([\d.]+)"', error_str)
                    
                    if available_match and requested_match:
                        available = float(available_match.group(1))
                        requested = float(requested_match.group(1))
                        error_msg = f"Insufficient balance: Requested ${requested:,.2f}, Available ${available:,.2f}. Please reduce order size."
                    else:
                        error_msg = f"Insufficient balance: {error_str}"
                except:
                    error_msg = f"Insufficient balance: {error_str}"
            else:
                error_msg = f"Error placing limit order for {alpaca_symbol}: {error_str}"
            
            logger.error(error_msg, exc_info=True)
            raise RuntimeError(error_msg) from e
    
    async def place_stop_order(
        self,
        symbol: str,
        qty: float,
        side: str,
        stop_price: float,
        time_in_force: str = "gtc"
    ) -> Optional[Dict[str, Any]]:
        """
        Place a stop order
        """
        if not self.client:
            error_msg = "Trading client not initialized - check Alpaca API keys"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        try:
            # Normalize symbol for Alpaca (remove / and convert to uppercase)
            alpaca_symbol = symbol.replace("/", "").replace("-", "").upper()
            
            order_side = OrderSide.BUY if side.lower() == "buy" else OrderSide.SELL
            tif = TimeInForce[time_in_force.upper()]
            
            order_data = StopOrderRequest(
                symbol=alpaca_symbol,
                qty=qty,
                side=order_side,
                time_in_force=tif,
                stop_price=stop_price
            )
            
            order = self.client.submit_order(order_data)
            logger.info(f"Stop order placed: {side} {qty} {alpaca_symbol} @ ${stop_price}")
            
            return self._format_order(order)
        except Exception as e:
            error_str = str(e)
            # Parse Alpaca API errors for better user messages
            if "insufficient balance" in error_str.lower() or "40310000" in error_str:
                # Extract balance info from error message using regex
                import re
                try:
                    available_match = re.search(r'"available":"([\d.]+)"', error_str)
                    requested_match = re.search(r'"requested":"([\d.]+)"', error_str)
                    
                    if available_match and requested_match:
                        available = float(available_match.group(1))
                        requested = float(requested_match.group(1))
                        error_msg = f"Insufficient balance: Requested ${requested:,.2f}, Available ${available:,.2f}. Please reduce order size."
                    else:
                        error_msg = f"Insufficient balance: {error_str}"
                except:
                    error_msg = f"Insufficient balance: {error_str}"
            else:
                error_msg = f"Error placing stop order for {alpaca_symbol}: {error_str}"
            
            logger.error(error_msg, exc_info=True)
            raise RuntimeError(error_msg) from e
    
    async def place_stop_limit_order(
        self,
        symbol: str,
        qty: float,
        side: str,
        stop_price: float,
        limit_price: float,
        time_in_force: str = "gtc"
    ) -> Optional[Dict[str, Any]]:
        """
        Place a stop-limit order
        """
        if not self.client:
            return None
        
        try:
            order_side = OrderSide.BUY if side.lower() == "buy" else OrderSide.SELL
            tif = TimeInForce[time_in_force.upper()]
            
            order_data = StopLimitOrderRequest(
                symbol=symbol,
                qty=qty,
                side=order_side,
                time_in_force=tif,
                stop_price=stop_price,
                limit_price=limit_price
            )
            
            order = self.client.submit_order(order_data)
            logger.info(f"Stop-limit order placed: {side} {qty} {symbol} stop=${stop_price} limit=${limit_price}")
            
            return self._format_order(order)
        except Exception as e:
            logger.error(f"Error placing stop-limit order: {e}")
            return None
    
    async def get_orders(
        self,
        status: str = "open",
        limit: int = 100,
        symbols: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Get orders
        
        Args:
            status: "open", "closed", "all"
            limit: Max number of orders to return
            symbols: Filter by symbols
        """
        if not self.client:
            return []
        
        try:
            # Map status to QueryOrderStatus
            status_map = {
                "open": QueryOrderStatus.OPEN,
                "closed": QueryOrderStatus.CLOSED,
                "all": QueryOrderStatus.ALL
            }
            
            request = GetOrdersRequest(
                status=status_map.get(status, QueryOrderStatus.OPEN),
                limit=limit,
                symbols=symbols
            )
            
            orders = self.client.get_orders(filter=request)
            return [self._format_order(order) for order in orders]
        except Exception as e:
            logger.error(f"Error getting orders: {e}")
            return []
    
    async def get_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific order by ID"""
        if not self.client:
            return None
        
        try:
            order = self.client.get_order_by_id(order_id)
            return self._format_order(order)
        except Exception as e:
            logger.error(f"Error getting order {order_id}: {e}")
            return None
    
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel an order"""
        if not self.client:
            return False
        
        try:
            self.client.cancel_order_by_id(order_id)
            logger.info(f"Cancelled order {order_id}")
            return True
        except Exception as e:
            logger.error(f"Error cancelling order {order_id}: {e}")
            return False
    
    async def cancel_all_orders(self) -> bool:
        """Cancel all open orders"""
        if not self.client:
            return False
        
        try:
            self.client.cancel_orders()
            logger.info("Cancelled all orders")
            return True
        except Exception as e:
            logger.error(f"Error cancelling all orders: {e}")
            return False
    
    # ========== HELPER METHODS ==========
    
    def _format_order(self, order) -> Dict[str, Any]:
        """Format order object to dict"""
        return {
            "id": order.id,
            "client_order_id": order.client_order_id,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "updated_at": order.updated_at.isoformat() if order.updated_at else None,
            "submitted_at": order.submitted_at.isoformat() if order.submitted_at else None,
            "filled_at": order.filled_at.isoformat() if order.filled_at else None,
            "expired_at": order.expired_at.isoformat() if order.expired_at else None,
            "canceled_at": order.canceled_at.isoformat() if order.canceled_at else None,
            "failed_at": order.failed_at.isoformat() if order.failed_at else None,
            "replaced_at": order.replaced_at.isoformat() if order.replaced_at else None,
            "replaced_by": order.replaced_by,
            "replaces": order.replaces,
            "asset_id": order.asset_id,
            "symbol": order.symbol,
            "asset_class": order.asset_class.value,
            "notional": float(order.notional) if order.notional else None,
            "qty": float(order.qty) if order.qty else None,
            "filled_qty": float(order.filled_qty),
            "filled_avg_price": float(order.filled_avg_price) if order.filled_avg_price else None,
            "order_class": order.order_class.value if order.order_class else None,
            "order_type": order.order_type.value,
            "type": order.type.value,
            "side": order.side.value,
            "time_in_force": order.time_in_force.value,
            "limit_price": float(order.limit_price) if order.limit_price else None,
            "stop_price": float(order.stop_price) if order.stop_price else None,
            "status": order.status.value,
            "extended_hours": order.extended_hours,
            "legs": order.legs,
            "trail_percent": float(order.trail_percent) if order.trail_percent else None,
            "trail_price": float(order.trail_price) if order.trail_price else None,
            "hwm": float(order.hwm) if order.hwm else None,
        }
    
    def calculate_pnl(
        self,
        side: str,
        qty: float,
        entry_price: float,
        current_price: float
    ) -> Dict[str, float]:
        """
        Calculate P&L for a position
        
        Returns:
            {
                "pnl": absolute P&L,
                "pnl_percent": percentage P&L
            }
        """
        if side.upper() == "LONG":
            pnl = qty * (current_price - entry_price)
        else:  # SHORT
            pnl = qty * (entry_price - current_price)
        
        pnl_percent = (pnl / (qty * entry_price)) * 100 if entry_price > 0 else 0
        
        return {
            "pnl": pnl,
            "pnl_percent": pnl_percent
        }


# Global trading service instance
trading_service = AlpacaTradingService()
