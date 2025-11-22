# Alpaca WebSocket Integration - Complete Setup

## ✅ Implementation Complete

The Alpaca WebSocket integration is now fully implemented and ready to use!

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ALPACA API                                │
│         (Real-time market data via WebSocket)               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              AlpacaMarketDataService                         │
│        (backend-new/app/services/alpaca.py)                 │
│                                                              │
│  • Subscribes to Alpaca crypto & stock streams              │
│  • Maintains live prices in memory:                         │
│    { "BTCUSD": 98742.31, "AAPL": 178.50, ... }             │
│  • Broadcasts updates via callbacks                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              ConnectionManager                               │
│       (backend-new/app/api/market_websocket.py)             │
│                                                              │
│  • Manages WebSocket connections from frontend              │
│  • Routes messages to subscribed clients                    │
│  • Handles subscribe/unsubscribe per connection            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Frontend WebSocket Clients                      │
│          (frontend/lib/websocket.ts)                        │
│          (frontend/hooks/useAlpacaWebSocket.ts)             │
│                                                              │
│  • Connects to ws://localhost:8000/ws/alpaca/{type}        │
│  • Sends subscribe/unsubscribe messages                     │
│  • Receives real-time price updates                         │
│  • Updates charts via callbacks                             │
└─────────────────────────────────────────────────────────────┘
```

## Backend Implementation

### Files Created/Modified:

1. **`backend-new/requirements.txt`** ✅

   - Added `alpaca-py==0.43.2`

2. **`backend-new/app/services/alpaca.py`** ✅ NEW

   - `AlpacaMarketDataService` class
   - Handles Alpaca WebSocket streaming
   - Maintains in-memory price cache
   - Supports crypto and stock data

3. **`backend-new/app/api/market_websocket.py`** ✅ NEW

   - `ConnectionManager` class
   - 4 WebSocket endpoints:
     - `/ws/alpaca/crypto`
     - `/ws/alpaca/stocks`
     - `/ws/alpaca/etfs`
     - `/ws/alpaca/options`
   - REST endpoints:
     - `GET /api/prices` - Get all prices
     - `GET /api/prices/{symbol}` - Get specific price

4. **`backend-new/app/main.py`** ✅ UPDATED

   - Added lifespan manager for startup/shutdown
   - Registered market WebSocket router
   - Connected Alpaca service to broadcaster

5. **`backend-new/run.py`** ✅ NEW

   - Startup script with nice formatting

6. **`backend-new/.env.example`** ✅ UPDATED

   - Added Alpaca configuration

7. **`backend-new/ALPACA_SETUP.md`** ✅ NEW
   - Comprehensive setup documentation

## Frontend (Already Implemented)

The frontend WebSocket infrastructure is already complete:

1. **`frontend/lib/websocket.ts`** ✅

   - `AlpacaWebSocketManager` class
   - Singleton instances for each data type

2. **`frontend/hooks/useAlpacaWebSocket.ts`** ✅

   - React hook for easy WebSocket usage

3. **`frontend/components/LiveAlpacaChart.tsx`** ✅
   - Example chart component

## Usage Guide

### 1. Start the Backend

```bash
cd backend-new

# Install dependencies (first time only)
python3 -m pip install -r requirements.txt

# Create .env file (first time only)
cp .env.example .env

# Add your Alpaca API keys to .env
# ALPACA_API_KEY=your_key
# ALPACA_SECRET_KEY=your_secret

# Start the server
python3 run.py
```

Backend runs on: `http://localhost:8000`

- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

### 2. Use in Frontend Components

```typescript
import { useAlpacaWebSocket } from "@/hooks/useAlpacaWebSocket";

function CryptoChart() {
  const { subscribe } = useAlpacaWebSocket({
    symbols: ["BTC", "ETH"],
    dataType: "crypto",
    onMessage: (message) => {
      if (message.type === "bar") {
        console.log("New price:", message.data);
        // Update your chart here
      }
    },
    autoConnect: true,
  });

  return <div>Your chart component</div>;
}
```

## Message Flow Example

### 1. Frontend Subscribes

```json
// Frontend sends via WebSocket
{
  "action": "subscribe",
  "symbols": ["BTC", "ETH", "AAPL"]
}
```

### 2. Backend Subscribes to Alpaca

```python
# Backend subscribes to Alpaca
await alpaca_service.subscribe_crypto(["BTC/USD", "ETH/USD"])
await alpaca_service.subscribe_stocks(["AAPL"])
```

### 3. Alpaca Sends Data

```python
# Alpaca WebSocket sends bar data
{
  symbol: "BTC/USD",
  open: 98742.31,
  high: 98850.00,
  low: 98700.00,
  close: 98800.00,
  volume: 1234567,
  timestamp: datetime(...)
}
```

### 4. Backend Processes & Broadcasts

```python
# Service updates memory
self.live_prices["BTCUSD"] = 98800.00

# Service broadcasts to all callbacks
await broadcast_price_update("crypto", "BTC", {
  "type": "bar",
  "data": {...}
})
```

