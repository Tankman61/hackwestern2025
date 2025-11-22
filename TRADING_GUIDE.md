# Alpaca Paper Trading Integration

## Overview

Complete paper trading implementation using Alpaca's trading API. Place real orders, track positions, and manage your portfolio without risking real money.

## Features

✅ **Order Placement**

- Market orders (instant execution)
- Limit orders (execute at specific price)
- Stop orders (trigger at stop price)
- Stop-limit orders (trigger stop, execute limit)

✅ **Position Management**

- View all open positions
- Real-time P&L calculation with live prices
- Close positions (full or partial)
- Track entry price, current price, and returns

✅ **Order Management**

- View open, closed, or all orders
- Cancel individual orders
- Cancel all orders at once
- Track order status and fills

✅ **Account Information**

- Portfolio value
- Buying power
- Cash balance
- P&L tracking

## Backend API

### Account Endpoints

**GET `/api/account`**
Get account information

```bash
curl http://localhost:8000/api/account
```

Response:

```json
{
  "id": "...",
  "portfolio_value": 100000.0,
  "buying_power": 100000.0,
  "cash": 100000.0,
  "equity": 100000.0,
  "status": "ACTIVE",
  "currency": "USD"
}
```

### Position Endpoints

**GET `/api/positions`**
Get all open positions

```bash
curl http://localhost:8000/api/positions
```

Response:

```json
{
  "positions": [
    {
      "symbol": "AAPL",
      "qty": 10,
      "side": "LONG",
      "avg_entry_price": 175.5,
      "current_price": 178.5,
      "market_value": 1785.0,
      "unrealized_pl": 30.0,
      "unrealized_plpc": 1.71,
      "live_price": 178.52,
      "live_pnl": 30.2,
      "live_pnl_percent": 1.72
    }
  ]
}
```

**GET `/api/positions/{symbol}`**
Get specific position

```bash
curl http://localhost:8000/api/positions/AAPL
```

**DELETE `/api/positions/{symbol}`**
Close position

```bash
# Close entire position
curl -X DELETE http://localhost:8000/api/positions/AAPL

# Close partial position
curl -X DELETE http://localhost:8000/api/positions/AAPL \
  -H "Content-Type: application/json" \
  -d '{"qty": 5}'
```

### Order Endpoints

**POST `/api/orders/market`**
Place market order

```bash
curl -X POST http://localhost:8000/api/orders/market \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "qty": 10,
    "side": "buy",
    "time_in_force": "gtc"
  }'
```

**POST `/api/orders/limit`**
Place limit order

```bash
curl -X POST http://localhost:8000/api/orders/limit \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "qty": 10,
    "side": "buy",
    "limit_price": 175.00,
    "time_in_force": "gtc"
  }'
```

**POST `/api/orders/stop`**
Place stop order

```bash
curl -X POST http://localhost:8000/api/orders/stop \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "qty": 10,
    "side": "sell",
    "stop_price": 170.00,
    "time_in_force": "gtc"
  }'
```

**POST `/api/orders/stop-limit`**
Place stop-limit order

```bash
curl -X POST http://localhost:8000/api/orders/stop-limit \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "qty": 10,
    "side": "sell",
    "stop_price": 170.00,
    "limit_price": 169.50,
    "time_in_force": "gtc"
  }'
```

**GET `/api/orders`**
Get orders

```bash
# Get open orders
curl http://localhost:8000/api/orders?status=open

# Get all orders
curl http://localhost:8000/api/orders?status=all

# Get orders for specific symbols
curl http://localhost:8000/api/orders?symbols=AAPL,GOOGL
```

Response:

```json
{
  "orders": [
    {
      "id": "...",
      "symbol": "AAPL",
      "qty": 10,
      "side": "buy",
      "type": "limit",
      "limit_price": 175.0,
      "status": "accepted",
      "created_at": "2024-11-22T12:00:00Z"
    }
  ]
}
```

**DELETE `/api/orders/{order_id}`**
Cancel specific order

```bash
curl -X DELETE http://localhost:8000/api/orders/{order_id}
```

**DELETE `/api/orders`**
Cancel all orders

```bash
curl -X DELETE http://localhost:8000/api/orders
```

