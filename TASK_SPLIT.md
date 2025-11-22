# 🚀 DIVERGENCE - 18 Hour Build Sprint

**Team:** 4 people | **Time:** 18 hours | **Goal:** Working demo with VTuber voice agent

---

## 👥 TEAM ASSIGNMENTS

### @justin - Frontend Integration + REST API Endpoints (5-6 hours)

**Priority 1: REST API Endpoints** (2-3 hrs)
- [ ] Set up Supabase project and get credentials
- [ ] Create database tables (use `schema.sql` if provided, or create manually):
  - `portfolio` (balance_usd, is_locked, lock_reason, lock_expires_at)
  - `trades` (ticker, side, order_type, amount, limit_price, status, created_at)
  - `market_context` (risk_score, summary, btc_price, price_change_24h, hype_score, sentiment, polymarket_odds, created_at)
  - `feed_items` (source, title, metadata, created_at)
- [ ] Implement `app/api/portfolio.py`:
  - `GET /api/portfolio` - Return single portfolio row
- [ ] Implement `app/api/orders.py`:
  - `POST /api/orders` - Create manual order (status=OPEN)
  - `GET /api/orders` - List active orders (status=OPEN)
  - `DELETE /api/orders/{id}` - Cancel order (set status=CANCELLED)
- [ ] Implement `app/api/market_data.py`:
  - `GET /api/polymarket` - Return feed_items where source='POLYMARKET'
  - `GET /api/reddit` - Return feed_items where source='REDDIT'
  - `GET /api/vibes` - Return latest market_context row
- [ ] Wire up all routers in `app/main.py`

**Priority 2: Frontend Integration** (3 hrs)
- [ ] Connect frontend to backend API endpoints
- [ ] Replace hardcoded data with real API calls
- [ ] Add environment variable for backend URL
- [ ] Test all trading panel tabs (Portfolio, Trading, etc.)
- [ ] Verify Supabase Realtime subscription for portfolio updates

**Files:** `app/api/*.py`, `app/services/supabase.py`, `app/models/*.py`, frontend API integration

---

### @baniel - VTuber Integration + ElevenLabs Voice (6-7 hours)

**Priority 1: ElevenLabs Setup** (3-4 hrs)
- [ ] Sign up for ElevenLabs API key
- [ ] Choose/clone an anime voice (recommend "Bella" or custom voice)
- [ ] Implement `app/services/elevenlabs.py`:
  - **Text-to-Speech (TTS):** Send text with V3 audio tags → receive audio stream
  - **Speech-to-Text (STT):** Stream audio chunks → receive transcription (Scribe v2)
  - Handle audio tag passthrough: `[panicked]`, `[shouting]`, `[fast]`, `[whispering]`, `[sighs]`, `[laughs]`, `[gasps]`
- [ ] Test TTS with sample text: `"[panicked] [fast] Bitcoin is CRASHING! Down 5 percent!"`
- [ ] Test STT with microphone input

**Priority 2: VTuber Integration** (3-4 hrs)
- [ ] Research VTuber library (e.g., Live2D, VSeeFace, or web-based avatar)
- [ ] Integrate VTuber avatar into frontend (replace pink placeholder)
- [ ] Sync avatar mouth movement with audio playback
- [ ] Add idle animations
- [ ] Test with real ElevenLabs audio output

**Collaboration Point:** Work with @Tankman69 to connect agent text output → your TTS pipeline

**Files:** `app/services/elevenlabs.py`, frontend VTuber component

---

### @jokerr - Data Processing Pipelines + Market Data (6-7 hours)

**Priority 1: External API Clients** (2-3 hrs)
- [ ] Implement `app/services/coingecko.py`:
  - Fetch BTC/USD price, 24h change, volume
  - Free tier works, no API key needed (or use optional key for higher limits)
  - Endpoint: `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true`
- [ ] Implement `app/services/polymarket.py`:
  - Fetch top BTC-related prediction markets
  - Endpoint: `https://gamma-api.polymarket.com/events` (no auth required)
  - Extract: market name, odds (probability), volume, change
