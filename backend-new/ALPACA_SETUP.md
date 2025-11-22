# VibeTrade Backend - Alpaca Integration Setup

## Quick Start

### 1. Install Dependencies

```bash
cd backend-new
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your Alpaca API keys
```

Get your Alpaca API keys:

1. Sign up at [Alpaca Markets](https://alpaca.markets/)
2. Navigate to Paper Trading dashboard
3. Generate API keys
4. Add them to `.env`:

```env
ALPACA_API_KEY=your_actual_key
ALPACA_SECRET_KEY=your_actual_secret
```

### 3. Start the Backend

```bash
python run.py
```

Backend will start on `http://localhost:8000`

### 4. Test the Connection

Visit http://localhost:8000/docs for API documentation

## WebSocket Endpoints

The backend provides WebSocket endpoints for live market data:

- `ws://localhost:8000/ws/alpaca/crypto` - Cryptocurrency data
- `ws://localhost:8000/ws/alpaca/stocks` - Stock data
- `ws://localhost:8000/ws/alpaca/etfs` - ETF data
- `ws://localhost:8000/ws/alpaca/options` - Options data

## How It Works

### Architecture

```
Alpaca WebSocket API
        ↓
AlpacaMarketDataService (app/services/alpaca.py)
    - Subscribes to Alpaca streams
    - Maintains live prices in memory
    - Broadcasts to callback handlers
        ↓
ConnectionManager (app/api/market_websocket.py)
    - Manages frontend WebSocket connections
    - Handles subscriptions per connection
    - Broadcasts price updates to subscribers
        ↓
Frontend WebSocket
```

### Price Flow

1. **Frontend subscribes** to symbols via WebSocket:

```json
{
  "action": "subscribe",
  "symbols": ["BTC", "ETH", "AAPL"]
}
```

2. **Backend subscribes** to Alpaca for those symbols

3. **Alpaca streams** real-time data (bars, trades)

4. **Service updates** in-memory prices:

```python
self.live_prices = {
  "BTCUSD": 98742.31,
  "ETHUSD": 3456.78,
  "AAPL": 178.50
}
```

5. **Manager broadcasts** to frontend subscribers:

```json
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

## REST API Endpoints

### Get All Current Prices

```bash
GET /api/prices
```

Returns:

```json
{
  "prices": {
    "BTCUSD": 98742.31,
    "ETHUSD": 3456.78,
    "AAPL": 178.5
  }
}
```

### Get Single Symbol Price

```bash
GET /api/prices/BTC
```

Returns:

```json
{
  "symbol": "BTC",
  "price": 98742.31
}
```

## Features

✅ **Real-time price streaming** from Alpaca
✅ **In-memory price cache** for instant access
✅ **Multi-symbol subscriptions** per connection
✅ **Automatic reconnection** handling
✅ **Support for multiple data types** (crypto, stocks, ETFs, options)
✅ **Broadcast to multiple clients** efficiently
✅ **Health check endpoint** with connection status

## Development

### Project Structure

```
backend-new/
├── app/
│   ├── main.py                    # FastAPI app with lifespan management
│   ├── services/
│   │   └── alpaca.py             # Alpaca WebSocket streaming service
│   └── api/
│       └── market_websocket.py   # Frontend WebSocket endpoints
├── requirements.txt               # Python dependencies
├── run.py                        # Startup script
└── .env                          # Environment variables
```

### Running in Development

```bash
# With auto-reload
python run.py

# Or directly with uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Logs

The service logs important events:

- WebSocket connections/disconnections
- Symbol subscriptions
- Price updates
- Errors and reconnections

## Troubleshooting

### No data streaming

1. Check Alpaca API keys are valid
2. Verify symbols are supported by Alpaca
3. Check if you're within Alpaca rate limits
4. Look for errors in backend logs

### WebSocket won't connect

1. Ensure backend is running on port 8000
2. Check CORS settings in `main.py`
3. Verify firewall settings

### Import errors

Make sure all dependencies are installed:

```bash
pip install -r requirements.txt
```

## Next Steps

1. ✅ Connect frontend to WebSocket endpoints
2. ✅ Display live data in charts
3. ✅ Add error handling and reconnection logic
4. ✅ Implement rate limiting
5. ✅ Deploy with proper WebSocket support

## Production Deployment

For production, update:

1. **CORS origins** in `main.py`:

```python
allow_origins=["https://your-production-domain.com"]
```

2. **Environment variables** for production API keys

3. **Use production Alpaca URL** (not paper trading)

4. **Enable HTTPS** for WebSocket connections (wss://)

5. **Add authentication** for WebSocket connections

## Support

- [Alpaca API Docs](https://alpaca.markets/docs/)
- [FastAPI WebSocket Guide](https://fastapi.tiangolo.com/advanced/websockets/)
