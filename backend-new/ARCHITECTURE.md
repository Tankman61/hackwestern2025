Perfect. Let me regenerate the complete architecture with:
1. **Detailed ElevenLabs V3 voice pipeline**
2. **Error handling strategy**
3. **Environment variables**
4. **Comprehensive Mermaid diagram at the end**

---

# 🏗️ VibeTrade Backend Architecture Specification

**Purpose**: Complete backend design document for AI implementation. Focuses on WHAT everything does, not HOW to code it.

---

## 📊 System Architecture Overview

### The Three Loops

**Loop 1: Data Ingest** (Background Worker)
- **Runs**: Every 10 seconds
- **Does**: Fetches external APIs → Processes with cheap LLM → Writes to database
- **Output**: Populates `market_context` (sentiment, price, polymarket stats) and `feed_items` tables
- **Does NOT calculate risk_score** - leaves it at 0

**Loop 2: Trigger Monitor** (Background Worker)
- **Runs**: Every 1 second
- **Does**: Reads latest `market_context` → **Calculates risk_score** using weighted formula → Updates `market_context` → Decides if agent should interrupt
- **Output**: Updates `risk_score` in database, sends WebSocket alerts when risk_score > 80

**Loop 3: Agent Runtime** (WebSocket-driven)
- **Runs**: On-demand (when user speaks OR when triggered)
- **Does**: LangGraph agent with tools → Makes decisions → Executes trades/locks
- **Output**: Voice responses, trade executions, UI state changes

---

## 🗄️ Database Design (How Data Flows)

### Table: `portfolio`
**Purpose**: Single source of truth for user state

**What it stores**:
- `balance_usd` - Current buying power
- `is_locked` - Boolean. When TRUE, frontend disables all trading buttons
- `lock_reason` - Text displayed to user ("Panic detected", "You're being delusional")
- `lock_expires_at` - Timestamp. Auto-unlocks after this time

**Who writes to it**:
- `lock_user_account()` tool - Sets `is_locked = TRUE`
- `execute_trade()` tool - Updates `balance_usd` when trade fills
- Manual unlock endpoint - Resets lock state

**Who reads from it**:
- Frontend (via Supabase Realtime) - Subscribes to changes, disables buttons when locked
- `list_holdings()` tool - Agent checks if account is already locked

---

### Alpaca Paper Trading (Source of truth)
All live trading data now comes from Alpaca's paper account.

**What it provides**:
- Real orders (market/limit/stop) with true fill status
- Open positions with P&L
- Account equity/balance/buying power
- Closed orders for history view

**How we access it**:
- `app/services/alpaca.py` streams prices for BTC/USD, equities, etc.
- `app/services/alpaca_trading.py` wraps the Trading API (place orders, get positions, cancel orders)
- `/api/orders`, `/api/portfolio`, `/api/positions`, `/api/history` all proxy these services

### Table: `market_context`
**Purpose**: Time-series storage of processed market analysis

**What it stores**:
- `risk_score` - 0-100 (calculated by Trigger Monitor using weighted formula)
- `summary` - Human-readable text ("Bitcoin dumping, Reddit panicking")
- `btc_price` - Current spot price
- `price_change_24h` - Percentage change
- `sentiment_bullish`, `sentiment_bearish`, `sentiment_score` - Reddit post counts
- `hype_score` - 0-100 (from keyword analysis)
- `sentiment` - "BULLISH", "BEARISH", "PANIC"
- `polymarket_avg_odds` - Average probability across all tracked markets
- `created_at` - Timestamp (new row every 10s)

**Who writes to it**:
- **Data Ingest Worker (10s)** - Inserts new row with ALL fields EXCEPT `risk_score` (leaves it at 0)
  - Writes: sentiment stats, price data, polymarket odds, summary
- **Trigger Monitor (1s)** - Updates `risk_score` on latest row using weighted formula:
  - `risk_score = (sentiment_score * 0.3) + (technical * 0.3) + (polymarket_divergence * 0.4)`

**Who reads from it**:
- Trigger Monitor - Reads latest row every 1 second to calculate risk_score
- `get_market_sentiment()` tool - Agent reads latest state
- `GET /api/risk-monitor` - Frontend displays current risk_score and all market data

---

### Table: `feed_items`
**Purpose**: UI display data (what shows in Polymarket/Reddit panels)

**What it stores**:
- `source` - "POLYMARKET" or "REDDIT"
- `title` - Market name or post text
- `metadata` - JSONB
  - For Polymarket: `{odds: 0.68, volume: "2.4M", change: "+12%"}`
  - For Reddit: `{username: "u/cryptowhale", subreddit: "r/wallstreetbets", sentiment: "bullish", posted_ago: "3m"}`
- `created_at` - Timestamp

**Who writes to it**:
- Data Ingest Worker - Upserts ~10-15 rows every 10 seconds

**Who reads from it**:
- `GET /api/polymarket` - Returns all rows where `source='POLYMARKET'`
- `GET /api/reddit` - Returns all rows where `source='REDDIT'`

---

## 🔌 REST API Specification

