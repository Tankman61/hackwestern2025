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
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

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
        
        self.interval_seconds = 600  # ~10 minutes
        self.is_running = False
        
        # Reddit posts cached at startup - only fetch once to avoid rate limiting
        self.cached_reddit_posts = []
        self.reddit_fetched = False
        
        logger.info("✅ Data Ingest Worker initialized")
    
    async def start(self):
        """Start the worker loop"""
        self.is_running = True
        logger.info("🚀 Data Ingest Worker started (interval: 600s)")
        
        # Fetch Reddit posts once at startup (to avoid rate limiting)
        logger.info("📊 Fetching Reddit posts once at startup...")
        try:
            self.cached_reddit_posts = await self.reddit.fetch_posts(limit_per_sub=10)
            self.reddit_fetched = True
            logger.info(f"✅ Cached {len(self.cached_reddit_posts)} Reddit posts (will reuse for all cycles)")
            
            # Write Reddit feed_items once at startup
            if self.cached_reddit_posts:
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
                            "top_comments": post.get("top_comments", [])[:3]
                        },
                        "created_at": datetime.utcnow().isoformat()
                    }
                    for post in self.cached_reddit_posts
                ]
                await self.db.upsert_feed_items(reddit_feed_items)
                logger.info(f"✅ Wrote {len(reddit_feed_items)} Reddit feed items (one-time at startup)")
        except Exception as e:
            logger.error(f"❌ Failed to fetch Reddit posts at startup: {e}")
            logger.warning("   Worker will continue with empty Reddit data. Reddit rate limiting may be active.")
            self.cached_reddit_posts = []
        
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
        
        # STEP 1: Fetch external data
        # - BTC price: every cycle (live data)
        # - Polymarket: every cycle (changes frequently)
        # - Reddit: only once at startup (cached to avoid rate limiting)
        btc_data, polymarket_markets = await asyncio.gather(
            get_btc_data(),
            self.polymarket.fetch_btc_markets(),
            return_exceptions=True
        )
        
        # Use cached Reddit posts (fetched once at startup)
        reddit_posts = self.cached_reddit_posts
        
        # Handle exceptions
        if isinstance(btc_data, Exception):
            logger.error(f"❌ CRITICAL: Finnhub BTC price fetch failed: {btc_data}")
            logger.error("❌ Cannot proceed without real-time price data from Finnhub WebSocket")
            logger.error("❌ Skipping this ingest cycle. Check that Finnhub WebSocket is connected and BTC is subscribed.")
            return  # Skip this cycle instead of using stale fallback data
        
        if isinstance(polymarket_markets, Exception):
            logger.error(f"Polymarket fetch failed: {polymarket_markets}")
            polymarket_markets = []
        
        # Note: reddit_posts is from cache, so no exception handling needed here
        
        logger.info(f"📊 Cycle data: {len(reddit_posts)} Reddit posts (cached), {len(polymarket_markets)} Polymarket markets (fresh)")
        
        # Note about Reddit being cached
        if self.reddit_fetched:
            logger.debug(f"   Using cached Reddit posts from startup (to avoid rate limiting)")
        elif len(reddit_posts) == 0:
            logger.warning("⚠️  No Reddit posts available (startup fetch may have failed due to rate limiting)")
        
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
        
        logger.info(f"📊 Reddit sentiment stats: {reddit_stats['sentiment_bullish']} bullish, {reddit_stats['sentiment_bearish']} bearish, score: {reddit_stats['sentiment_score']}")
        
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
        # First, get previous feed_items to calculate changes
        previous_items_result = self.db.client.table("feed_items")\
            .select("title, metadata")\
            .eq("source", "POLYMARKET")\
            .execute()
        
        previous_markets = {}
        if previous_items_result.data:
            for item in previous_items_result.data:
                title = item["title"]
                metadata = item["metadata"] or {}
                previous_odds = metadata.get("odds")
                if previous_odds is not None:
                    previous_markets[title.strip()] = float(previous_odds)
        
        logger.info(f"📊 Found {len(previous_markets)} previous Polymarket markets for change calculation")
        if previous_markets:
            logger.info(f"   Previous market titles: {list(previous_markets.keys())[:3]}...")  # Log first 3
        
        # Calculate changes and prepare feed_items
        polymarket_feed_items = []
        markets_with_changes = 0
        markets_new = 0
        markets_no_change = 0
        
        for market in polymarket_markets:
            title = market["title"].strip()  # Normalize title
            current_odds = float(market["odds"])
            
            # Calculate change from previous odds
            change_str = "+0%"
            matched = False
            
            if title in previous_markets:
                matched = True
                previous_odds = previous_markets[title]
                if previous_odds > 0:
                    change_percent = ((current_odds - previous_odds) / previous_odds) * 100
                    
                    # Always log the calculation for debugging
                    logger.info(f"🔍 {title[:60]}: {previous_odds:.4f} → {current_odds:.4f} = {change_percent:+.2f}%")
                    
                    # Format change string (lowered threshold to 0.05% for better visibility)
                    if abs(change_percent) < 0.05:
                        change_str = "+0%"
                        markets_no_change += 1
                    else:
                        change_str = f"{change_percent:+.1f}%"
                        markets_with_changes += 1
            else:
                markets_new += 1
                logger.debug(f"🆕 New market: {title[:60]}")
                if market.get("change"):
                    # Use provided change if available (e.g., from mock data)
                    change_str = market["change"]
                else:
                    change_str = "+0%"
            
            polymarket_feed_items.append({
                "source": "POLYMARKET",
                "title": title,
                "metadata": {
                    "odds": market["odds"],
                    "volume": market["volume"],
                    "change": change_str,
                    "url": market["url"]
                },
                "created_at": datetime.utcnow().isoformat()
            })
        
        if polymarket_feed_items:
            # Log all calculated changes before upserting
            for item in polymarket_feed_items[:3]:  # Log first 3
                change = item["metadata"].get("change", "+0%")
                logger.info(f"   📈 '{item['title'][:50]}' → {change}")
            
            await self.db.upsert_feed_items(polymarket_feed_items)
            
            # Log detailed stats about changes
            if len(previous_markets) == 0:
                logger.info(f"✅ Upserted {len(polymarket_feed_items)} Polymarket feed items (FIRST CYCLE - all markets are new, changes will appear next cycle)")
            else:
                logger.info(
                    f"✅ Upserted {len(polymarket_feed_items)} Polymarket feed items: "
                    f"{markets_with_changes} with changes, {markets_no_change} no change, {markets_new} new"
                )
                if markets_with_changes > 0:
                    logger.info(f"🎯 Change percentages calculated! {markets_with_changes} markets show real changes")
                elif markets_no_change > 0:
                    logger.info(f"⚠️  All markets matched but changes are <0.1% (too small to display)")
        
        # STEP 6: Reddit feed_items already written at startup (not updated every cycle)
        # This avoids Reddit API rate limiting
        
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
