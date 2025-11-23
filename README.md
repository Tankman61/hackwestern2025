# Vibe Trade - Agentic Risk Terminal

📜 PROJECT CHARTER: DIVERGENCE
The Agentic Risk Terminal
One-Liner:
A real-time risk console that ingests Prediction Markets (Polymarket), Spot Prices (Crypto), and Social Sentiment (Reddit) to identify market anomalies—and aggressively "coaches" the user via an interrupting AI Agent.

1. THE VISION (The "Why")
Use this exactly for your pitch intro.
Retail traders have access to institutional data but lack institutional discipline. They trade on "vibes" while ignoring the data.
DIVERGENCE is an active "Risk Overlay" for day traders. It doesn't just show data; it calculates the correlation between "What the Price is doing" (Reality) vs. "What the Prediction Market thinks" (Future) vs. "What Reddit is screaming" (Hype).
When these signals diverge (e.g., Price goes UP but Prediction Odds go DOWN), the AI Agent interrupts the user's session to force a risk assessment.
The "Good" (Fintech): Real-time data aggregation & anomaly detection.
The "Funny" (Viral): The Agent (Anime Girl or Angry Buffett) has "permission to speak freely" and will scream at you if you ignore the math.

2. THE USER EXPERIENCE (The Demo Flow)
Phase 1: The "Professional" Setup (0:00 - 0:45)
Visual: A clean, dark dashboard.
Left: TradingView Widget (BTC/USD).
Center: Polymarket Iframe (e.g., "Bitcoin > $100k").
Right: The Divergence Sidebar (Your Code).
Action: You explain the tech stack. The dashboard is ticking normally.
Phase 2: The Anomaly (0:45 - 1:30)
Action: You press a hidden key ('C' for Crash).
Visual: The Sidebar turns RED.
Audio (The "Wow"): The background music cuts. The AI Agent interrupts you mid-sentence.
Agent: "STOP TALKING. Look at the spread! Spot price is flat but Polymarket odds just collapsed 15%. The whales are exiting."
Phase 3: The Coaching (1:30 - 2:30)
Action: You talk to the Agent: "Should I sell?"
Response: The Agent checks the "Reddit Hype" score (Live data).
Agent: "Reddit sentiment is 90% 'YOLO'. This is a bull trap. I am locking your buy button for 5 minutes. Go touch grass."

3. THE ARCHITECTURE (The Stack)
Frontend: Next.js (React)
Why: Fast rendering, easy Vercel deployment.
Key Libraries:
lightweight-charts: For the Sidebar's internal "Risk Graph" (the one we control).
react-use-websocket: To listen to the Python backend.
framer-motion: For the "Screen Shake" / "Red Flash" effects when the Agent screams.
Backend: Python (FastAPI)
Why: We need Async Concurrency to listen to 3 different WebSockets (CoinGecko, Polymarket, Reddit) simultaneously.
The Logic Engine:
Ingests live streams.
Calculates a Normalized Risk Score (0-100).
Pushes events ({ type: "INTERRUPT", payload: "voice_url" }) to the Frontend via WebSocket.
AI Layer:
Intelligence: OpenAI GPT-4o (API) to generate the "roast".
Voice: ElevenLabs (API) for Text-to-Speech.
Optimization: Pre-generate the specific "Demo Scream" MP3s to ensure 0ms latency during the presentation.

4. DATA STRATEGY (The Inputs)
1. The "Truth" (Price Action)
Source: CoinGecko API (Free).
Metric: BTC/USD Price + 24h Volume.
2. The "Wisdom" (Prediction Markets)
Source: Polymarket Gamma API (Free/Public).
Endpoint: GET /events?slug=bitcoin-above-100k (Find a high-volume market).
Metric: The "Implied Probability" (e.g., 0.32 = 32%).
3. The "Noise" (Social Sentiment)
Source: Reddit JSON (r/wallstreetbets/new.json).
Metric: Count frequency of keywords: "YOLO", "Moon", "Rekt", "Loss".