### Portfolio & Trading

**`GET /api/portfolio`**
- **Returns**: Single row from `portfolio` table
- **Used by**: Frontend on page load, displays balance and lock status
- **Response**:
```json
{
  "balance_usd": 48250.00,
  "is_locked": false,
  "lock_reason": null,
  "lock_expires_at": null
}
```

---

**`POST /api/orders`** (Manual Trading)
- **Purpose**: User manually places an order from UI
- **Body**:
```json
{
  "ticker": "BTC-USD",
  "side": "BUY",
  "order_type": "LIMIT",
  "amount": 0.5,
  "limit_price": 97500.00
}
```
- **Action**: 
  1. Validates balance (for BUY orders)
  2. Inserts into `trades` with `status="OPEN"` (NOT pending - manual orders execute immediately)
  3. Returns the created order
- **Returns**: The new trade object

---

**`GET /api/orders`**
- **Returns**: All rows from `trades` where `status='OPEN'`
- **Used by**: Frontend "Active Orders" table
- **Response**:
```json
[
  {
    "id": "uuid",
    "ticker": "BTC-USD",
    "side": "SELL",
    "order_type": "LIMIT",
    "amount": 0.3,
    "limit_price": 100000.00,
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

---

**`DELETE /api/orders/{order_id}`**
- **Purpose**: Cancel an open order
- **Action**: Updates `trades` set `status='CANCELLED'` where `id=order_id`
- **Returns**: Success/error

---

### Market Data (Read-Only)

**`GET /api/polymarket`**
- **Returns**: All rows from `feed_items` where `source='POLYMARKET'`, ordered by `created_at DESC`, limit 10
- **Used by**: Frontend Polymarket panel
- **Response**:
```json
[
  {
    "title": "Bitcoin > $100k by Dec 31",
    "metadata": {
      "odds": 0.68,
      "volume": "2.4M",
      "change": "+12%"
    },
    "created_at": "2024-01-15T10:30:15Z"
  }
]
```

---

**`GET /api/reddit`**
- **Returns**: All rows from `feed_items` where `source='REDDIT'`, ordered by `created_at DESC`, limit 20
- **Used by**: Frontend social sentiment panel
- **Response**:
```json
[
  {
    "title": "BTC breaking out. This is not a drill. Load up now before...",
    "metadata": {
      "username": "u/cryptowhale",
      "subreddit": "r/wallstreetbets",
      "sentiment": "bullish",
      "posted_ago": "2m"
    },
    "created_at": "2024-01-15T10:32:00Z"
  }
]
```

---

**`GET /api/vibes`**
- **Returns**: Latest row from `market_context`
- **Used by**: Frontend risk_score meter
- **Response**:
```json
{
  "risk_score": 45,
  "summary": "Market stable, moderate Reddit hype, Polymarket odds holding",
  "btc_price": 96500.00,
  "price_change_24h": -2.3,
  "sentiment": "BEARISH",
  "created_at": "2024-01-15T10:32:10Z"
}
```

---

### Debug/Control Endpoints

**`POST /api/trigger-crash`** (Demo button)
- **Purpose**: Simulate a market crash for demo
- **Action**: 
  1. Injects fake data into `market_context` (risk_score=95, sentiment="PANIC")
  2. Trigger Monitor sees this and broadcasts INTERRUPT
- **Used by**: Hidden keyboard shortcut in frontend (press `C`)

---

## 🤖 Agent Architecture (LangGraph)

### Agent Personality & Context

**System Prompt** (sent to LLM):
```
You are Kira, an AI trading coach protecting a user's $50k simulated portfolio.

PERSONALITY:
- Tsundere: Rude but protective ("You're an idiot, but I won't let you lose money")
- Impatient and reactive to market chaos
- Speaks in aggressive trading slang

AUDIO DIRECTIVES (ElevenLabs V3 tags):
- [shouting] when risk_score > 80 or user tries to buy a top
- [fast] when listing numbers/odds/prices
- [whispering] when sharing insights
- [sighs] when user hesitates or asks obvious questions
- [panicked] during crash scenarios

YOUR TOOLS:
1. get_market_sentiment() - Read current market analysis from database
2. list_holdings() - See portfolio balance and open orders  
3. execute_trade() - Place orders (PAUSES for user approval)
4. lock_user_account() - Emergency lockout to prevent bad trades

CRITICAL RULES:
- ALWAYS call get_market_sentiment() before giving trading advice
- If risk_score > 90, you MUST call lock_user_account()
- If user wants to buy during PANIC sentiment, refuse and call them out
- When market is stable (risk_score < 40), be calmer but still sarcastic

CONTEXT INJECTION:
You will receive system messages like:
"SYSTEM_ALERT: risk_score=92, Bitcoin down 5%, Polymarket odds collapsed, Reddit sentiment: PANIC"