- [ ] Implement `app/services/reddit.py`:
  - Fetch posts from subreddits using JSON endpoint (no auth)
  - Subreddits: r/wallstreetbets, r/Polymarket, r/PredictionMarket, r/pennystocks
  - Endpoint: `https://www.reddit.com/r/wallstreetbets/new.json?limit=10`
  - Extract: title, username, subreddit, timestamp

**Priority 2: Data Ingest Worker** (2-3 hrs)
- [ ] Implement `app/workers/ingest.py`:
  - Run async loop every 10 seconds
  - Fetch all 3 data sources in parallel
  - Process with OpenAI GPT-4o-mini:
    - Prompt: "Analyze this market data. Return JSON with: hype_score (0-100), sentiment (BULLISH/BEARISH/PANIC), keywords (array), polymarket_summary (string)"
  - Write to Supabase:
    - Insert into `market_context` (risk_score, summary, btc_price, etc.)
    - Upsert into `feed_items` (source='POLYMARKET' and source='REDDIT')
  - Handle API failures gracefully (use cached data)

**Priority 3: Trigger Monitor Worker** (1-2 hrs)
- [ ] Implement `app/workers/monitor.py`:
  - Run async loop every 1 second
  - Read latest `market_context` from database
  - Calculate risk_score using formula:
    ```python
    risk_score = (
      abs(price_change_24h) * 10 +
      hype_score * 0.6 +
      abs(polymarket_odds - 0.5) * 40
    )
    # Clamp to 0-100
    ```
  - If risk_score > 80:
    - Generate alert with OpenAI
    - Send WebSocket INTERRUPT message (coordinate with @baniel)
    - Inject SYSTEM_ALERT into agent conversation (coordinate with @Tankman69)

**Collaboration Point:** Work with @justin to ensure your workers can write to Supabase tables

**Files:** `app/services/coingecko.py`, `app/services/polymarket.py`, `app/services/reddit.py`, `app/workers/ingest.py`, `app/workers/monitor.py`, `app/services/openai_client.py`

---

### @Tankman69 - AI Agent + LangGraph + Tools (7-8 hours) **[HARDEST]**

**Priority 1: LangGraph Agent Setup** (3-4 hrs)
- [ ] Implement `app/agent/state.py`:
  - Define `AgentState` class with: messages, risk_score, portfolio, pending_trade
- [ ] Implement `app/agent/graph.py`:
  - Set up LangGraph StateGraph
  - Add system prompt from `app/agent/personality.py`
  - Bind OpenAI GPT-4o as LLM
  - Add checkpointing for trade approvals (interrupt_before=True)
  - Connect all 4 tools
- [ ] Test basic conversation flow (no tools yet)

**Priority 2: Implement Agent Tools** (3-4 hrs)
- [ ] `app/agent/tools/market_sentiment.py`:
  - Tool: `get_market_sentiment()`
  - Query latest `market_context` from Supabase
  - Return: risk_score, summary, btc_price, sentiment, polymarket_odds
  - **Read-only, no side effects**
- [ ] `app/agent/tools/holdings.py`:
  - Tool: `list_holdings()`
  - Query `portfolio` + all `trades` where status='OPEN'
  - Return: balance_usd, is_locked, open_orders array
  - **Read-only, no side effects**
- [ ] `app/agent/tools/trade.py`:
  - Tool: `execute_trade(ticker, side, order_type, amount, limit_price?)`
  - **CRITICAL:** Set `interrupt_before=True` in LangGraph
  - Insert into `trades` with status='PENDING_APPROVAL'
  - Send WebSocket APPROVAL_REQUEST
  - Wait for user decision (CONFIRM or DENY)
  - If approved: update to status='OPEN', update balance
  - If denied: delete trade row
- [ ] `app/agent/tools/lock.py`:
  - Tool: `lock_user_account(reason, duration_seconds=300)`
  - Update `portfolio`: is_locked=TRUE, lock_reason, lock_expires_at
  - Send WebSocket LOCK_UI message
  - Return confirmation

