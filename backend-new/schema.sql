-- ===============================
-- VibeTrade: Core Database Schema
-- ===============================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------
-- Feed Items (Reddit / Polymarket)
-- -------------------------------
CREATE TABLE public.feed_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source TEXT NOT NULL CHECK (source IN ('POLYMARKET', 'REDDIT')),
    title TEXT NOT NULL,
    metadata JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feed_items_created_at ON public.feed_items (created_at DESC);
CREATE INDEX idx_feed_items_source ON public.feed_items (source);


-- -------------------------------
-- Market Context (Live Monitoring)
-- -------------------------------
CREATE TABLE public.market_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    btc_price NUMERIC(15,2) NOT NULL,
    price_change_24h NUMERIC(8,4),
    price_high_24h NUMERIC(15,2),
    price_low_24h NUMERIC(15,2),
    volume_24h TEXT,
    rsi NUMERIC(5,2),
    macd NUMERIC(10,2),

    sentiment_bullish INT DEFAULT 0,
    sentiment_bearish INT DEFAULT 0,
    sentiment_score INT DEFAULT 0,
    sentiment TEXT CHECK (sentiment IN ('BULLISH', 'BEARISH', 'PANIC')),

    polymarket_avg_odds NUMERIC(5,4),
    post_volume_24h TEXT,

    hype_score INT CHECK (hype_score BETWEEN 0 AND 100),
    risk_score INT CHECK (risk_score BETWEEN 0 AND 100),

    summary TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_context_created_at ON public.market_context (created_at DESC);


-- -------------------------------
-- Portfolio (Single User MVP)
-- -------------------------------
CREATE TABLE public.portfolio (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    balance_usd NUMERIC(15,2) DEFAULT 50000.00,
    is_locked BOOLEAN DEFAULT FALSE,
    lock_reason TEXT,
    lock_expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- -------------------------------
-- Watchlist
-- -------------------------------
CREATE TABLE public.watchlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticker TEXT NOT NULL UNIQUE,
    current_price NUMERIC(15,2),
    price_change_24h NUMERIC(8,4),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_watchlist_ticker ON public.watchlist (ticker);
