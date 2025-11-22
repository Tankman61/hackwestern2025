"""
Reddit JSON endpoint client
Fetches posts from trading subreddits
"""
import logging
from typing import List, Dict, Any
from datetime import datetime
import httpx

logger = logging.getLogger(__name__)


class RedditClient:
    """Client for scraping Reddit posts via JSON endpoint (no auth)"""
    
    def __init__(self):
        self.subreddits = [
            "wallstreetbets",
            "PredictionMarkets",
            "pennystocks",
            "CryptoCurrency",
            "daytrading",
            "Bitcoin"
        ]
        self.user_agent = "VibeTrade/1.0"
        logger.info("✅ Reddit client initialized")
    
    async def fetch_posts(self, limit_per_sub: int = 10) -> List[Dict[str, Any]]:
        """
        Fetch recent posts from trading subreddits.
        
        Args:
            limit_per_sub: Number of posts to fetch per subreddit
            
        Returns:
            [
                {
                    "title": "BTC breaking out. This is not a drill...",
                    "username": "u/cryptowhale",
                    "subreddit": "r/wallstreetbets",
                    "sentiment": "bullish",
                    "posted_ago": "2m",
                    "url": "https://reddit.com/..."
                },
                ...
            ]
        """
        all_posts = []
        
        for subreddit in self.subreddits:
            try:
                posts = await self._fetch_subreddit_posts(subreddit, limit_per_sub)
                all_posts.extend(posts)
            except Exception as e:
                logger.error(f"❌ Failed to fetch r/{subreddit}: {e}")
                continue
        
        logger.info(f"✅ Fetched {len(all_posts)} Reddit posts from {len(self.subreddits)} subreddits")
        return all_posts
    
    async def _fetch_subreddit_posts(self, subreddit: str, limit: int) -> List[Dict[str, Any]]:
        """Fetch posts from a single subreddit with top comments"""
        url = f"https://www.reddit.com/r/{subreddit}/hot.json"
        params = {"limit": limit}
        headers = {"User-Agent": self.user_agent}
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params, headers=headers)
            if response.status_code != 200:
                raise Exception(f"Reddit returned status {response.status_code}")
            
            data = response.json()
        
        posts = []
        children = data.get("data", {}).get("children", [])
        
        for child in children:
            post_data = child.get("data", {})
            
            # Skip stickied posts
            if post_data.get("stickied", False):
                continue
            
            title = post_data.get("title", "")
            author = post_data.get("author", "deleted")
            created_utc = post_data.get("created_utc", 0)
            permalink = post_data.get("permalink", "")
            upvotes = post_data.get("ups", 0)
            downvotes = post_data.get("downs", 0)
            score = post_data.get("score", 0)
            num_comments = post_data.get("num_comments", 0)
            upvote_ratio = post_data.get("upvote_ratio", 0.5)
            
            # Calculate time ago
            posted_ago = self._calculate_time_ago(created_utc)
            
            # Basic sentiment analysis
            sentiment = self._analyze_sentiment(title)
            
            # Fetch top comments for this post (limit to 5 top comments)
            comments = await self._fetch_post_comments(permalink, limit=5)
            
            posts.append({
                "title": title[:200],  # Truncate long titles
                "username": f"u/{author}",
                "subreddit": f"r/{subreddit}",
                "sentiment": sentiment,
                "posted_ago": posted_ago,
                "url": f"https://reddit.com{permalink}",
                "upvotes": upvotes,
                "score": score,
                "upvote_ratio": upvote_ratio,
                "num_comments": num_comments,
                "top_comments": comments
            })
        
        return posts
    
    async def _fetch_post_comments(self, permalink: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Fetch top comments from a specific post"""
        try:
            url = f"https://www.reddit.com{permalink}.json"
            params = {"limit": limit}
            headers = {"User-Agent": self.user_agent}
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, params=params, headers=headers)
                if response.status_code != 200:
                    return []
                
                data = response.json()
            
            # Reddit returns [post, comments] - we want the comments (index 1)
            if len(data) < 2:
                return []
            
            comments_data = data[1].get("data", {}).get("children", [])
            comments = []
            
            for comment_child in comments_data[:limit]:
                comment_data = comment_child.get("data", {})
                
                # Skip non-comment items (like "more" objects)
                if comment_data.get("kind") == "more":
                    continue
                
                body = comment_data.get("body", "")
                if not body or body in ["[deleted]", "[removed]"]:
                    continue
                
                author = comment_data.get("author", "deleted")
                score = comment_data.get("score", 0)
                ups = comment_data.get("ups", 0)
                
                # Calculate upvote ratio (simplified)
                # If score is positive, assume mostly upvotes
                # If negative, assume mostly downvotes
                upvote_ratio = 0.5
                if score > 0:
                    upvote_ratio = 0.7 + (min(score, 100) / 333)  # 0.7-1.0 range
                elif score < 0:
                    upvote_ratio = 0.3 - (min(abs(score), 100) / 333)  # 0-0.3 range
                
                comments.append({
                    "author": f"u/{author}",
                    "body": body[:300],  # Truncate long comments
                    "score": score,
                    "upvote_ratio": round(upvote_ratio, 2),
                    "sentiment": self._analyze_sentiment(body)
                })
            
            return comments
            
        except Exception as e:
            logger.debug(f"Failed to fetch comments for {permalink}: {e}")
            return []
    
    def _calculate_time_ago(self, created_utc: float) -> str:
        """Convert Unix timestamp to human-readable time ago"""
        try:
            now = datetime.utcnow().timestamp()
            diff_seconds = int(now - created_utc)
            
            if diff_seconds < 60:
                return f"{diff_seconds}s"
            elif diff_seconds < 3600:
                return f"{diff_seconds // 60}m"
            elif diff_seconds < 86400:
                return f"{diff_seconds // 3600}h"
            else:
                return f"{diff_seconds // 86400}d"
        except:
            return "?"
    
    def _analyze_sentiment(self, title: str) -> str:
        """Simple keyword-based sentiment analysis"""
        title_lower = title.lower()
        
        # Bullish keywords
        bullish_words = [
            "moon", "bullish", "buy", "pump", "breakout", "rally", "surge",
            "yolo", "calls", "long", "hold", "hodl", "diamond", "green",
            "gains", "rocket", "squeeze", "mooning"
        ]
        
        # Bearish keywords
        bearish_words = [
            "dump", "bearish", "sell", "crash", "rekt", "puts", "short",
            "collapse", "tank", "dead", "scam", "bubble", "red", "loss",
            "liquidation", "capitulation", "falling"
        ]
        
        bullish_count = sum(1 for word in bullish_words if word in title_lower)
        bearish_count = sum(1 for word in bearish_words if word in title_lower)
        
        if bullish_count > bearish_count:
            return "bullish"
        elif bearish_count > bullish_count:
            return "bearish"
        else:
            return "neutral"
    
    def calculate_sentiment_stats(self, posts: List[Dict[str, Any]]) -> Dict[str, int]:
        """
        Calculate aggregate sentiment statistics.
        
        Returns:
            {
                "sentiment_bullish": int,
                "sentiment_bearish": int,
                "sentiment_score": int (net sentiment)
            }
        """
        bullish = sum(1 for p in posts if p.get("sentiment") == "bullish")
        bearish = sum(1 for p in posts if p.get("sentiment") == "bearish")
        
        return {
            "sentiment_bullish": bullish,
            "sentiment_bearish": bearish,
            "sentiment_score": bullish - bearish
        }


# Global singleton
_reddit_client = None


def get_reddit_client() -> RedditClient:
    """Get or create the Reddit client singleton."""
    global _reddit_client
    if _reddit_client is None:
        _reddit_client = RedditClient()
    return _reddit_client
