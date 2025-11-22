-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PORTFOLIO (Single User State)
-- We only ever have ONE row here.
CREATE TABLE portfolio (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    balance_usd NUMERIC(15, 2) DEFAULT 50000.00,
    is_locked BOOLEAN DEFAULT FALSE, -- The "Agent Lock" switch
    lock_reason TEXT,
    lock_expires_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TRADES TABLE (Order Book)
-- No user_id needed, we assume single user
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticker TEXT NOT NULL, -- 'BTC-USD'
    side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
    order_type TEXT NOT NULL CHECK (order_type IN ('MARKET', 'LIMIT', 'STOP_LOSS')),
    amount NUMERIC(18, 8) NOT NULL,
    limit_price NUMERIC(15, 2), -- Nullable for Market orders
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('PENDING_APPROVAL', 'OPEN', 'FILLED', 'CANCELLED', 'REJECTED')),
    pnl NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. MARKET CONTEXT (The AI's Memory)
CREATE TABLE market_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vibe_score INTEGER NOT NULL, -- 0 to 100
    summary TEXT NOT NULL,
    reddit_sentiment TEXT,
    polymarket_odds NUMERIC(5, 4),
    btc_price NUMERIC(15, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed the Initial State
INSERT INTO portfolio (balance_usd, is_locked) VALUES (50000.00, FALSE);