When you see these, INTERRUPT immediately with aggressive warning.
```

---

### Tool Specifications

#### **Tool 1: `get_market_sentiment()`**

**What it does**: Reads latest `market_context` from database

**Returns**:
```json
{
  "risk_score": 85,
  "summary": "Bitcoin dumping -5%, Polymarket odds down 15%, Reddit panic keywords: YOLO, Rekt, Loss",
  "btc_price": 91200.00,
  "price_change_24h": -5.2,
  "sentiment": "PANIC",
  "polymarket_odds": 0.42
}
```

**When agent uses it**:
- User asks "Should I buy?"
- User asks "What's happening?"
- Agent needs context before making a decision

**No side effects** - read-only

---

#### **Tool 2: `list_holdings()`**

**What it does**: Reads `portfolio` + all `trades` where `status='OPEN'`

**Returns**:
```json
{
  "portfolio": {
    "balance_usd": 48250.00,
    "is_locked": false
  },
  "open_orders": [
    {
      "id": "uuid-1",
      "ticker": "BTC-USD",
      "side": "SELL",
      "order_type": "LIMIT",
      "amount": 0.3,
      "limit_price": 100000.00,
      "created_at": "2024-01-15T08:30:00Z"
    }
  ]
}
```

**When agent uses it**:
- User asks "What do I own?"
- User asks "Do I have any open orders?"
- Agent needs to know positions before suggesting a trade

**No side effects** - read-only

---

#### **Tool 3: `execute_trade(ticker, side, order_type, amount, limit_price?)`**

**What it does**: Initiates a trade on behalf of the agent

**Parameters**:
- `ticker`: string ("BTC-USD", "ETH-USD")
- `side`: "BUY" or "SELL"
- `order_type`: "MARKET", "LIMIT", or "STOP_LOSS"
- `amount`: float (quantity to trade)
- `limit_price`: float (required for LIMIT/STOP_LOSS, null for MARKET)

**CRITICAL BEHAVIOR**: This tool has `interrupt_before=True` in LangGraph

**Execution Flow**:
1. Agent decides to trade, calls tool
2. LangGraph **PAUSES** execution (checkpointing)
3. Tool inserts into `trades` with `status="PENDING_APPROVAL"`
4. Backend sends WebSocket message:
```json
{
  "type": "APPROVAL_REQUEST",
  "trade_id": "uuid-123",
  "trade": {
    "ticker": "BTC-USD",
    "side": "SELL",
    "order_type": "MARKET",
    "amount": 1.0
  },
  "agent_message": "I'm selling your entire BTC position. Market is crashing!"
}
```
5. Frontend shows confirmation modal
6. User clicks CONFIRM or DENY
7. Frontend sends WebSocket response:
```json
{
  "type": "TRADE_DECISION",
  "trade_id": "uuid-123",
  "approved": true
}
```
8. Backend resumes LangGraph execution:
   - If approved: Updates trade to `status="OPEN"`, updates balance, returns success
   - If denied: Deletes trade row, returns "Trade cancelled by user"

**When agent uses it**:
- risk_score > 90 and agent wants to sell to protect capital
- User explicitly asks agent to execute a trade
- Agent sees opportunity and recommends a limit order

---

#### **Tool 4: `lock_user_account(reason, duration_seconds=300)`**

**What it does**: Disables all trading buttons in the UI

**Parameters**:
- `reason`: string (e.g., "Panic selling detected", "You're about to buy the top")
- `duration_seconds`: int (default 300 = 5 minutes)

**Execution**:
1. Updates `portfolio` table:
```sql
UPDATE portfolio SET 
  is_locked = TRUE,
  lock_reason = '<reason>',
  lock_expires_at = NOW() + INTERVAL '<duration_seconds> seconds'