## Frontend Usage

### Account Information

```typescript
import { useAccount } from "@/hooks/useTrading";

function AccountSummary() {
  const { account, loading, error, refetch } = useAccount();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Account</h2>
      <p>Portfolio Value: ${account?.portfolio_value.toLocaleString()}</p>
      <p>Buying Power: ${account?.buying_power.toLocaleString()}</p>
      <p>Cash: ${account?.cash.toLocaleString()}</p>
    </div>
  );
}
```

### View Positions

```typescript
import { usePositions } from "@/hooks/useTrading";

function PositionsList() {
  const { positions, loading, closePosition } = usePositions();

  return (
    <div>
      <h2>Open Positions</h2>
      {positions.map((pos) => (
        <div key={pos.symbol}>
          <h3>
            {pos.symbol} - {pos.side}
          </h3>
          <p>Size: {pos.qty}</p>
          <p>Entry: ${pos.avg_entry_price.toFixed(2)}</p>
          <p>
            Current: $
            {pos.live_price?.toFixed(2) || pos.current_price.toFixed(2)}
          </p>
          <p>
            P&L: ${pos.live_pnl?.toFixed(2) || pos.unrealized_pl.toFixed(2)}({pos.live_pnl_percent?.toFixed(
              2
            ) || pos.unrealized_plpc.toFixed(2)}%)
          </p>
          <button onClick={() => closePosition(pos.symbol)}>Close</button>
        </div>
      ))}
    </div>
  );
}
```

### Place Orders

```typescript
import { useTrading } from "@/hooks/useTrading";
import { useState } from "react";

function TradingPanel() {
  const { placeMarketOrder, placeLimitOrder, submitting, error } = useTrading();
  const [symbol, setSymbol] = useState("AAPL");
  const [qty, setQty] = useState(10);
  const [limitPrice, setLimitPrice] = useState(175.0);

  const handleMarketBuy = async () => {
    const order = await placeMarketOrder(symbol, qty, "buy");
    if (order) {
      alert(`Market order placed: ${order.id}`);
    }
  };

  const handleLimitBuy = async () => {
    const order = await placeLimitOrder(symbol, qty, "buy", limitPrice);
    if (order) {
      alert(`Limit order placed: ${order.id}`);
    }
  };

  return (
    <div>
      <h2>Place Order</h2>
      <input value={symbol} onChange={(e) => setSymbol(e.target.value)} />
      <input
        type="number"
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
      />
      <input
        type="number"
        value={limitPrice}
        onChange={(e) => setLimitPrice(Number(e.target.value))}
      />

      <button onClick={handleMarketBuy} disabled={submitting}>
        Market Buy
      </button>
      <button onClick={handleLimitBuy} disabled={submitting}>
        Limit Buy @ ${limitPrice}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
```

### View Orders

```typescript
import { useOrders } from "@/hooks/useTrading";

function OpenOrders() {
  const { orders, loading, cancelOrder } = useOrders("open");

  return (
    <div>
      <h2>Open Orders</h2>
      {orders.map((order) => (
        <div key={order.id}>
          <p>
            {order.symbol} - {order.side.toUpperCase()} -{" "}
            {order.type.toUpperCase()}
          </p>
          <p>Qty: {order.qty}</p>
          {order.limit_price && <p>Limit: ${order.limit_price}</p>}
          {order.stop_price && <p>Stop: ${order.stop_price}</p>}
          <p>Status: {order.status}</p>
          <p>Created: {new Date(order.created_at).toLocaleString()}</p>
          <button onClick={() => cancelOrder(order.id)}>Cancel</button>
        </div>
      ))}
    </div>
  );
}
```

## P&L Calculation

The backend automatically calculates P&L using live prices from the market data service:

### For LONG positions:

```
P&L = qty × (current_price - entry_price)
P&L % = (P&L / (qty × entry_price)) × 100
```

### For SHORT positions:

```
P&L = qty × (entry_price - current_price)
P&L % = (P&L / (qty × entry_price)) × 100
```

### Example:

**Position:**

- Symbol: BTC/USD
- Side: LONG
- Size: 0.5 BTC
- Entry: $96,250
- Current: $98,742

**P&L Calculation:**