### 5. Frontend Receives

```json
// Frontend receives via WebSocket
{
  "type": "bar",
  "data": {
    "symbol": "BTC",
    "timestamp": 1700000000,
    "open": 98742.31,
    "high": 98850.0,
    "low": 98700.0,
    "close": 98800.0,
    "volume": 1234567
  }
}
```

## API Endpoints

### WebSocket Endpoints

**Connect to crypto stream:**

```javascript
const ws = new WebSocket("ws://localhost:8000/ws/alpaca/crypto");
```

**Subscribe to symbols:**

```javascript
ws.send(
  JSON.stringify({
    action: "subscribe",
    symbols: ["BTC", "ETH"],
  })
);
```

**Unsubscribe from symbols:**

```javascript
ws.send(
  JSON.stringify({
    action: "unsubscribe",
    symbols: ["BTC"],
  })
);
```

### REST Endpoints

**Get all current prices:**

```bash
curl http://localhost:8000/api/prices
```

**Get specific symbol price:**

```bash
curl http://localhost:8000/api/prices/BTC
```

## Testing the Integration

### 1. Test Backend Health

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{
  "status": "healthy",
  "alpaca_connected": false,
  "tracked_symbols": 0
}
```

### 2. Test WebSocket Connection

```bash
# Install wscat if you don't have it
npm install -g wscat

# Connect to crypto stream
wscat -c ws://localhost:8000/ws/alpaca/crypto

# You'll receive a welcome message
{"type":"connected","message":"Connected to crypto price stream"}

# Subscribe to BTC
> {"action":"subscribe","symbols":["BTC"]}

# You'll receive confirmation
{"type":"subscribed","symbols":["BTC"]}
```

### 3. Test with Frontend

```bash
cd frontend
npm run dev
```

Navigate to any holdings page and click on a holding. The chart should connect to the WebSocket and start receiving data.

## Configuration

### Environment Variables (.env)

```env
# Alpaca API (Required for live data)
ALPACA_API_KEY=your_key_here
ALPACA_SECRET_KEY=your_secret_here
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# Server
HOST=0.0.0.0
PORT=8000
```

### CORS Settings

Currently allows `localhost:3000` and `localhost:3001`. Update in `backend-new/app/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    ...
)
```

## Important Notes

⚠️ **Without Alpaca API Keys:**

- Backend will start but won't stream real data
- Service logs: "Alpaca API keys not configured"
- WebSocket connections will work but receive no data

✅ **With Alpaca API Keys:**

- Backend connects to Alpaca WebSocket streams
- Real-time data flows to frontend
- Prices update in memory and broadcast to clients

## Data Types Supported

1. **Crypto** (`/ws/alpaca/crypto`)

   - Symbols: BTC, ETH, SOL, etc.
   - Alpaca format: BTC/USD, ETH/USD

2. **Stocks** (`/ws/alpaca/stocks`)

   - Symbols: AAPL, GOOGL, TSLA, etc.

3. **ETFs** (`/ws/alpaca/etfs`)

   - Uses stock data stream
   - Symbols: SPY, QQQ, etc.

4. **Options** (`/ws/alpaca/options`)
   - Uses stock data stream
   - Symbol format depends on Alpaca support

## Message Types

### Received from Frontend

```typescript
{ action: "subscribe", symbols: ["BTC", "ETH"] }
{ action: "unsubscribe", symbols: ["BTC"] }
```

### Sent to Frontend

```typescript
{ type: "connected", message: "Connected to crypto price stream" }
{ type: "subscribed", symbols: ["BTC", "ETH"] }
{ type: "bar", data: { symbol, timestamp, open, high, low, close, volume } }
{ type: "trade", data: { symbol, timestamp, price, size } }
{ type: "error", message: "Error description" }
```

## Next Steps

1. ✅ **Add Alpaca API keys** to `.env` for live data
2. ✅ **Update chart components** to use live WebSocket data
3. ✅ **Add error handling** in frontend for disconnections
4. ✅ **Implement reconnection logic** (already in websocket.ts)
5. ✅ **Add loading states** while waiting for first price update
6. ✅ **Display connection status** in UI

## Troubleshooting

**Backend won't start:**

- Check Python version (3.9+)
- Install requirements: `pip install -r requirements.txt`

**No data streaming:**

- Check `.env` has valid Alpaca keys
- Check backend logs for errors
- Verify symbols are supported by Alpaca

**Frontend can't connect:**

- Ensure backend is running on port 8000
- Check browser console for WebSocket errors
- Verify CORS settings

## Resources

- [Alpaca Documentation](https://alpaca.markets/docs/)
- [FastAPI WebSockets](https://fastapi.tiangolo.com/advanced/websockets/)
- Backend setup: `backend-new/ALPACA_SETUP.md`
- Integration guide: `ALPACA_INTEGRATION.md`