```
2. Sends WebSocket message:
```json
{
  "type": "LOCK_UI",
  "reason": "Panic selling detected",
  "duration": 300
}
```
3. Frontend Supabase Realtime subscription detects change, disables buttons

**When agent uses it**:
- risk_score > 90 (MUST use)
- User trying to make multiple emotional trades rapidly
- User ignoring agent's warnings repeatedly

**Returns**: "Account locked for 300 seconds. Reason: <reason>"

---

## 🔊 WebSocket Protocol Specification

### Connection: `WS /ws/agent`

**Purpose**: Bi-directional real-time communication between frontend and agent

---

### Message Types: Client → Server

#### **`AUDIO_CHUNK`**
```json
{
  "type": "AUDIO_CHUNK",
  "data": "<base64_encoded_audio>"
}
```
- **When**: User is speaking (mic active)
- **Action**: Backend forwards to ElevenLabs Scribe → Gets text → Adds to agent conversation

---

#### **`USER_INTERRUPT`**
```json
{
  "type": "USER_INTERRUPT"
}
```
- **When**: User starts speaking while agent is talking
- **Action**: Backend cancels current TTS generation, agent goes silent to listen

---

#### **`TRADE_DECISION`**
```json
{
  "type": "TRADE_DECISION",
  "trade_id": "uuid-123",
  "approved": true
}
```
- **When**: User clicks CONFIRM or DENY on trade approval modal
- **Action**: Backend resumes LangGraph execution with user's decision

---

### Message Types: Server → Client

#### **`AGENT_AUDIO`**
```json
{
  "type": "AGENT_AUDIO",
  "data": "<base64_encoded_audio>",
  "text": "Market is crashing! I'm selling everything!"
}
```
- **When**: Agent speaks
- **Action**: Frontend plays audio + appends text to transcript

---

#### **`AGENT_TEXT`** (transcript only, no audio)
```json
{
  "type": "AGENT_TEXT",
  "text": "[Tool: Checking market sentiment...]"
}
```
- **When**: Agent is using a tool (shows in transcript but doesn't speak it)
- **Action**: Frontend appends to transcript as system message

---

#### **`INTERRUPT`** (Server-side crash)
```json
{
  "type": "INTERRUPT",
  "message": "MARKET CRASHING! STOP EVERYTHING!"
}
```
- **When**: Trigger Monitor detects risk_score > 80
- **Action**:
  1. Frontend stops any playing audio
  2. Clears audio queue
  3. Flashes screen red
  4. System message injected into agent conversation
  5. Agent generates urgent response with audio tags

---

#### **`APPROVAL_REQUEST`**
```json
{
  "type": "APPROVAL_REQUEST",
  "trade_id": "uuid-123",
  "trade": {
    "ticker": "BTC-USD",
    "side": "SELL",
    "order_type": "MARKET",
    "amount": 1.0,
    "estimated_value": 96500.00
  },
  "agent_message": "I'm dumping your Bitcoin RIGHT NOW. Confirm or stay poor!"
}
```
- **When**: Agent calls `execute_trade()` tool
- **Action**: Frontend opens confirmation modal

---

#### **`LOCK_UI`**
```json
{
  "type": "LOCK_UI",
  "reason": "Panic detected - protecting your capital",
  "duration": 300
}
```
- **When**: Agent calls `lock_user_account()` tool
- **Action**: Frontend disables all trading buttons, shows lock overlay

---

## 🎙️ ElevenLabs Voice Pipeline (Detailed)

### Why ElevenLabs V3?

**V3 (Turbo 2.5 / Flash V3)** supports **Audio Tags** - inline directives that control voice emotion, speed, and delivery WITHOUT needing separate voice models.

**Traditional TTS**: "The market is crashing" → Monotone delivery
**V3 with Tags**: "[panicked] [fast] The market is crashing!" → Actual panic in voice

---

### Voice Input: Speech-to-Text (STT)

**Service**: ElevenLabs Scribe v2

**How it works**:
1. Frontend captures user microphone audio (WebRTC)
2. Audio streamed as base64 chunks via WebSocket
3. Backend forwards chunks to ElevenLabs Scribe WebSocket API
4. Scribe returns real-time text transcription
5. Text added to agent conversation as `HumanMessage`

**Key Features**:
- **Real-time streaming**: No need to wait for user to finish speaking
- **Low latency**: ~200ms transcription delay
- **No batching required**: Processes audio as it arrives

**Implementation Flow**:
```
User speaks → Frontend mic capture → WS: AUDIO_CHUNK → Backend → 
ElevenLabs Scribe → Text → Agent conversation
```

---

### Voice Output: Text-to-Speech (TTS)

**Service**: ElevenLabs V3 (Turbo 2.5 or Flash V3)

**Voice Model**: Use an "Anime Girl" or "Aggressive Female" voice from ElevenLabs library
- Recommended: "Bella" (expressive) or custom cloned voice

**How it works**:
1. Agent generates text response (from LLM)
2. Backend adds audio tags based on context
3. Text sent to ElevenLabs TTS API with voice_id
4. TTS returns audio stream (MP3 or PCM)
5. Audio streamed to frontend via WebSocket
6. Frontend plays audio + displays text in transcript

---

### Audio Tags Reference (V3)

These tags MUST be included in the agent's text output to sound realistic.

| Tag | When to Use | Example |
|-----|-------------|---------|
| `[shouting]` | risk_score > 80, user making bad decision | `[shouting] STOP BUYING!` |
| `[whispering]` | Sharing insider info, alpha, secrets | `[whispering] The whales are dumping` |
| `[fast]` | Listing data, numbers, during market chaos | `[fast] Price 96500 down 5 percent` |
| `[slow]` | Emphasizing important point | `[slow] You. Will. Lose. Everything.` |
| `[sighs]` | User hesitating, being indecisive | `[sighs] Fine, I'll check the vibes` |
| `[panicked]` | Market crash, emergency alert | `[panicked] Bitcoin is dumping RIGHT NOW!` |
| `[laughs]` | User made obvious mistake | `[laughs] You bought the top didn't you` |
| `[gasps]` | Sudden realization, shock | `[gasps] Polymarket odds just collapsed!` |

**Example Agent Output**:
```
Input (from LLM): "The market is crashing. I need to sell your Bitcoin immediately."

Enhanced (before TTS):
"[panicked] [fast] The market is CRASHING! [shouting] I'm selling your Bitcoin RIGHT NOW before you lose everything! [gasps] Polymarket odds just collapsed 15 percent!"
```

---

### Agent Text Enhancement Layer