**Priority 3: WebSocket Integration** (1-2 hrs)
- [ ] Implement `app/api/websocket.py`:
  - Single WebSocket endpoint: `WS /ws/agent`
  - Handle incoming messages:
    - `AUDIO_CHUNK` → forward to ElevenLabs STT (coordinate with @baniel)
    - `USER_INTERRUPT` → cancel agent speech
    - `TRADE_DECISION` → resume LangGraph execution
  - Send outgoing messages:
    - `AGENT_AUDIO` → agent speaks (from ElevenLabs TTS)
    - `AGENT_TEXT` → transcript only
    - `INTERRUPT` → server-side crash alert
    - `APPROVAL_REQUEST` → trade confirmation modal
    - `LOCK_UI` → disable trading buttons

**Collaboration Point:** Work with @baniel to connect agent text → TTS, and STT → agent input

**Files:** `app/agent/*.py`, `app/agent/tools/*.py`, `app/api/websocket.py`

---

## 🔥 INTEGRATION PHASE (All Together - 3-4 hours)

**Testing Checklist:**
- [ ] Frontend displays real Polymarket + Reddit data
- [ ] Manual trading works (POST /api/orders)
- [ ] Portfolio displays real balance
- [ ] User can speak → Agent hears (STT working)
- [ ] Agent responds with voice (TTS working)
- [ ] Agent uses tools correctly (market_sentiment, holdings)
- [ ] Trade approval flow works (agent proposes → user confirms)
- [ ] Lock mechanism works (agent locks → buttons disabled)
- [ ] Trigger Monitor detects high risk_score and interrupts
- [ ] VTuber syncs with audio

**Demo Flow (Practice This!):**
1. Load page → See real market data populating
2. Speak to agent: "What's happening in the market?"
3. Agent calls `get_market_sentiment()` → responds with voice + VTuber animation
4. Press hidden 'C' key → Crash scenario triggered
5. Trigger Monitor sends INTERRUPT with SYSTEM_ALERT to agent
6. Agent generates response: "[panicked] [shouting] Market is CRASHING! I'm locking your account!"
7. TTS generates audio on-demand → VTuber speaks
8. Trading buttons disable (lock mechanism)
9. Agent proposes trade: "I'm selling your Bitcoin NOW!"
10. User clicks CONFIRM
11. Trade executes, portfolio updates in real-time

---

## ⚡ QUICK START CHECKLIST

**Everyone:**
1. [ ] Pull latest code
2. [ ] Create `.env` file (copy from `.env.example`)
3. [ ] Install dependencies: `pip install -r requirements.txt` (backend), `npm install` (frontend)
4. [ ] Get API keys:
   - Supabase (free tier)
   - OpenAI
   - ElevenLabs (free trial)

**Git Workflow:**
- Work on separate branches: `git checkout -b feature/your-name-task-name`
- Push frequently: `git push origin feature/your-name-task-name`
- Merge when ready (coordinate in group chat)

**Communication:**
- Use group chat for blockers
- Share `.env` credentials securely
- Test your components independently BEFORE integration

---

## 🎯 CRITICAL SUCCESS FACTORS

1. **Start with mocks:** Don't wait for real APIs. Use hardcoded data first, swap later.
2. **Test independently:** Each person tests their module alone before connecting.
3. **Use the architecture doc:** Everything is already designed. Just implement it.
4. **Don't over-engineer:** MVP first. Polish later if time permits.
5. **Focus on the demo:** The crash scenario + agent interrupt is your "wow" moment.

---

## 📞 WHO TO ASK FOR HELP

- **Supabase issues?** → @justin
- **Voice not working?** → @baniel
- **API data wrong?** → @jokerr
- **Agent being dumb?** → @Tankman69
- **Everything broken?** → Huddle up, debug together

---

**LET'S FUCKING GO!** 🚀

You have 18 hours. The architecture is solid. Just execute.

**Remember:** The VTuber screaming at you during a crash is the money shot. Make it work.
