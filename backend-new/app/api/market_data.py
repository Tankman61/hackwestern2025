"""
Market data endpoints
GET /api/risk-monitor - Get full risk monitor data (risk_score includes Reddit, Polymarket, Technical)
GET /api/polymarket - Get Polymarket feed
GET /api/reddit - Get Reddit sentiment feed
GET /api/sentiment - Get aggregated sentiment stats
"""
from fastapi import APIRouter, Query, HTTPException
from app.services.supabase import get_supabase
from typing import Optional

router = APIRouter()


@router.get("/risk-monitor")
async def get_risk_monitor():
    """
    Get full risk monitor data including market overview and watchlist.

    NOTE: risk_score is calculated by Monitor Worker using:
    - Sentiment from Reddit (30%)
    - Technical indicators (30%)
    - Polymarket data (40%)
    """
    db = get_supabase()

    # Get latest market_context
    context_result = db.client.table("market_context")\
        .select("*")\
        .order("created_at", desc=True)\
        .limit(1)\
        .execute()

    if not context_result.data:
        # Return empty state if no data
        return {
            "risk_level": {
                "score": 0,
                "level": "Low",
                "summary": "No market data available"
            },
            "hype_level": {
                "score": 0,
                "level": "Low"
            },
            "market_overview": {
                "btc_price": 0,
                "price_change_24h": 0,
                "volume_24h": "$0",
                "price_range_24h": {"low": 0, "high": 0}
            },
            "technical": {"rsi": 0, "macd": 0},
            "watchlist": []
        }

    context = context_result.data[0]

    # Determine risk level from score
    risk_score = int(context.get("risk_score", 0))
    if risk_score < 40:
        risk_level = "Low"
    elif risk_score < 70:
        risk_level = "Medium"
    else:
        risk_level = "High"

    # Determine hype level from score
    hype_score = int(context.get("hype_score", 0))
    if hype_score < 40:
        hype_level = "Low"
    elif hype_score < 70:
        hype_level = "Medium"
    else:
        hype_level = "High"

    # Get watchlist
    watchlist_result = db.client.table("watchlist")\
        .select("ticker, price_change_24h")\
        .order("ticker")\
        .execute()

    watchlist = []
    for item in watchlist_result.data:
        change_val = float(item["price_change_24h"]) if item["price_change_24h"] else 0
        change_str = f"+{change_val}%" if change_val >= 0 else f"{change_val}%"
        watchlist.append({
            "ticker": item["ticker"].replace("-", "/"),
            "change": change_str
        })

    return {
        "risk_level": {
            "score": risk_score,
            "level": risk_level,
            "summary": context.get("summary", "")
        },
        "hype_level": {
            "score": hype_score,
            "level": hype_level
        },
        "market_overview": {
            "btc_price": float(context.get("btc_price", 0)),
            "price_change_24h": float(context.get("price_change_24h", 0)),
            "volume_24h": context.get("volume_24h", "$0"),
            "price_range_24h": {
                "low": float(context.get("price_low_24h", 0)) if context.get("price_low_24h") else 0,
                "high": float(context.get("price_high_24h", 0)) if context.get("price_high_24h") else 0
            }
        },
        "technical": {
            "rsi": float(context.get("rsi", 0)) if context.get("rsi") else 0,
            "macd": float(context.get("macd", 0)) if context.get("macd") else 0
        },
        "watchlist": watchlist
    }


@router.get("/polymarket")
async def get_polymarket():
    """Get Polymarket prediction markets"""
    db = get_supabase()

    result = db.client.table("feed_items")\
        .select("title, metadata")\
        .eq("source", "POLYMARKET")\
        .order("created_at", desc=True)\
        .limit(10)\
        .execute()

    if not result.data:
        return []  # Return empty array if no data

    markets = []
    for item in result.data:
        metadata = item["metadata"]
        markets.append({
            "question": item["title"],
            "probability": int(float(metadata.get("odds", 0)) * 100),  # Convert 0.68 to 68
            "change": metadata.get("change", "+0%"),
            "volume": metadata.get("volume", "0"),
            "url": metadata.get("url", "https://polymarket.com")
        })

    return markets


@router.get("/reddit")
async def get_reddit(subreddit: Optional[str] = Query("All", description="Filter by subreddit")):
    """Get Reddit posts with optional subreddit filter"""
    db = get_supabase()

    result = db.client.table("feed_items")\
        .select("title, metadata")\
        .eq("source", "REDDIT")\
        .order("created_at", desc=True)\
        .limit(50)\
        .execute()

    if not result.data:
        return []  # Return empty array if no data

    posts = []
    for item in result.data:
        metadata = item["metadata"]
        post_subreddit = metadata.get("subreddit", "")

        # Filter by subreddit if not "All"
        if subreddit != "All" and post_subreddit != subreddit:
            continue

        posts.append({
            "text": item["title"],
            "username": metadata.get("username", ""),
            "subreddit": post_subreddit,
            "sentiment": metadata.get("sentiment", ""),
            "posted_ago": metadata.get("posted_ago", ""),
            "url": metadata.get("url", "https://reddit.com")
        })

    return posts


@router.get("/sentiment")
async def get_sentiment():
    """Get aggregated sentiment stats from Reddit, Polymarket, etc."""
    db = get_supabase()

    result = db.client.table("market_context")\
        .select("sentiment_bullish, sentiment_bearish, sentiment_score, post_volume_24h, created_at")\
        .order("created_at", desc=True)\
        .limit(1)\
        .execute()

    if not result.data:
        # Return empty state if no data (worker hasn't run yet)
        return {
            "bullish": 0,
            "bearish": 0,
            "score": 0,
            "volume": "0",
            "_warning": "No data in market_context. Is the ingest worker running?"
        }

    data = result.data[0]
    
    # Check if data is stale (older than 30 seconds)
    from datetime import datetime, timezone
    created_at_str = data.get("created_at")
    if created_at_str:
        try:
            created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
            age_seconds = (datetime.now(timezone.utc) - created_at).total_seconds()
            if age_seconds > 30:
                return {
                    "bullish": int(data.get("sentiment_bullish", 0)),
                    "bearish": int(data.get("sentiment_bearish", 0)),
                    "score": int(data.get("sentiment_score", 0)),
                    "volume": data.get("post_volume_24h", "0"),
                    "_warning": f"Data is {int(age_seconds)}s old. Worker may have stopped."
                }
        except:
            pass
    
    return {
        "bullish": int(data.get("sentiment_bullish", 0)),
        "bearish": int(data.get("sentiment_bearish", 0)),
        "score": int(data.get("sentiment_score", 0)),
        "volume": data.get("post_volume_24h", "0")
    }