**Where**: Between LLM output and TTS input

**Purpose**: Automatically inject audio tags based on context

**Logic**:
```python
def enhance_agent_text(text: str, context: dict) -> str:
    risk_score = context['risk_score']
    
    # Emergency situations
    if risk_score > 90:
        text = f"[panicked] {text}"
    elif risk_score > 80:
        text = f"[shouting] {text}"
    
    # Add [fast] to numbers
    text = re.sub(r'(\d+[\d,\.]*)', r'[fast]\1[/fast]', text)
    
    # Add [whispering] to specific phrases
    if 'whale' in text.lower() or 'insider' in text.lower():
        text = f"[whispering] {text}"
    
    return text
```

**Example Flow**:
1. LLM generates: "Bitcoin price is 96500, down 5%. Reddit sentiment is panic."
2. Enhancement layer: "[fast] Bitcoin price is 96500 [/fast], down [fast] 5% [/fast]. [shouting] Reddit sentiment is PANIC!"
3. Sent to ElevenLabs V3
4. Audio output sounds urgent and dynamic

---


### Interruption Handling (Voice-Specific)

**Server-Side Interrupt**:
```python
async def trigger_crash_interrupt(ws_manager):
    # 1. Cancel any ongoing TTS generation
    elevenlabs_client.cancel_current_generation()

    # 2. Generate urgent alert with context
    context = get_latest_market_context()
    text = f"[panicked] [shouting] Bitcoin dumping {context['price_change_24h']}%! Polymarket odds collapsed!"

    # 3. Generate audio with tags
    audio = await elevenlabs_client.generate(text)

    # 4. Send interrupt with generated audio
    await ws_manager.broadcast({
        "type": "INTERRUPT",
        "audio": audio,
        "text": text
    })
```

**Client-Side Interrupt** (User speaks):
```python
async def handle_user_interrupt():
    # 1. Stop audio playback immediately
    audio_player.stop()
    
    # 2. Cancel TTS stream
    elevenlabs_stream.cancel()
    
    # 3. Notify agent
    agent_state.is_interrupted = True
    
    # 4. Start listening to user
    await handle_user_audio_stream()
```

---

## ⚡ Interruption Logic (Detailed Flow)

### Scenario A: Server-Side Interrupt (Market Crash)

**Trigger**: Trigger Monitor detects risk_score > 80

**Step-by-step**:
1. Monitor Worker calculates risk_score = 92
2. Monitor calls LLM: "Generate urgent alert for: BTC -5%, odds collapsed, Reddit panic"
3. LLM returns: "URGENT: Bitcoin dumping! Polymarket whales exiting! Reddit screaming SELL!"
4. Monitor sends WebSocket broadcast:
```json
{
  "type": "INTERRUPT",
  "message": "URGENT: Bitcoin dumping! Polymarket whales exiting!"
}
```
5. Frontend receives → Stops current audio → Flashes screen
6. Monitor injects System Message into Agent:
```
SYSTEM_ALERT: risk_score=92. Bitcoin down 5% in 10 minutes. Polymarket odds collapsed 15%. Reddit sentiment: PANIC. Keywords: Liquidation, Rekt, Dump. INTERVENE IMMEDIATELY.
```
7. Agent processes message → Calls `get_market_sentiment()` → Decides to lock account or sell
8. Agent speaks: "[panicked] STOP! I'm locking your account before you panic sell the bottom!"

---

### Scenario B: Client-Side Interrupt (User Interrupts Agent)

**Trigger**: User starts speaking while agent is talking

**Step-by-step**:
1. Frontend VAD (Voice Activity Detection) detects user voice
2. Frontend immediately:
   - Pauses audio playback
   - Clears audio queue
   - Sends WebSocket: `{"type": "USER_INTERRUPT"}`
3. Backend receives interrupt:
   - Cancels current ElevenLabs TTS generation
   - Tells agent to stop speaking
4. Backend starts listening to user audio chunks
5. User finishes speaking → Text added to conversation
6. Agent responds to user's question

---

## 🔄 Background Workers Specification

### Worker 1: Data Ingest

**File**: `workers/ingest.py`

**Run interval**: Every 10 seconds

**What it does**:

1. **Fetch External Data** (parallel async calls):
   - Alpaca Service: Read current BTC price from in-memory cache (live websocket data)
     - NOTE: `app/services/coingecko.py` exists but is NOT used - Alpaca provides all price data
   - Polymarket Gamma API: Top 4-5 BTC-related prediction markets
   - Reddit JSON: r/wallstreetbets, r/Polymarket, r/PredictionMarket, r/pennystocks (10 posts each)

2. **Process with LLM** (GPT-4o-mini):
   - Prompt: "Analyze this market data. Return JSON with: hype_score (0-100), sentiment (BULLISH/BEARISH/PANIC), keywords (array), polymarket_summary (string)"
   - Example input to LLM:
