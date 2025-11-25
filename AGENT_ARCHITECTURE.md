# LangGraph Agent + ElevenLabs Voice Architecture

> **Technical deep-dive into the LangGraph agent, interrupt mechanisms, and ElevenLabs STT/TTS integration**

---

## Table of Contents

1. [LangGraph Agent Overview](#1-langgraph-agent-overview)
2. [Agent State Management](#2-agent-state-management)
3. [Interrupt & State Injection Mechanisms](#3-interrupt--state-injection-mechanisms)
4. [ElevenLabs STT/TTS Integration](#4-elevenlabs-stttts-integration)
5. [WebSocket Message Flow](#5-websocket-message-flow)
6. [Complete Architecture Diagram](#6-complete-architecture-diagram)

---

## 1. LangGraph Agent Overview

### File: `/backend-new/app/agent/graph.py`

The LangGraph agent is a **cyclic graph** with checkpointing for conversation memory.

### Graph Structure

```python
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI
from app.agent.state import AgentState
from app.agent.tools import ALL_TOOLS

# Initialize GPT-4o with tools
llm = ChatOpenAI(model="gpt-4o", temperature=0.7)
llm_with_tools = llm.bind_tools(ALL_TOOLS)

# Build the graph
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("agent", call_agent)
workflow.add_node("tools", call_tools)

# Set entry point
workflow.set_entry_point("agent")

# Add conditional routing
workflow.add_conditional_edges(
    "agent",
    should_continue,
    {
        "tools": "tools",
        "end": END,
    }
)

# Loop tools back to agent
workflow.add_edge("tools", "agent")

# Compile with checkpointing
memory = MemorySaver()
agent_graph = workflow.compile(checkpointer=memory)
```

### Execution Flow

```
┌──────────────────────────────────────────────┐
│  START                                       │
│    ↓                                         │
│  agent (call GPT-4o with tools)              │
│    ↓                                         │
│  should_continue() ← router function         │
│    ├─ has tool_calls? → tools node           │
│    │                      ↓                   │
│    │                    execute tools         │
│    │                      ↓                   │
│    │                    back to agent ←──┐   │
│    │                                      │   │
│    └─ no tool_calls? → END                │   │
│                                            │   │
│    (Agent can loop multiple times) ────────┘   │
└──────────────────────────────────────────────┘
```

### Node Functions

#### `call_agent(state: AgentState) -> AgentState`

Calls GPT-4o with bound tools and returns updated state.

```python
def call_agent(state: AgentState) -> AgentState:
    messages = list(state["messages"])

    # Inject system prompt if missing
    if not messages or not isinstance(messages[0], SystemMessage):
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + messages

    # Call LLM with tools
    response = llm_with_tools.invoke(messages)

    # Return updated state
    return {
        **state,
        "messages": messages + [response],  # Append agent response to history
    }
```

**Key Points:**
- Preserves full message history
- System prompt injected automatically
- Agent response contains either `content` (text) or `tool_calls` (function calls)

#### `should_continue(state: AgentState) -> Literal["tools", "end"]`

Router that decides next step based on agent's response.

```python
def should_continue(state: AgentState) -> Literal["tools", "end"]:
    messages = state["messages"]
    last_message = messages[-1]

    # If agent wants to use tools, continue to tools node
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"

    # Otherwise end the conversation
    return "end"
```

**Returns:**
- `"tools"` → Execute tools and loop back to agent
- `"end"` → Stop execution (agent gave final text response)

#### `call_tools(state: AgentState) -> AgentState`

Executes tools requested by the agent (async).

```python
async def call_tools(state: AgentState) -> AgentState:
    messages = list(state["messages"])
    last_message = messages[-1]

    tool_messages = []
    for tool_call in last_message.tool_calls:
        # Find matching tool
        tool = next((t for t in ALL_TOOLS if t.name == tool_call["name"]), None)

        if tool:
            # Execute tool asynchronously
            result = await tool.ainvoke(tool_call["args"])

            # Create ToolMessage with result
            tool_messages.append(
                ToolMessage(
                    content=str(result),
                    tool_call_id=tool_call["id"],
                    name=tool_call["name"]
                )
            )

    # Append tool results to history
    return {
        **state,
        "messages": messages + tool_messages,
    }
```

**Key Points:**
- Supports multiple tool calls in parallel
- Tool results become `ToolMessage` objects
- Agent sees tool results in next iteration

### Checkpointing & Thread Management

```python
from langgraph.checkpoint.memory import MemorySaver

memory = MemorySaver()
agent_graph = workflow.compile(checkpointer=memory)

# Usage with thread_id for conversation persistence
config = {"configurable": {"thread_id": "session-123"}}

async for event in agent_graph.astream(
    {"messages": [HumanMessage(content="Buy 0.5 BTC")]},
    config=config,
    stream_mode="values"
):
    # Process streamed state updates
    pass
```

**How it works:**
- `MemorySaver()` stores conversation history in memory
- Each `thread_id` maintains separate conversation state
- State persists across multiple `.astream()` calls with same `thread_id`

---

## 2. Agent State Management

### File: `/backend-new/app/agent/state.py`

```python
from typing import Annotated, Sequence, Optional
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage

class AgentState(TypedDict):
    """State that flows through the LangGraph agent"""

    messages: Annotated[Sequence[BaseMessage], add_messages]
    risk_score: int
    risk_level: str
    portfolio_locked: bool
    lock_reason: Optional[str]
    pending_trade_id: Optional[str]
    requires_approval: bool
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `messages` | `Annotated[Sequence[BaseMessage], add_messages]` | **Full conversation history** (HumanMessage, AIMessage, SystemMessage, ToolMessage). The `add_messages` annotation automatically appends new messages instead of replacing them. |
| `risk_score` | `int` | Current market risk level (0-100) |
| `risk_level` | `str` | Risk category: `"Low"`, `"Medium"`, or `"High"` |
| `portfolio_locked` | `bool` | Whether trading is currently disabled |
| `lock_reason` | `Optional[str]` | Why the account is locked (if locked) |
| `pending_trade_id` | `Optional[str]` | ID of trade awaiting user approval |
| `requires_approval` | `bool` | Whether agent is waiting for user decision |

### The Magic of `add_messages`

```python
from langgraph.graph.message import add_messages

# This annotation makes LangGraph automatically merge messages:
messages: Annotated[Sequence[BaseMessage], add_messages]
```

**What it does:**
- When you return `{"messages": [new_message]}` from a node, LangGraph **appends** it to existing messages
- Without this annotation, it would **replace** the entire list
- Enables automatic conversation history management

**Example:**
```python
# State before: {"messages": [HumanMessage("Hi")]}

# Node returns: {"messages": [AIMessage("Hello!")]}

# State after: {"messages": [HumanMessage("Hi"), AIMessage("Hello!")]}
```

---

## 3. Interrupt & State Injection Mechanisms

There are **THREE** interrupt/injection mechanisms:

### A. User Voice Interruption (TTS Audio Stream)

**Location:** `/backend-new/app/api/voice_websocket.py` (lines 70-100)

**Scenario:** User speaks while agent is speaking

**How it works:**

```python
async def handle_audio_input(self, audio_base64: str):
    """Handle incoming audio from user"""

    # INTERRUPT: If agent is speaking, stop immediately
    if self.is_speaking and self.tts_task and not self.tts_task.done():
        logger.info("🛑 User interrupted - cancelling TTS")

        # 1. Close TTS WebSocket connection IMMEDIATELY
        if self.current_tts:
            await self.current_tts.close()
            self.current_tts = None

        # 2. Cancel the asyncio TTS task
        self.tts_task.cancel()
        try:
            await self.tts_task
        except asyncio.CancelledError:
            pass

        # 3. Reset speaking state
        self.is_speaking = False

        # 4. Notify frontend speech was interrupted
        await self.send_message({
            "type": "agent_speaking",
            "is_speaking": False
        })

    # Continue with STT processing...
```

**Key Steps:**
1. **Detect interrupt:** Check if `is_speaking=True` and TTS task is running
2. **Close WebSocket:** Immediately close active TTS connection (`await self.current_tts.close()`)
3. **Cancel task:** Cancel the asyncio task streaming audio
4. **Notify frontend:** Send `agent_speaking: false` message
5. **Process new audio:** Continue with user's new speech input

**Visual Flow:**
```
User speaking → Audio chunk arrives → Is agent speaking?
                                            ├─ YES: Close TTS WS
                                            │       Cancel TTS task
                                            │       Set is_speaking=False
                                            │       ↓
                                            └─ NO:  Continue normally

                                            ↓
                                      Send audio to STT
```

---

### B. System Alert State Injection (LangGraph Message Injection)

**Location:** `/backend-new/app/api/voice_websocket.py` (lines 278-377)

**Scenario:** Server triggers emergency alert (market crash/pump)

**How it works:**

```python
async def process_system_alert(self, alert_text: str, alert_context: dict):
    """Process a system alert through the agent and speak the response"""

    # Build context from alert data
    risk_score = alert_context.get('risk_score', 0)
    hype_score = alert_context.get('hype_score', 0)
    btc_price = alert_context.get('btc_price', 0)
    price_change = alert_context.get('price_change_24h', 0)

    # Determine BEAR or MOON case
    is_bear = risk_score >= 80 or price_change <= -5.0
    is_moon = hype_score >= 90 or price_change >= 5.0

    # Build system context with emergency protocols
    context_lines = [
        f"URGENT SYSTEM ALERT:",
        f"Risk Score: {risk_score}/100",
        f"BTC Price: ${btc_price:,.2f}",
        f"24h Change: {price_change:+.2f}%",
        "",
    ]

    if is_bear:
        context_lines.extend([
            "🐻 BEAR CASE DETECTED - Price crash/high risk!",
            "According to your EMERGENCY PROTOCOLS, you must:",
            "1. SCREAM about the crash using the alert data",
            "2. Call list_holdings() to check BTC positions",
            "3. Call execute_trade() to SELL 50-80% of BTC",
            "4. Call lock_user_account() to prevent panic buying",
            "5. Explain what you did"
        ])
    elif is_moon:
        context_lines.extend([
            "🚀 MOON CASE DETECTED - Price pump/high hype!",
            "According to your EMERGENCY PROTOCOLS, you must:",
            "1. SCREAM with EXCITEMENT using the alert data",
            "2. Call list_holdings() to check cash balance",
            "3. Call execute_trade() to BUY with 10-20% of cash",
            "4. DO NOT lock account",
            "5. Explain what you did"
        ])

    context_str = "\n".join(context_lines)

    # INJECT MESSAGES INTO LANGGRAPH
    config = {"configurable": {"thread_id": self.thread_id}}
    messages = []

    # 1. Add SystemMessage with full context
    messages.append(SystemMessage(content=f"{alert_text}\n\n{context_str}\n\nTake action NOW!"))

    # 2. Add HumanMessage to trigger agent action
    if is_bear:
        messages.append(HumanMessage(content="The market is crashing! Take protective action immediately!"))
    elif is_moon:
        messages.append(HumanMessage(content="Bitcoin is mooning! Catch this momentum NOW!"))

    # 3. Stream agent response (agent will call tools autonomously)
    agent_response_text = ""
    async for event in agent_graph.astream(
        {"messages": messages},
        config=config,
        stream_mode="values"
    ):
        if "messages" in event and event["messages"]:
            last_msg = event["messages"][-1]
            if hasattr(last_msg, "content") and last_msg.content:
                if not hasattr(last_msg, "tool_calls") or not last_msg.tool_calls:
                    agent_response_text = last_msg.content

    # 4. Speak the agent's response
    if agent_response_text:
        await self.speak_response(agent_response_text)
```

**Key Points:**

1. **SystemMessage injection:** Provides full alert context + emergency protocols
2. **HumanMessage trigger:** Forces agent to take action (not just acknowledge)
3. **Agent autonomy:** Agent decides which tools to call based on emergency protocols
4. **State persistence:** Alert + response are saved in thread history via checkpointing

**Message Flow:**
```
System Alert Triggered
    ↓
Build alert context (risk_score, price, hype_score)
    ↓
Determine scenario:
    ├─ BEAR: Risk ≥80 OR price_change ≤ -5%
    ├─ MOON: Hype ≥90 OR price_change ≥ +5%
    └─ OTHER: General alert
    ↓
Create messages:
    ├─ SystemMessage(EMERGENCY PROTOCOLS + context)
    └─ HumanMessage("Take action NOW!")
    ↓
Inject into LangGraph via agent_graph.astream()
    ↓
Agent processes:
    ├─ Calls list_holdings()
    ├─ Calls execute_trade(SELL 50-80% BTC)  [if BEAR]
    └─ Calls lock_user_account()             [if BEAR]
    ↓
Agent returns text response
    ↓
TTS speaks the response
```

**Why this works:**
- LangGraph's `add_messages` annotation merges injected messages into conversation history
- Agent sees both SystemMessage (context) and HumanMessage (trigger) in one turn
- Checkpointing preserves this as permanent part of conversation
- Agent can reference this alert in future turns

---

### C. Account Lock Safety Mechanism

**Location:** `/backend-new/app/agent/tools/lock.py`

**How it works:**

```python
@tool
async def lock_user_account(duration_seconds: int = 30, reason: str = "Emergency lock") -> str:
    """
    Emergency account lock to prevent trading during high-risk periods

    Args:
        duration_seconds: How long to lock (default 30s)
        reason: Why the account is being locked
    """
    # Calculate expiry time
    lock_expires_at = datetime.utcnow() + timedelta(seconds=duration_seconds)

    # Update Supabase
    supabase.table('users').update({
        'is_locked': True,
        'lock_reason': reason,
        'lock_expires_at': lock_expires_at.isoformat()
    }).eq('id', user_id).execute()

    return f"Account locked for {duration_seconds}s. Reason: {reason}"
```

**Effect:**
- Sets `is_locked=True` in database
- Trading UI buttons become disabled
- Order API rejects requests with lock error
- Auto-unlocks after expiry time

**When called:**
- Market crash (risk_score ≥ 85)
- Agent detects panic trading patterns
- System alert triggers BEAR emergency protocol

---

## 4. ElevenLabs STT/TTS Integration

### File: `/backend-new/app/services/elevenlabs_service.py`

---

### A. Speech-to-Text (STT)

**Class:** `ElevenLabsSTT`

**WebSocket URL:** `wss://api.elevenlabs.io/v1/speech-to-text/realtime`

**Model:** `scribe_v2_realtime` (English)

#### Connection

```python
class ElevenLabsSTT:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.ws_url = "wss://api.elevenlabs.io/v1/speech-to-text/realtime"
        self.websocket = None

    async def connect(self, sample_rate: int = 16000, codec: str = "pcm"):
        # Build WebSocket URL with query params
        url = f"{self.ws_url}?model_id=scribe_v2_realtime&language=en"

        # Connect with API key in headers
        self.websocket = await websockets.connect(
            url,
            additional_headers={"xi-api-key": self.api_key}
        )

        return True
```

**Headers:**
```http
xi-api-key: <your_elevenlabs_api_key>
```

**Query Params:**
- `model_id=scribe_v2_realtime` - ElevenLabs realtime STT model
- `language=en` - English transcription

#### Sending Audio

```python
async def send_audio(self, audio_base64: str, sample_rate: int = 16000, commit: bool = False):
    """
    Send audio chunk to STT

    Args:
        audio_base64: Base64-encoded PCM audio
        sample_rate: Audio sample rate (16000 Hz)
        commit: Whether to finalize and get transcript (True = get final result)
    """
    message = {
        "message_type": "input_audio_chunk",  # Required field!
        "audio_base_64": audio_base64,
        "sample_rate": sample_rate,
        "commit": commit  # False = continue buffering, True = finalize
    }

    await self.websocket.send(json.dumps(message))
```

**Message Format (Client → Server):**
```json
{
  "message_type": "input_audio_chunk",
  "audio_base_64": "UklGRiQAAABXQVZFZm10IBAAA...",
  "sample_rate": 16000,
  "commit": false
}
```

**Audio Specs:**
- **Codec:** PCM (raw uncompressed audio)
- **Sample Rate:** 16000 Hz
- **Encoding:** Base64

#### Receiving Transcripts

```python
async def receive_transcripts(self) -> AsyncGenerator[dict, None]:
    """Receive transcription results"""
    async for message in self.websocket:
        data = json.loads(message)
        msg_type = data.get("message_type")

        if msg_type == "partial_transcript":
            # Interim result while user is speaking
            yield {"type": "partial", "text": data.get("text", "")}

        elif msg_type == "committed_transcript":
            # Final result after commit=True
            yield {"type": "final", "text": data.get("text", "")}

        elif msg_type == "input_error":
            # Error from ElevenLabs
            yield {"type": "error", "message": data.get("error", "Unknown error")}
```

**Message Types (Server → Client):**

| `message_type` | Description | Example |
|----------------|-------------|---------|
| `partial_transcript` | Real-time interim result | `{"message_type": "partial_transcript", "text": "Hello wor..."}` |
| `committed_transcript` | Final transcript after `commit=True` | `{"message_type": "committed_transcript", "text": "Hello world"}` |
| `input_error` | Error from ElevenLabs | `{"message_type": "input_error", "error": "Invalid audio"}` |

**Commit Throttling:**
- If user commits audio < 0.3s after last commit, ElevenLabs may throttle
- Fallback: Use last `partial_transcript` as final if throttled

---

### B. Text-to-Speech (TTS)

**Class:** `ElevenLabsTTS`

**WebSocket URL:** `wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input`

**Model:** `eleven_turbo_v2_5` (fastest, low latency)

#### Connection

```python
class ElevenLabsTTS:
    def __init__(self, api_key: str, voice_id: str):
        self.api_key = api_key
        self.voice_id = voice_id  # e.g., "21m00Tcm4TlvDq8ikWAM"
        self.websocket = None

    async def connect(
        self,
        model_id: str = "eleven_turbo_v2_5",
        output_format: str = "mp3_44100_192",
        stability: float = 0.7,
        similarity_boost: float = 0.8,
        style: float = 0.0,  # 0.0 = fast/natural, 1.0 = slow/exaggerated
        speaking_rate: float = 1.3  # 0.25-4.0, default 1.0
    ):
        # Build WebSocket URL with query params
        url = f"wss://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}/stream-input?model_id={model_id}&output_format={output_format}"

        # Connect to WebSocket
        self.websocket = await websockets.connect(url)

        # Send initialization message with API key in JSON (NOT headers!)
        init_message = {
            "text": " ",  # Required space character
            "xi_api_key": self.api_key,  # API key in message body
            "voice_settings": {
                "stability": stability,
                "similarity_boost": similarity_boost,
                "style": style,
                "use_speaker_boost": True
            },
            "generation_config": {
                "chunk_length_schedule": [120, 160, 250, 290]  # Smaller chunks = lower latency
            },
            "model_config": {
                "speaking_rate": speaking_rate
            }
        }
        await self.websocket.send(json.dumps(init_message))

        return True
```

**Query Params:**
- `model_id=eleven_turbo_v2_5` - Fastest TTS model
- `output_format=mp3_44100_192` - MP3 @ 44.1kHz, 192kbps

**Voice Settings:**
| Parameter | Value | Effect |
|-----------|-------|--------|
| `stability` | `0.7` | Higher = cleaner, more consistent voice |
| `similarity_boost` | `0.8` | Higher = closer to original voice |
| `style` | `0.0` | 0 = fast/natural, 1 = slow/exaggerated |
| `speaking_rate` | `1.3` | 30% faster than default (1.0) |

**Chunk Schedule:**
- `[120, 160, 250, 290]` - Character lengths before streaming audio chunk
- Smaller values = lower latency (audio starts faster)

#### Sending Text

```python
async def send_text(self, text: str, flush: bool = False):
    """Send text chunk to TTS"""
    message = {
        "text": text,
        "try_trigger_generation": True,  # Start generating audio ASAP
        "flush": flush  # True = finalize, no more text coming
    }

    await self.websocket.send(json.dumps(message))
```

**Message Format (Client → Server):**
```json
{
  "text": "Hello, how can I help you today?",
  "try_trigger_generation": true,
  "flush": false
}
```

**Finalize Stream:**
```python
async def finalize(self):
    """Send final message to flush remaining audio"""
    message = {"text": ""}
    await self.websocket.send(json.dumps(message))
```

#### Receiving Audio

```python
async def receive_audio(self) -> AsyncGenerator[bytes, None]:
    """Receive audio chunks"""
    async for message in self.websocket:
        data = json.loads(message)

        # Check for audio chunks
        if "audio" in data and data["audio"] is not None:
            # Decode base64 audio
            audio_bytes = base64.b64decode(data["audio"])
            yield audio_bytes

        # Check for final message
        if data.get("isFinal"):
            break
```

**Message Format (Server → Client):**
```json
{
  "audio": "SUQzBAAAAAAAI1RTU0UAAAAP...",
  "isFinal": false,
  "normalizedAlignment": {...}
}
```

**Final Message:**
```json
{
  "isFinal": true
}
```

**Audio Format:**
- **Encoding:** Base64-encoded MP3
- **Sample Rate:** 44.1 kHz
- **Bitrate:** 192 kbps
- **Decode:** `base64.b64decode(data["audio"])`

---

## 5. WebSocket Message Flow

### Frontend ↔ Backend Protocol

**WebSocket Endpoint:** `POST /ws/voice/agent`

**File:** `/backend-new/app/api/voice_websocket.py`

---

### A. Client → Server Messages

```typescript
// 1. Initialize session
{
  "type": "start",
  "thread_id": "session-abc123"
}

// 2. Send audio chunk while speaking
{
  "type": "audio_chunk",
  "audio": "UklGRiQAAABXQVZFZm10IBA..."  // Base64 PCM audio
}

// 3. Finalize audio (get transcript)
{
  "type": "audio_end"
}

// 4. Disconnect
{
  "type": "stop"
}
```

---

### B. Server → Client Messages

```typescript
// 1. Ready to receive audio
{
  "type": "ready"
}

// 2. Partial transcript (real-time)
{
  "type": "partial_transcript",
  "text": "Hello wor..."
}

// 3. Final transcript (after audio_end)
{
  "type": "final_transcript",
  "text": "Hello world"
}

// 4. Agent is thinking
{
  "type": "agent_thinking",
  "is_thinking": true
}

// 5. Agent text response
{
  "type": "agent_text",
  "text": "I see Bitcoin is at $97,000. Would you like to buy?"
}

// 6. Agent started speaking
{
  "type": "agent_speaking",
  "is_speaking": true
}

// 7. Agent audio chunk
{
  "type": "agent_audio",
  "audio": "SUQzBAAAAAAAI1RTU0U..."  // Base64 MP3
}

// 8. Agent stopped speaking
{
  "type": "agent_speaking",
  "is_speaking": false
}

// 9. Error
{
  "type": "error",
  "message": "STT connection failed"
}
```

---

### C. Complete Conversation Flow

```
┌─────────────┐                                      ┌─────────────┐
│  Frontend   │                                      │   Backend   │
└──────┬──────┘                                      └──────┬──────┘
       │                                                    │
       │ {"type": "start", "thread_id": "..."}             │
       ├───────────────────────────────────────────────────>│
       │                                                    │ Create VoiceSession
       │                                                    │ Initialize STT/TTS
       │                                                    │
       │ {"type": "ready"}                                 │
       │<───────────────────────────────────────────────────┤
       │                                                    │
       │ (User speaks into microphone)                     │
       │                                                    │
       │ {"type": "audio_chunk", "audio": "..."}           │
       ├───────────────────────────────────────────────────>│ → STT WebSocket
       │ {"type": "audio_chunk", "audio": "..."}           │ → STT WebSocket
       ├───────────────────────────────────────────────────>│ → STT WebSocket
       │                                                    │
       │ {"type": "partial_transcript", "text": "Buy..."}  │
       │<───────────────────────────────────────────────────┤
       │ {"type": "partial_transcript", "text": "Buy 0.5 BTC"} │
       │<───────────────────────────────────────────────────┤
       │                                                    │
       │ {"type": "audio_end"}                             │
       ├───────────────────────────────────────────────────>│ Commit STT
       │                                                    │
       │ {"type": "final_transcript", "text": "Buy 0.5 BTC"}│
       │<───────────────────────────────────────────────────┤
       │                                                    │
       │ {"type": "agent_thinking", "is_thinking": true}   │
       │<───────────────────────────────────────────────────┤
       │                                                    │ → LangGraph Agent
       │                                                    │   - Get BTC price
       │                                                    │   - Check balance
       │                                                    │   - Execute trade
       │                                                    │
       │ {"type": "agent_text", "text": "Buying 0.5 BTC..."}│
       │<───────────────────────────────────────────────────┤
       │                                                    │
       │ {"type": "agent_speaking", "is_speaking": true}   │
       │<───────────────────────────────────────────────────┤
       │                                                    │ → TTS WebSocket
       │ {"type": "agent_audio", "audio": "..."}           │
       │<───────────────────────────────────────────────────┤
       │ {"type": "agent_audio", "audio": "..."}           │
       │<───────────────────────────────────────────────────┤
       │                                                    │
       │ (User interrupts by speaking)                     │
       │                                                    │
       │ {"type": "audio_chunk", "audio": "..."}           │
       ├───────────────────────────────────────────────────>│ INTERRUPT!
       │                                                    │ - Close TTS WebSocket
       │                                                    │ - Cancel TTS task
       │                                                    │
       │ {"type": "agent_speaking", "is_speaking": false}  │
       │<───────────────────────────────────────────────────┤
       │                                                    │
       │ (Process new user input...)                       │
       │                                                    │
```

---

### D. System Alert Flow

```
┌─────────────┐                  ┌─────────────┐                ┌─────────────┐
│  Risk       │                  │   Voice     │                │  LangGraph  │
│  Monitor    │                  │   Session   │                │   Agent     │
└──────┬──────┘                  └──────┬──────┘                └──────┬──────┘
       │                                │                               │
       │ Detect market crash            │                               │
       │ (risk_score >= 80)             │                               │
       │                                │                               │
       │ speak_via_agent()              │                               │
       ├────────────────────────────────>│                               │
       │                                │                               │
       │                                │ Build alert context:          │
       │                                │ - Risk: 85/100                │
       │                                │ - Price: $92,000              │
       │                                │ - Change: -6.2%               │
       │                                │                               │
       │                                │ Inject messages:              │
       │                                │ - SystemMessage(PROTOCOLS)    │
       │                                │ - HumanMessage("Crash!")      │
       │                                │                               │
       │                                │ agent_graph.astream()         │
       │                                ├──────────────────────────────>│
       │                                │                               │
       │                                │                               │ 1. Call list_holdings()
       │                                │                               │ 2. Call execute_trade(SELL)
       │                                │                               │ 3. Call lock_user_account()
       │                                │                               │
       │                                │ Response: "CRASH! Sold 60%... │
       │                                │<──────────────────────────────┤
       │                                │                               │
       │                                │ TTS → Frontend                │
       │                                │                               │
```

---

## 6. Complete Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Browser)                                │
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │  Microphone → WebSocket /ws/voice/agent                                   │ │
│  │                                                                            │ │
│  │  audio_chunk → audio_chunk → audio_chunk → audio_end                      │ │
│  │                                                                            │ │
│  │  ← partial_transcript ← final_transcript                                  │ │
│  │  ← agent_text ← agent_audio (MP3 chunks)                                  │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────┬──────────────────────────────────────────┘
                                     │ WebSocket
                                     ↓
┌───────────────────────────────────────────────────────────────────────────────┐
│                        BACKEND - VoiceSession                                  │
│                    /backend-new/app/api/voice_websocket.py                     │
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  VoiceSession Class                                                      │ │
│  │                                                                           │ │
│  │  - websocket: WebSocket (client connection)                              │ │
│  │  - thread_id: str (LangGraph conversation thread)                        │ │
│  │  - stt: ElevenLabsSTT (speech recognition)                               │ │
│  │  - tts: ElevenLabsTTS (text-to-speech)                                   │ │
│  │  - current_tts: TTS instance (for interrupt tracking)                    │ │
│  │  - tts_task: asyncio.Task (for cancellation)                             │ │
│  │  - is_speaking: bool (speech state)                                      │ │
│  │  - turn_id: int (prevent duplicate runs)                                 │ │
│  │                                                                           │ │
│  │  Methods:                                                                 │ │
│  │  - handle_audio_input() → Interrupt TTS if speaking, send to STT         │ │
│  │  - listen_to_stt() → Receive transcripts, trigger agent                  │ │
│  │  - process_with_agent() → Send to LangGraph, get response                │ │
│  │  - process_system_alert() → Inject emergency context + trigger           │ │
│  │  - speak_response() → TTS → stream audio to frontend                     │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────┬────────────────────────────────┬───────────────────────────────┘
               │                                │
               │                                │
    ┌──────────▼──────────┐        ┌───────────▼────────────┐
    │  ElevenLabs STT     │        │  LangGraph Agent       │
    │  WebSocket          │        │  StateGraph            │
    │                     │        │                        │
    │  wss://api.        │        │  Nodes:                │
    │  elevenlabs.io/    │        │  - agent (GPT-4o)      │
    │  v1/speech-to-text │        │  - tools (execute)     │
    │                     │        │                        │
    │  Send:              │        │  Routing:              │
    │  {                  │        │  - should_continue()   │
    │    message_type:    │        │                        │
    │      input_audio_   │        │  Checkpointing:        │
    │      chunk,         │        │  - MemorySaver()       │
    │    audio_base_64:   │        │  - thread_id           │
    │      "...",         │        │                        │
    │    commit: false    │        │  Tools:                │
    │  }                  │        │  - get_current_price() │
    │                     │        │  - list_holdings()     │
    │  Receive:           │        │  - execute_trade()     │
    │  {                  │        │  - lock_user_account() │
    │    message_type:    │        │  - get_market_        │
    │      partial_       │        │    sentiment()         │
    │      transcript,    │        │                        │
    │    text: "Buy BTC"  │        │  State:                │
    │  }                  │        │  - messages (history)  │
    └─────────────────────┘        │  - risk_score          │
                                   │  - portfolio_locked    │
    ┌─────────────────────┐        │  - pending_trade_id    │
    │  ElevenLabs TTS     │        └────────────────────────┘
    │  WebSocket          │
    │                     │
    │  wss://api.        │
    │  elevenlabs.io/    │
    │  v1/text-to-speech/│
    │  {voice_id}/       │
    │  stream-input      │
    │                     │
    │  Send:              │
    │  {                  │
    │    text: "Buying...",│
    │    try_trigger_     │
    │      generation:    │
    │      true,          │
    │    flush: false     │
    │  }                  │
    │                     │
    │  Receive:           │
    │  {                  │
    │    audio: "SUQz...",│
    │    isFinal: false   │
    │  }                  │
    └─────────────────────┘
                                   ┌────────────────────────┐
                                   │  Interrupt Mechanisms  │
                                   │                        │
                                   │  1. User Voice         │
                                   │     Interruption       │
                                   │     - Detect audio     │
                                   │       while speaking   │
                                   │     - Close TTS WS     │
                                   │     - Cancel task      │
                                   │                        │
                                   │  2. State Injection    │
                                   │     - Build context    │
                                   │     - SystemMessage    │
                                   │     - HumanMessage     │
                                   │     - Agent executes   │
                                   │                        │
                                   │  3. Account Lock       │
                                   │     - Tool called      │
                                   │     - Update Supabase  │
                                   │     - Disable trading  │
                                   └────────────────────────┘
```

---

## Summary

### Key Takeaways

1. **LangGraph Agent**
   - StateGraph with cyclic tool execution
   - Checkpointing via MemorySaver (thread_id)
   - `add_messages` annotation for automatic history management
   - GPT-4o with 5 trading tools

2. **Interrupts**
   - **Voice interrupt:** Close TTS WebSocket + cancel asyncio task
   - **State injection:** Append SystemMessage + HumanMessage to trigger autonomous action
   - **Account lock:** Tool-based safety mechanism in Supabase

3. **ElevenLabs Integration**
   - **STT:** Realtime transcription via WebSocket (scribe_v2_realtime)
   - **TTS:** Streaming audio via WebSocket (eleven_turbo_v2_5, 44.1kHz MP3)
   - **Low latency:** Chunk schedule, speaking_rate=1.3, instant commits

4. **WebSocket Flow**
   - Frontend sends audio chunks → STT
   - STT sends transcripts → Agent
   - Agent returns text → TTS
   - TTS streams audio → Frontend
   - User can interrupt at any time

This architecture enables **real-time voice trading** with **emergency intervention** and **autonomous agent actions**.