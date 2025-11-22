# VibeTrade Backend

Agentic Risk Terminal - Backend API

## Architecture

See `AGENT_ARCHITECTURE.md` for complete system design.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create `.env` file:
```bash
cp .env.example .env
# Fill in your API keys
```

3. Run the server:
```bash
uvicorn app.main:app --reload
```

## Structure

```
app/
├── main.py              # FastAPI entry point
├── api/                 # REST endpoints
│   ├── portfolio.py     # Portfolio/balance
│   ├── orders.py        # Trading operations
│   ├── market_data.py   # Polymarket, Reddit, Vibes
│   └── websocket.py     # Agent WebSocket
├── agent/               # LangGraph agent
│   ├── graph.py         # Agent graph setup
│   ├── state.py         # Agent state model
│   ├── personality.py   # System prompt
│   └── tools/           # Agent tools
├── workers/             # Background tasks
│   ├── ingest.py        # Data fetching (10s loop)
│   └── monitor.py       # Trigger detection (1s loop)
├── services/            # External APIs
│   ├── supabase.py      # Database
│   ├── openai_client.py # LLM
│   ├── elevenlabs.py    # Voice
│   ├── coingecko.py     # Price data
│   ├── polymarket.py    # Prediction markets
│   └── reddit.py        # Social sentiment
├── models/              # Pydantic models
└── utils/               # Helpers
```

## API Endpoints

- `GET /api/portfolio` - Current portfolio state
- `POST /api/orders` - Create manual order
- `GET /api/orders` - List active orders
- `DELETE /api/orders/{id}` - Cancel order
- `GET /api/polymarket` - Polymarket feed
- `GET /api/reddit` - Reddit sentiment feed
- `GET /api/vibes` - Current vibe score
- `WS /ws/agent` - Agent voice/text communication

## Development

All files are created with TODO comments indicating what needs to be implemented.

Refer to `AGENT_ARCHITECTURE.md` for detailed specifications of each component.