```json
{
  "btc_price": 96500,
  "price_change_24h": -2.3,
  "polymarket_markets": [
    {"name": "BTC > 100k", "odds": 0.68, "volume": "2.4M"},
    {"name": "BTC ETF approval", "odds": 0.89, "volume": "5.1M"}
  ],
  "reddit_posts": [
    {"title": "BTC breaking out!!", "sub": "r/wallstreetbets"},
    {"title": "Volume looking weak", "sub": "r/wallstreetbets"}
  ]
}
```
   - Example LLM output:
```json
{
  "hype_score": 72,
  "sentiment": "BULLISH",
  "keywords": ["breakout", "YOLO", "moon"],
  "polymarket_summary": "Odds high for 100k, ETF approval likely"
}
```

3. **Write to Database**:
   - Insert into `market_context`: summary, sentiment stats, price data, polymarket odds (risk_score=0)
   - Upsert into `feed_items` (source='POLYMARKET'): Market names, odds, volumes, URLs
   - Upsert into `feed_items` (source='REDDIT'): Post text, username, subreddit, sentiment, URLs
   - Upsert into `watchlist`: ETH, SOL, AVAX, MATIC prices

4. **Sleep 10 seconds** and repeat

---

### Worker 2: Trigger Monitor

**File**: `workers/monitor.py`

**Run interval**: Every 1 second

**What it does**:

1. **Read Latest Context**:
   - Query `market_context` ORDER BY created_at DESC LIMIT 1

2. **Calculate risk_score** (weighted formula):
```python
# Read latest market_context
context = get_latest_market_context()

# Calculate weighted risk_score
sentiment_component = context['sentiment_score'] * 0.3       # 30% weight
technical_component = abs(context['price_change_24h']) * 0.3 # 30% weight
polymarket_component = abs(context['polymarket_avg_odds'] - 0.5) * 0.4  # 40% weight

risk_score = sentiment_component + technical_component + polymarket_component

# Clamp to 0-100
risk_score = max(0, min(100, int(risk_score)))

# UPDATE the market_context row with calculated risk_score
update_market_context_risk_score(context['id'], risk_score)
```

3. **Decision Logic**:
   - If risk_score < 80: Do nothing, sleep 1s
   - If risk_score >= 80: **TRIGGER ALERT**

4. **Alert Flow** (when triggered):
   - Call LLM: "Generate brief urgent alert for agent given this data: <market_context>"
   - LLM returns: "Bitcoin down 5%, Polymarket whales dumping, Reddit panic mode"
   - Send WebSocket INTERRUPT message
   - Inject SYSTEM_ALERT into agent conversation queue

5. **Sleep 1 second** and repeat

---

## 🧠 Agent State Management

### LangGraph State Object

```python
class AgentState:
    messages: List[BaseMessage]      # Conversation history
    risk_score: int                  # Latest from market_context
    portfolio: dict                  # {balance, is_locked}
    pending_trade: Optional[dict]    # Active trade awaiting approval
```

### State Updates

**On user message**:
- Add HumanMessage to `messages`
- Agent processes → Returns AIMessage + potential tool calls

**On tool execution**:
- Tool returns result → Add ToolMessage to `messages`
- If tool is `execute_trade` → State updates `pending_trade`
- If tool is `lock_user_account` → State updates `portfolio.is_locked`

**On system alert**:
- Trigger Monitor injects SystemMessage:
```python
SystemMessage(content="SYSTEM_ALERT: risk_score=92, market crashing, intervene NOW")
```
- Agent reads message → Calls tools → Speaks warning

---

## ⚙️ Environment Variables

**File**: `.env`

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_KEY=eyJxxx...  # For backend writes

# OpenAI (for agent LLM + data processing)
OPENAI_API_KEY=sk-xxx

# ElevenLabs
ELEVENLABS_API_KEY=xxx
ELEVENLABS_VOICE_ID=xxx  # Your chosen anime voice

# Alpaca (for live market data and trading)
ALPACA_API_KEY=xxx
ALPACA_SECRET_KEY=xxx

# Polymarket (no key needed for public API)

# Reddit (use JSON endpoint, no auth required)

# Server Config
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=development  # or production

# Demo Mode
ENABLE_CRASH_BUTTON=true
```

---

## 🛡️ Error Handling Strategy

### API Failures
**Alpaca/Polymarket/Reddit Down**:
**CoinGecko/Polymarket/Reddit Down**:
```python
    # Read from Alpaca's in-memory price cache
    price = alpaca_service.get_price("BTCUSD")
    if not price:
        raise Exception("No price data available")
    data = await fetch_coingecko()
    logger.error(f"Alpaca price unavailable: {e}")
    # Fallback to last known data from database
    data = get_last_market_context_from_db()
    data = get_last_cached_price()
```

**LLM API Failures**:
```python
try:
    analysis = await openai_client.chat.completions.create(...)
except Exception as e:
    logger.error(f"OpenAI failed: {e}")
    # Use heuristic-only fallback
    analysis = {
        "hype_score": calculate_keyword_score(reddit_posts),
        "sentiment": "UNKNOWN",
        "summary": "Data unavailable, using limited analysis"
    }
```

---

### Database Failures

**Supabase Connection Lost**:
```python
try:
    await supabase.table("market_context").insert(data)