5. THE 36-HOUR EXECUTION PLAN
Phase 1: The Skeleton (Hours 0 - 8)
Goal: A Next.js page with the TradingView Widget and Polymarket Iframe side-by-side.
Task: Build the Agent Sidebar. It should just be a static box for now.
Task: Set up the FastAPI server that just returns "Hello World".
Phase 2: The Data Pipeline (Hours 8 - 20)
Goal: The Backend actually calculating a score.
Task: Write Python functions to fetch Price, Odds, and Reddit posts.
Task: Create the "God Mode" Switch.
If DEMO_MODE == True, ignore real data and inject a "Crash Scenario".
Phase 3: The "Interrupt" Feature (Hours 20 - 30)
Goal: Audio triggering from the server.
Task: Connect FastAPI WebSocket to Next.js.
Task: When DEMO_MODE triggers, Frontend receives the signal -> Plays Audio -> Flashes Screen Red.
Phase 4: Polish (Hours 30 - 36)
Goal: Make it look expensive.
Task: Dark Mode CSS. Neon borders.
Task: Hardcode the specific demo script. Don't rely on GPT generating a good joke live. Pre-write the joke and play the MP3.

6. JUDGING "WIN CONDITIONS"
Tech Cred: We are using WebSockets and Async Python, not just a simple REST API.
Fintech Relevance: We are integrating Polymarket, which is the hottest topic in crypto/finance right now.
Humor: The "Interruption" mechanic is genuinely different from every other "Chat with Data" bot.
Go build DIVERGENCE.

## 🚀 Deployment

### Frontend (Next.js)
Deploy to Vercel for optimal Next.js performance:

1. **Vercel Deployment:**
   ```bash
   cd frontend
   npm install -g vercel
   vercel --prod
   ```

2. **Environment Variables:**
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-url.onrender.com
   ```

### Backend (FastAPI)
Deploy to Render for WebSocket support:

1. **Render Deployment:**
   - Connect your GitHub repo to Render
   - Create a new Web Service
   - Set build command: `pip install -r requirements.txt`
   - Set start command: `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`

2. **Environment Variables:**
   ```
   ALPACA_API_KEY=your_alpaca_key
   ALPACA_SECRET_KEY=your_alpaca_secret
   OPENAI_API_KEY=your_openai_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_key
   ELEVENLABS_API_KEY=your_elevenlabs_key
   POLYMARKET_API_KEY=your_polymarket_key
   FINNHUB_API_KEY=your_finnhub_key
   ```

### Local Development
Use Docker Compose for local development:

```bash
# Set up environment variables in .env file
cp .env.example .env

# Run both services
docker-compose up --build
```

### Alternative Deployments
- **Railway:** Excellent for FastAPI with WebSockets
- **Heroku:** Add `websockets` buildpack
- **AWS:** Use ECS/Fargate with Application Load Balancer
- **DigitalOcean:** App Platform supports Python WebSockets

## 🔧 Environment Setup

Create a `.env` file in the backend directory:

```env
# Alpaca Trading
ALPACA_API_KEY=your_key_here
ALPACA_SECRET_KEY=your_secret_here

# AI Services
OPENAI_API_KEY=your_key_here
ELEVENLABS_API_KEY=your_key_here

# Data Sources
SUPABASE_URL=your_url_here
SUPABASE_ANON_KEY=your_key_here
POLYMARKET_API_KEY=your_key_here
FINNHUB_API_KEY=your_key_here
```

## 🌐 WebSocket Endpoints

- `ws://your-domain/ws/alpaca/crypto` - Crypto price streaming
- `ws://your-domain/ws/alpaca/stocks` - Stock price streaming
- `ws://your-domain/ws/alpaca/options` - Options price streaming
- `ws://your-domain/ws/alpaca/etfs` - ETF price streaming

