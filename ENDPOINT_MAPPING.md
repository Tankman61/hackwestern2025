# Endpoint Mapping: Frontend ↔ Backend

## ✅ Trading Functionality Mapping

### Frontend → Backend Endpoints

#### **TradingTab Component** (`/components/tabs/TradingTab.tsx`)
- **Place Market Order**: `api.createOrder()` → `POST /api/orders`
  - Sends: `{ ticker: "BTC/USD", side: "BUY"/"SELL", order_type: "MARKET", amount: number }`
  - Backend: `orders.py` → `trading_service.place_market_order()`
  - **Status**: ✅ Connected

- **Place Stop Loss Order:
  - Sends: `{ ticker: "BTC/USD", side: "SELL"/"BUY", order_type: "STOP_LOSS", amount: number, limit_price: stopLossPrice }`
  - Backend: `orders.py` → `trading_service.place_stop_order()`
  - **Status**: ✅ Connected (now implemented)

- **Place Take Profit**:
  - Sends: `{ ticker: "BTC/USD", side: "SELL"/"BUY", order_type: "LIMIT", amount: number, limit_price: takeProfitPrice }`
  - Backend: `orders.py` → `trading_service.place_limit_order()`
  - **Status**: ✅ Connected (now implemented)

#### **PortfolioTab Component** (`/components/tabs/PortfolioTab.tsx`)
- **Get Portfolio**: `api.getPortfolio()` → `GET /api/portfolio`
  - Backend: `portfolio.py` → `trading_service.get_account()`
  - **Status**: ✅ Connected

- **Get Positions**: `api.getPositions()` → `GET /api/positions`
  - Backend: `portfolio.py` → `trading_service.get_positions()`
  - Returns: Array of positions with live P&L
  - **Status**: ✅ Connected

- **Get Orders**: `api.getOrders()` → `GET /api/orders`
  - Backend: `orders.py` → `trading_service.get_orders()`
  - **Status**: ✅ Connected

- **Cancel Order**: `api.cancelOrder(orderId)` → `DELETE /api/orders/{order_id}`
  - Backend: `orders.py` → `trading_service.cancel_order()`
  - **Status**: ✅ Connected

#### **HistoryTab Component** (`/components/tabs/HistoryTab.tsx`)
- **Get Trade History**: `api.getHistory()` → `GET /api/history`
  - Backend: `portfolio.py` → `trading_service.get_orders(status="closed")`
  - **Status**: ✅ Connected

## 📋 Backend Endpoints Summary

### Trading Router (`trading.py`) - `/api` prefix
- `GET /api/account` - Account information
- `GET /api/positions` - All positions (with live prices)
- `GET /api/positions/{symbol}` - Specific position
- `DELETE /api/positions/{symbol}` - Close position
- `POST /api/orders/market` - Market order
- `POST /api/orders/limit` - Limit order
- `POST /api/orders/stop` - Stop order
- `POST /api/orders/stop-limit` - Stop-limit order
- `GET /api/orders` - Get orders (with filters)
- `GET /api/orders/{order_id}` - Get specific order
- `DELETE /api/orders/{order_id}` - Cancel order
- `DELETE /api/orders` - Cancel all orders
- `GET /api/trading/status` - Trading service status

### Portfolio Router (`portfolio.py`) - `/api` prefix
- `GET /api/portfolio` - Portfolio summary
- `GET /api/positions` - Positions (formatted)
- `PATCH /api/positions/{symbol}` - Adjust position
- `POST /api/positions/{symbol}/close` - Close position
- `GET /api/history` - Trade history

### Orders Router (`orders.py`) - `/api` prefix
- `GET /api/orders` - Get orders (legacy format)
- `POST /api/orders` - Create order (legacy format) ✅ **USED BY FRONTEND**
- `DELETE /api/orders/{order_id}` - Cancel order ✅ **USED BY FRONTEND**

## 🔄 Symbol Format Conversion

**Frontend Format**: `BTC-USD` or `BTC/USD`
**Backend Format**: `BTC/USD` (normalized from `BTC-USD`)

**Conversion**: 
- Frontend API client normalizes: `BTC-USD` → `BTC/USD`
- Backend `orders.py` normalizes: `BTC/USD` → `BTCUSD` (for Alpaca)
- Backend formats back: `BTCUSD` → `BTC/USD` (for frontend)

## ✅ Implementation Status

### Completed ✅
1. ✅ TradingTab places market orders
2. ✅ TradingTab places stop loss orders (new)
3. ✅ TradingTab places take profit orders (new)
4. ✅ PortfolioTab displays positions and orders
5. ✅ PortfolioTab can cancel orders
6. ✅ HistoryTab displays trade history
7. ✅ Symbol format conversion working
8. ✅ API error handling with toast notifications

### Flow Verification
1. User fills TradingTab form → Clicks "Open Long/Short Position"
2. Frontend sends `POST /api/orders` with market order
3. Backend receives → Calls `trading_service.place_market_order()`
4. Alpaca executes order → Returns order details
5. Frontend shows success toast
6. PortfolioTab auto-refreshes → Shows new position/order
7. Order appears in Alpaca paper trading account

## 🎯 Next Steps (if needed)
- [ ] Add order confirmation dialog
- [ ] Show order status updates in real-time
- [ ] Add position closing from PortfolioTab
- [ ] Add order modification capability