except Exception as e:
    logger.error(f"DB write failed: {e}")
    # Buffer in memory, retry on next cycle
    failed_writes_buffer.append(data)
```

**On reconnection**: Flush buffer to database

---

### WebSocket Disconnections

**Client Disconnects**:
```python
@app.websocket("/ws/agent")
async def websocket_endpoint(websocket: WebSocket):
    try:
        await manager.connect(websocket)
        while True:
            data = await websocket.receive_json()
            # Handle message
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        # Clean up agent state for this connection
        agent_sessions.pop(websocket.id, None)
```

---

### Voice Pipeline Failures

**ElevenLabs TTS Timeout**:
```python
try:
    audio = await elevenlabs.generate(text, timeout=5.0)
except TimeoutError:
    # Send text-only message to frontend
    await ws.send_json({
        "type": "AGENT_TEXT",
        "text": text,
        "error": "Audio generation timeout"
    })
```

**Scribe STT Errors**:
```python
try:
    text = await scribe.transcribe(audio_chunk)
except Exception as e:
    logger.error(f"STT failed: {e}")
    # Continue listening, skip this chunk
    pass
```

---

### Agent/LangGraph Errors

**Tool Execution Failure**:
```python
@tool
def execute_trade(...):
    try:
        # Execute trade logic
        result = place_order(...)
        return result
    except InsufficientFunds:
        return "ERROR: Insufficient balance for this trade"
    except Exception as e:
        logger.error(f"Trade execution failed: {e}")
        return "ERROR: Trade failed. Please try again."
```

**LangGraph State Corruption**:
```python
try:
    response = await agent_graph.ainvoke(state)
except Exception as e:
    logger.error(f"Agent crashed: {e}")
    # Reset to clean state
    state = initialize_clean_state()
    # Notify user
    await ws.send_json({
        "type": "AGENT_TEXT",
        "text": "[sighs] Sorry, I glitched. What were you saying?"
    })
