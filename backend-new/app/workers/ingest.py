"""
Data Ingest Worker
Runs every 10 seconds
Fetches: CoinGecko, Polymarket, Reddit
Processes: Uses GPT-4o-mini to analyze
Writes: market_context + feed_items tables
"""
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List

from app.services.finnhub import get_btc_data  # SOURCE OF TRUTH for BTC price
from app.services.polymarket import get_polymarket_client
from app.services.reddit import get_reddit_client
from app.services.openai_client import get_openai_client
from app.services.supabase import get_supabase

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DataIngestWorker:
    """
    Background worker that fetches external data every 10 seconds.
    
    CRITICAL: This worker writes ALL fields to market_context EXCEPT risk_score.
    risk_score is calculated by the Monitor Worker.
    """
    
    def __init__(self):
        self.polymarket = get_polymarket_client()
        self.reddit = get_reddit_client()
        self.openai = get_openai_client()
        self.db = get_supabase()
        
        self.interval_seconds = 10
        self.is_running = False
        
        logger.info("✅ Data Ingest Worker initialized")
    
    async def start(self):
        """Start the worker loop"""
        self.is_running = True
        logger.info("🚀 Data Ingest Worker started (interval: 10s)")
        
        while self.is_running:
            try:
                await self._run_cycle()
            except Exception as e:
                logger.error(f"❌ Ingest cycle failed: {e}", exc_info=True)
            
            # Wait 10 seconds before next cycle
            await asyncio.sleep(self.interval_seconds)
    
    async def stop(self):
        """Stop the worker loop"""
        self.is_running = False
        logger.info("🛑 Data Ingest Worker stopped")
    
    async def _run_cycle(self):
        """Run a single ingest cycle"""
        logger.info("🔄 Starting ingest cycle...")
        
        # STEP 1: Fetch all external data in parallel
        btc_data, polymarket_markets, reddit_posts = await asyncio.gather(
            get_btc_data(),
            self.polymarket.fetch_btc_markets(),
            self.reddit.fetch_posts(limit_per_sub=10),
            return_exceptions=True
        )
        
        # Handle exceptions
        if isinstance(btc_data, Exception):
            logger.error(f"❌ CRITICAL: Finnhub BTC price fetch failed: {btc_data}")
            logger.error("❌ Cannot proceed without real-time price data from Finnhub WebSocket")
            logger.error("❌ Skipping this ingest cycle. Check that Finnhub WebSocket is connected and BTC is subscribed.")
            return  # Skip this cycle instead of using stale fallback data
        
        if isinstance(polymarket_markets, Exception):
            logger.error(f"Polymarket fetch failed: {polymarket_markets}")
            polymarket_markets = []
        
        if isinstance(reddit_posts, Exception):
            logger.error(f"Reddit fetch failed: {reddit_posts}")
            reddit_posts = []
        
        # STEP 2: Process with OpenAI to get analysis
        analysis = await self.openai.analyze_market_data(
            btc_price=btc_data["btc_price"],
            price_change_24h=btc_data["price_change_24h"],
            polymarket_markets=polymarket_markets,
            reddit_posts=reddit_posts
        )
        
        # STEP 3: Calculate additional stats
        polymarket_avg_odds = await self.polymarket.get_average_odds()
        reddit_stats = self.reddit.calculate_sentiment_stats(reddit_posts)
        
        # STEP 4: Write to market_context table
        # IMPORTANT: risk_score is set to 0 - Monitor Worker will calculate it
        market_context_data = {
            "risk_score": 0,  # Monitor Worker calculates this
            "summary": analysis.get("summary", "Market data processed"),
            "btc_price": btc_data["btc_price"],
            "price_change_24h": btc_data["price_change_24h"],
            "volume_24h": btc_data["volume_24h"],
            "price_high_24h": btc_data["price_high_24h"],
            "price_low_24h": btc_data["price_low_24h"],
            "rsi": None,  # Optional for MVP
            "macd": None,  # Optional for MVP
            "sentiment_bullish": analysis.get("sentiment_bullish", reddit_stats["sentiment_bullish"]),
            "sentiment_bearish": analysis.get("sentiment_bearish", reddit_stats["sentiment_bearish"]),
            "sentiment_score": reddit_stats["sentiment_score"],
            "post_volume_24h": f"{len(reddit_posts)}",
            "polymarket_avg_odds": polymarket_avg_odds,
            "sentiment": analysis.get("sentiment", "BEARISH"),
            "hype_score": analysis.get("hype_score", 50),
            "created_at": datetime.utcnow().isoformat()
        }
        
        await self.db.insert_market_context(market_context_data)
        logger.info(f"✅ Inserted market_context: sentiment={market_context_data['sentiment']}, hype={market_context_data['hype_score']}")
        
        # STEP 5: Upsert feed_items (Polymarket)
        polymarket_feed_items = [
            {
                "source": "POLYMARKET",
                "title": market["title"],
                "metadata": {
                    "odds": market["odds"],
                    "volume": market["volume"],
                    "change": market["change"],
                    "url": market["url"]
                },
                "created_at": datetime.utcnow().isoformat()
            }
            for market in polymarket_markets
        ]
        
        if polymarket_feed_items:
            await self.db.upsert_feed_items(polymarket_feed_items)
            logger.info(f"✅ Upserted {len(polymarket_feed_items)} Polymarket feed items")
        
        # STEP 6: Upsert feed_items (Reddit)
        reddit_feed_items = [
            {
                "source": "REDDIT",
                "title": post["title"],
                "metadata": {
                    "username": post["username"],
                    "subreddit": post["subreddit"],
                    "sentiment": post["sentiment"],
                    "posted_ago": post["posted_ago"],
                    "url": post["url"],
                    "score": post.get("score", 0),
                    "upvote_ratio": post.get("upvote_ratio", 0.5),
                    "num_comments": post.get("num_comments", 0),
                    "top_comments": post.get("top_comments", [])[:3]  # Store top 3 comments
                },
                "created_at": datetime.utcnow().isoformat()
            }
            for post in reddit_posts
        ]
        
        if reddit_feed_items:
            await self.db.upsert_feed_items(reddit_feed_items)
            logger.info(f"✅ Upserted {len(reddit_feed_items)} Reddit feed items")
        
        # STEP 7: Update watchlist (TODO: Use Alpaca for altcoin prices)
        # For MVP, skipping watchlist updates since Alpaca requires separate subscription
        # watchlist_tickers = ["ETH-USD", "SOL-USD", "AVAX-USD", "MATIC-USD"]
        
        logger.info(f"✅ Ingest cycle complete. Next cycle in {self.interval_seconds}s")


async def run_ingest_worker():
    """Entry point to run the data ingest worker"""
    worker = DataIngestWorker()
    try:
        await worker.start()
    except KeyboardInterrupt:
        logger.info("🛑 Received shutdown signal")
        await worker.stop()


if __name__ == "__main__":
    # For standalone testing
    asyncio.run(run_ingest_worker())
