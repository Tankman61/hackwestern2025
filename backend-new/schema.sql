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

 -- 2. MARKET CONTEXT (Aggregated Market Data + Sentiment Stats)
-- This stores the "big picture" view that the agent uses
-- WRITTEN BY: Data Ingest Worker (every 10s) - everything except risk_score
-- UPDATED BY: Monitor Worker (every 1s) - calculates and updates risk_score
CREATE TABLE market_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    summary TEXT NOT NULL, -- AI-generated summary

    -- BTC Price Data
    btc_price NUMERIC(15, 2) NOT NULL,
    price_change_24h NUMERIC(8, 4), -- e.g., -2.34 = -2.34%

    -- Technical Indicators (for Risk Monitor display)
    volume_24h TEXT, -- e.g., "$42.1B" (can be calculated or from API)
    price_high_24h NUMERIC(15, 2), -- 24h high
    price_low_24h NUMERIC(15, 2), -- 24h low
    rsi NUMERIC(5, 2), -- RSI indicator (0-100), optional for MVP
    macd NUMERIC(10, 2), -- MACD indicator, optional for MVP

    -- Aggregated Reddit Sentiment (for ALL scraped subreddits)
    sentiment_bullish INTEGER DEFAULT 0, -- Count of bullish posts
    sentiment_bearish INTEGER DEFAULT 0, -- Count of bearish posts
    sentiment_score INTEGER DEFAULT 0, -- Net sentiment: bullish - bearish
    post_volume_24h TEXT, -- e.g., "15.1k"

    -- Aggregated Polymarket Data
    polymarket_avg_odds NUMERIC(5, 4), -- Average probability across tracked markets

    -- Overall sentiment label
    sentiment TEXT CHECK (sentiment IN ('BULLISH', 'BEARISH', 'PANIC')),
    hype_score INTEGER CHECK (hype_score >= 0 AND hype_score <= 100),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_market_context_created_at ON market_context(created_at DESC);

-- 4. FEED ITEMS (Individual Posts & Markets for UI Display)
-- This stores the actual posts and markets shown in the panels
CREATE TABLE feed_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source TEXT NOT NULL CHECK (source IN ('POLYMARKET', 'REDDIT')),
    title TEXT NOT NULL, -- Market question OR post snippet
    metadata JSONB NOT NULL, -- Flexible data storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_feed_items_source ON feed_items(source);
CREATE INDEX idx_feed_items_created_at ON feed_items(created_at DESC);

-- 5. WATCHLIST (Altcoin prices for Risk Monitor)
-- Updated every 10s by Data Ingest Worker
CREATE TABLE watchlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticker TEXT NOT NULL UNIQUE, -- 'ETH-USD', 'SOL-USD', 'AVAX-USD', 'MATIC-USD'
    current_price NUMERIC(15, 2),
    price_change_24h NUMERIC(8, 4), -- Percentage (e.g., 2.4 = +2.4%)
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_watchlist_ticker ON watchlist(ticker);

-- Enable Realtime for portfolio (so frontend gets live lock updates)
ALTER PUBLICATION supabase_realtime ADD TABLE portfolio;

-- Seed the  Initial Portfolio State
INSERT INTO portfolio (balance_usd, is_locked) VALUES (50000.00, FALSE);

-- NOTE: feed_items and market_context will be populated by the Data Ingest Worker
-- Worker flow: Fetch APIs → Write raw items to feed_items → Process with LLM → Write aggregated stats to market_context