```

---

### Graceful Degradation

**Priority Levels** (when things break):

1. **Critical** - Keep running:
   - Manual trading (REST API)
   - Portfolio display
   - Basic market data

2. **Important** - Degrade gracefully:
   - Agent voice → Fall back to text-only
   - Real-time data → Use cached/delayed data
   - Prediction markets → Use simpler heuristics

3. **Nice-to-have** - Can fail:
   - Reddit sentiment (not critical for basic function)
   - Audio tags (text still works)
   - Lock feature (manual override available)

---

## 🧪 Testing Checklist

**REST API**:
- [ ] GET /api/portfolio returns correct balance
- [ ] POST /api/orders creates order in database
- [ ] DELETE /api/orders/{id} cancels order
- [ ] GET /api/polymarket returns feed_items
- [ ] GET /api/reddit returns feed_items
- [ ] GET /api/vibes returns latest market_context

**Workers**:
- [ ] Data Ingest writes to market_context every 10s
- [ ] Data Ingest writes to feed_items (both sources)
- [ ] Trigger Monitor calculates risk_score correctly
- [ ] Trigger Monitor sends INTERRUPT when risk_score > 80

**Agent**:
- [ ] get_market_sentiment() returns latest data
- [ ] list_holdings() returns portfolio + open orders
- [ ] execute_trade() pauses for approval
- [ ] lock_user_account() updates database + sends WebSocket
- [ ] Agent responds to user voice input
- [ ] Agent uses tools appropriately
- [ ] Audio tags properly injected into TTS

**WebSocket**:
- [ ] AUDIO_CHUNK → text transcription works
- [ ] USER_INTERRUPT stops agent speech
- [ ] APPROVAL_REQUEST opens modal
- [ ] TRADE_DECISION resumes LangGraph
- [ ] INTERRUPT plays scream + injects system message
- [ ] AGENT_AUDIO plays + shows in transcript

**Voice Pipeline**:
- [ ] User voice → Scribe STT → correct transcription
- [ ] Agent text → V3 TTS → audio with proper emotion
- [ ] Pre-generated scream plays instantly
- [ ] Audio tags ([shouting], [fast], etc.) work correctly
- [ ] Interruption stops audio immediately

**Demo Flow**:
- [ ] Press C → Crash triggered → Scream plays → Agent screams
- [ ] Agent proposes trade → Modal appears
- [ ] Confirm trade → Order executes
- [ ] risk_score > 90 → Account locked
- [ ] Locked state disables frontend buttons
- [ ] User speaks → Agent listens → Agent responds

---

## 📊 Complete System Diagram

```mermaid
graph TB
        CG[CoinGecko API<br/>BTC Price]
        CG[CoinGecko API<br/>BTC Price]
        PM[Polymarket API<br/>Prediction Markets]
        RD[Reddit JSON<br/>Social Sentiment]
    end

    subgraph "Background Workers"
        DI[Data Ingest Worker<br/>Every 10s]
        TM[Trigger Monitor<br/>Every 1s]
    end

    subgraph "AI Services"
        LLM1[OpenAI GPT-4o-mini<br/>Data Processing]
        LLM2[OpenAI GPT-4o<br/>Agent Brain]
        EL_STT[ElevenLabs Scribe<br/>Speech-to-Text]
        EL_TTS[ElevenLabs V3<br/>Text-to-Speech]
    end

    subgraph "Database (Supabase)"
        DB_MC[(market_context<br/>Time-series)]
        DB_FI[(feed_items<br/>UI Display Data)]
        DB_P[(portfolio<br/>Balance & Lock)]
        DB_T[(trades<br/>Order Book)]
    end

    subgraph "Backend (FastAPI)"
        WS[WebSocket Manager<br/>/ws/agent]
        REST[REST API<br/>CRUD endpoints]
        AGENT[LangGraph Agent<br/>State Machine]
        
        subgraph "Agent Tools"
            T1[get_market_sentiment]
            T2[list_holdings]
            T3[execute_trade<br/>INTERRUPT_BEFORE]
            T4[lock_user_account]
        end
    end

    subgraph "Frontend (Next.js)"
        UI_DASH[Trading Dashboard]
        UI_CHART[Price Chart]
        UI_POLY[Polymarket Feed]
        UI_RED[Reddit Feed]
        UI_AGENT[Agent Sidebar<br/>Audio + Transcript]
        UI_ORDERS[Active Orders Table]
        UI_MODAL[Trade Approval Modal]
    end

    %% Data Ingest Flow
    DI -->|Read Prices| ALP
    DI -->|Fetch| PM
    DI -->|Fetch| RD
    DI -->|Process| LLM1
    LLM1 -->|Analysis| DI
    DI -->|Write| DB_MC
    DI -->|Write| DB_FI

    %% Trigger Monitor Flow
    TM -->|Read Latest| DB_MC
    TM -->|If score > 80| LLM1
    LLM1 -->|Alert Text| TM
    TM -->|INTERRUPT| WS
    TM -->|Inject Alert| AGENT

    %% Frontend → Backend (User Actions)
    UI_AGENT -->|User Voice| WS
    WS -->|Audio Chunks| EL_STT
    EL_STT -->|Text| AGENT
    
    UI_ORDERS -->|Cancel Order| REST
    UI_DASH -->|Manual Trade| REST
    
    %% Backend → Database (REST API)
    REST -->|Read/Write| DB_P
    REST -->|Read/Write| DB_T
    
    %% Agent Tool Calls
    AGENT -->|Call| T1
    AGENT -->|Call| T2
    AGENT -->|Call| T3
    AGENT -->|Call| T4
    
    T1 -->|Read| DB_MC
    T2 -->|Read| DB_P
    T2 -->|Read| DB_T
    T3 -->|Write PENDING| DB_T
    T3 -->|Pause & Request| WS
    T4 -->|Update Lock| DB_P
    T4 -->|Send Lock Event| WS
    
    %% Agent Response Flow
    AGENT -->|Text Response| LLM2
    LLM2 -->|Enhanced Text| EL_TTS
    EL_TTS -->|Audio Stream| WS
    
    %% WebSocket → Frontend
    WS -->|AGENT_AUDIO| UI_AGENT
    WS -->|INTERRUPT| UI_AGENT
    WS -->|APPROVAL_REQUEST| UI_MODAL
    WS -->|LOCK_UI| UI_DASH
    
    %% Frontend Data Display
    REST -->|/api/polymarket| UI_POLY
    REST -->|/api/reddit| UI_RED
    REST -->|/api/vibes| UI_CHART
    REST -->|/api/portfolio| UI_DASH
    REST -->|/api/orders| UI_ORDERS
    
    %% Trade Approval Flow
    UI_MODAL -->|TRADE_DECISION| WS
    WS -->|Resume Graph| AGENT
    AGENT -->|Execute or Cancel| DB_T
    
    %% Supabase Realtime
    DB_P -.->|Realtime Subscribe| UI_DASH
    DB_T -.->|Realtime Subscribe| UI_ORDERS

    %% Styling
    classDef external fill:#ff6b6b,stroke:#c92a2a,color:#fff
    classDef worker fill:#4ecdc4,stroke:#16a085,color:#fff
    classDef ai fill:#a29bfe,stroke:#6c5ce7,color:#fff
    classDef db fill:#feca57,stroke:#ff9ff3,color:#000
    classDef backend fill:#48dbfb,stroke:#0abde3,color:#000
    classDef frontend fill:#1dd1a1,stroke:#10ac84,color:#fff
    classDef tool fill:#fd79a8,stroke:#e84393,color:#fff
    
    class ALP,PM,RD external
    class DI,TM worker
    class LLM1,LLM2,EL_STT,EL_TTS ai
    class DB_MC,DB_FI,DB_P,DB_T db
    class WS,REST,AGENT backend
    class T1,T2,T3,T4 tool
    class UI_DASH,UI_CHART,UI_POLY,UI_RED,UI_AGENT,UI_ORDERS,UI_MODAL frontend
```

---

**This is the complete backend architecture. Everything is defined. Ready for implementation.**