```
P&L = 0.5 × (98742 - 96250) = $1,246
P&L % = (1246 / (0.5 × 96250)) × 100 = 2.59%
```

## Time in Force Options

- **`day`** - Order valid until end of trading day
- **`gtc`** - Good til cancelled (default)
- **`ioc`** - Immediate or cancel
- **`fok`** - Fill or kill

## Order Types

### Market Order

- Executes immediately at current market price
- No price guarantee
- Best for quick entry/exit

### Limit Order

- Executes only at limit price or better
- May not fill if price doesn't reach limit
- Best for price-sensitive trades

### Stop Order

- Triggers market order when stop price is reached
- Used for stop-losses
- No price guarantee after trigger

### Stop-Limit Order

- Triggers limit order when stop price is reached
- Guarantees price but may not fill
- Best for risk management with price control

## Integration with Live Prices

Positions automatically use live prices from the WebSocket market data service:

1. **Backend receives** live price updates via Alpaca WebSocket
2. **Prices stored** in memory (`alpaca_service.live_prices`)
3. **Position endpoint** enhances Alpaca positions with live prices
4. **P&L recalculated** using most recent price

This ensures your P&L updates in real-time, not just when Alpaca updates positions!

## Error Handling

All endpoints return appropriate HTTP status codes:

- **200** - Success
- **404** - Resource not found (order/position doesn't exist)
- **500** - Server error (Alpaca API error)
- **503** - Service unavailable (API keys not configured)

Frontend hooks automatically handle errors and provide error messages.

## Testing

### 1. Check Trading Status

```bash
curl http://localhost:8000/api/trading/status
```

Expected response:

```json
{
  "enabled": true,
  "paper_trading": true,
  "message": "Trading service ready"
}
```

### 2. Place a Test Order

```bash
curl -X POST http://localhost:8000/api/orders/market \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AAPL", "qty": 1, "side": "buy", "time_in_force": "gtc"}'
```

### 3. Check Your Position

```bash
curl http://localhost:8000/api/positions/AAPL
```

### 4. Close the Position

```bash
curl -X DELETE http://localhost:8000/api/positions/AAPL
```

## Complete Example: Buy, Hold, Sell

```typescript
import { useTrading, usePositions, useOrders } from "@/hooks/useTrading";

function TradingExample() {
  const { placeMarketOrder, placeLimitOrder } = useTrading();
  const { positions, closePosition } = usePositions();
  const { orders } = useOrders("open");

  // 1. Buy 10 shares of AAPL at market
  const buyMarket = async () => {
    await placeMarketOrder("AAPL", 10, "buy");
  };

  // 2. Set a limit sell at $180
  const sellLimit = async () => {
    await placeLimitOrder("AAPL", 10, "sell", 180.0);
  };

  // 3. Or immediately sell at market
  const sellMarket = async () => {
    await closePosition("AAPL");
  };

  return (
    <div>
      <button onClick={buyMarket}>Buy 10 AAPL</button>
      <button onClick={sellLimit}>Sell @ $180</button>
      <button onClick={sellMarket}>Sell Now</button>

      <h3>Current Position</h3>
      {positions.find((p) => p.symbol === "AAPL") && (
        <div>
          <p>Qty: {positions.find((p) => p.symbol === "AAPL")?.qty}</p>
          <p>
            P&L: $
            {positions.find((p) => p.symbol === "AAPL")?.live_pnl?.toFixed(2)}
          </p>
        </div>
      )}

      <h3>Open Orders</h3>
      {orders
        .filter((o) => o.symbol === "AAPL")
        .map((o) => (
          <div key={o.id}>
            {o.side} {o.qty} @ ${o.limit_price || "market"}
          </div>
        ))}
    </div>
  );
}
```

## Notes

- All trading uses **Alpaca Paper Trading** (no real money)
- Orders execute based on Alpaca's order matching
- You don't need to implement fill logic - Alpaca handles it
- Positions update automatically when orders fill
- P&L is real-time using live market data

## Next Steps

1. Add Alpaca API keys to `.env`
2. Test with the API endpoints
3. Integrate into your UI components
4. Build trading panels and position displays
5. Add order confirmation dialogs
6. Implement risk management features
