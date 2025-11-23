"""
Reddit JSON endpoint client
Fetches posts from trading subreddits
"""
import logging
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime
import httpx
import json

logger = logging.getLogger(__name__)

# Try to import OpenAI client for advanced sentiment analysis
try:
    from app.services.openai_client import get_openai_client
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    logger.warning("OpenAI client not available - using keyword-only sentiment analysis")


class RedditClient:
    """Client for scraping Reddit posts via JSON endpoint (no auth)"""
    
    def __init__(self):
        # Reduced to 3 subreddits to avoid rate limiting (Reddit has strict limits)
        # Focus on most relevant crypto/trading subreddits
        self.subreddits = [
            "wallstreetbets",
            "CryptoCurrency",
            "Bitcoin"
        ]
        # Reddit requires specific User-Agent format: <platform>:<app ID>:<version> (by /u/<username>)
        # For unauthenticated requests, use a simple browser-like User-Agent
        self.user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        logger.info("✅ Reddit client initialized (fetching from 3 subreddits to avoid rate limiting)")
    
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
        rate_limited_count = 0
        
        # Fetch subreddits sequentially with delays to avoid rate limiting
        # Reddit rate limit: ~1 request per second, so we add 2-3 second delays
        for idx, subreddit in enumerate(self.subreddits):
            try:
                # Add delay between subreddit requests (Reddit rate limit: ~1 req/sec)
                if idx > 0:
                    await asyncio.sleep(3)  # 3 second delay between subreddits
                
                posts = await self._fetch_subreddit_posts(subreddit, limit_per_sub, skip_comments=True)
                all_posts.extend(posts)
                
            except Exception as e:
                error_msg = str(e)
                if "429" in error_msg or "rate limit" in error_msg.lower():
                    rate_limited_count += 1
                    logger.warning(f"⚠️  Rate limited (429) on r/{subreddit} - skipping")
                    # Wait longer before next request if rate limited (10 seconds)
                    await asyncio.sleep(10)
                else:
                    logger.error(f"❌ Failed to fetch r/{subreddit}: {e}")
                continue
        
        if rate_limited_count > 0:
            logger.warning(f"⚠️  {rate_limited_count}/{len(self.subreddits)} subreddits were rate limited (429)")
            if rate_limited_count == len(self.subreddits):
                logger.error("❌ All subreddits rate limited - Reddit is blocking all requests")
                logger.error("   Waiting 60 seconds and returning empty list. Next cycle should work.")
                await asyncio.sleep(60)  # Wait a full minute if all rate limited
        
        logger.info(f"✅ Fetched {len(all_posts)} Reddit posts from {len(self.subreddits)} subreddits")
        return all_posts
    
    async def _fetch_subreddit_posts(self, subreddit: str, limit: int, skip_comments: bool = False) -> List[Dict[str, Any]]:
        """
        Fetch posts from a single subreddit.
        
        Args:
            subreddit: Subreddit name
            limit: Number of posts to fetch
            skip_comments: If True, skip fetching comments (reduces API calls)
        """
        url = f"https://www.reddit.com/r/{subreddit}/hot.json"
        params = {"limit": limit}
        headers = {
            "User-Agent": self.user_agent,
            "Accept": "application/json, text/html, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Referer": "https://www.reddit.com/",
            "Origin": "https://www.reddit.com"
        }
        
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            # Try up to 2 times with backoff on 429
            for attempt in range(2):
                response = await client.get(url, params=params, headers=headers)
                
                if response.status_code == 429:
                    if attempt < 1:
                        wait_time = 10 * (attempt + 1)  # 10s, 20s
                        logger.warning(f"⚠️  Rate limited (429) on r/{subreddit}, waiting {wait_time}s before retry...")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        # Final attempt failed, raise exception
                        raise Exception(f"Reddit returned status 429 (rate limited) after retries")
                
                if response.status_code == 403:
                    # 403 Forbidden - Reddit is blocking the request
                    logger.error(f"❌ Reddit returned 403 Forbidden for r/{subreddit}")
                    logger.error(f"   Response headers: {dict(response.headers)}")
                    logger.error(f"   Response text (first 500 chars): {response.text[:500]}")
                    raise Exception(f"Reddit returned status 403 (Forbidden) - check User-Agent and headers")
                
                if response.status_code != 200:
                    raise Exception(f"Reddit returned status {response.status_code}")
                
                # Success - break retry loop
                break
            
            data = response.json()
        
        posts = []
        children = data.get("data", {}).get("children", [])
        
        logger.debug(f"Fetched {len(children)} posts from r/{subreddit} (before filtering)")
        
        for child in children:
            post_data = child.get("data", {})
            
            # Skip stickied posts
            if post_data.get("stickied", False):
                continue
            
            title = post_data.get("title", "")
            
            # Skip posts with no title
            if not title:
                continue
            
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
            
            # Fetch top comments for this post (limit to 5 top comments)
            # Skip comment fetching if skip_comments flag is set (reduces API calls and rate limiting)
            comments = []
            if not skip_comments:
                try:
                    comments = await self._fetch_post_comments(permalink, limit=5)
                except Exception as e:
                    # Silently skip comments if rate limited or other errors
                    if "429" not in str(e):
                        logger.debug(f"Failed to fetch comments for post: {e}")
            
            # Enhanced sentiment analysis using title, comments, upvote_ratio, and OpenAI
            sentiment = await self._analyze_sentiment_enhanced(
                title=title,
                comments=comments,
                upvote_ratio=upvote_ratio,
                score=score,
                num_comments=num_comments
            )
            
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
            headers = {
                "User-Agent": self.user_agent,
                "Accept": "application/json, text/html, */*",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://www.reddit.com/"
            }
            
            async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
                response = await client.get(url, params=params)
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
                
                # Analyze comment sentiment using keywords
                comment_sentiment = self._analyze_sentiment_keywords(body, [])
                
                comments.append({
                    "author": f"u/{author}",
                    "body": body[:300],  # Truncate long comments
                    "score": score,
                    "upvote_ratio": round(upvote_ratio, 2),
                    "sentiment": comment_sentiment
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
    
    async def _analyze_sentiment_enhanced(
        self,
        title: str,
        comments: List[Dict[str, Any]],
        upvote_ratio: float,
        score: int,
        num_comments: int
    ) -> str:
        """
        Enhanced sentiment analysis using:
        - Expanded keyword lists
        - Comment sentiment analysis
        - Upvote ratio weighting
        - OpenAI analysis for high-engagement posts
        """
        # Step 1: Keyword-based analysis (expanded lists)
        keyword_sentiment = self._analyze_sentiment_keywords(title, comments)
        
        # Step 2: Upvote ratio weighting
        # High upvote_ratio (>0.8) = community agrees with sentiment
        # Low upvote_ratio (<0.5) = community disagrees, may indicate opposite sentiment
        upvote_weight = 1.0
        if upvote_ratio > 0.8 and score > 10:
            upvote_weight = 1.3  # Strong community agreement
        elif upvote_ratio < 0.5 and score > 10:
            upvote_weight = 0.7  # Community disagreement
            # If community disagrees with a bullish post, it's likely bearish
            if keyword_sentiment == "bullish":
                keyword_sentiment = "bearish"
            elif keyword_sentiment == "bearish":
                keyword_sentiment = "bullish"
        
        # Step 3: Comment sentiment analysis
        comment_sentiment_score = self._analyze_comments_sentiment(comments)
        
        # Step 4: Combine keyword and comment analysis
        combined_sentiment = self._combine_sentiment_scores(
            keyword_sentiment=keyword_sentiment,
            comment_sentiment=comment_sentiment_score,
            upvote_weight=upvote_weight
        )
        
        # Step 5: Use OpenAI for high-engagement posts or ambiguous cases
        # Only use OpenAI for posts with high engagement or when sentiment is ambiguous
        should_use_openai = (
            OPENAI_AVAILABLE and
            (score > 50 or num_comments > 20) and  # High engagement
            combined_sentiment == "neutral"  # Ambiguous sentiment
        )
        
        if should_use_openai:
            try:
                openai_sentiment = await self._analyze_sentiment_openai(title, comments)
                if openai_sentiment != "neutral":
                    return openai_sentiment
            except Exception as e:
                logger.debug(f"OpenAI sentiment analysis failed: {e}")
                # Fall back to combined sentiment
        
        return combined_sentiment
    
    def _analyze_sentiment_keywords(self, title: str, comments: List[Dict[str, Any]]) -> str:
        """Expanded keyword-based sentiment analysis"""
        text_to_analyze = title.lower()
        
        # Also analyze top comments
        for comment in comments[:3]:  # Top 3 comments
            body = comment.get("body", "").lower()
            text_to_analyze += " " + body[:200]  # First 200 chars of comment
        
        # Expanded bullish keywords
        bullish_words = [
            # Price action
            "moon", "moonshot", "mooning", "rocket", "rocketing", "pump", "pumping",
            "breakout", "break out", "rally", "ralling", "surge", "surging", "skyrocket",
            "parabolic", "explosive", "bullish", "bull run", "bull market",
            
            # Trading terms
            "yolo", "calls", "long", "going long", "buy", "buying", "buy the dip",
            "accumulate", "accumulation", "diamond hands", "diamond hand", "hodl", "hodling",
            "hold", "holding", "to the moon", "moon gang",
            
            # Positive sentiment
            "gains", "profit", "profitability", "green", "green candles", "bullish trend",
            "upward", "ascending", "rising", "soaring", "climbing",
            
            # Market events
            "squeeze", "short squeeze", "gamma squeeze", "fomo", "fear of missing out",
            "institutional", "adoption", "mainstream", "mass adoption",
            
            # Crypto-specific
            "btc", "bitcoin", "ethereum", "eth", "altcoin", "alt season",
            "degen", "lambo", "wen moon", "wen lambo",
            
            # Confidence
            "confident", "optimistic", "bullish", "strong", "solid", "support",
            "resistance broken", "new ath", "all time high", "record high"
        ]
        
        # Expanded bearish keywords
        bearish_words = [
            # Price action
            "dump", "dumping", "dumpster", "crash", "crashing", "crash landing",
            "bearish", "bear market", "bear run", "tank", "tanking", "plummet",
            "plunge", "plunging", "collapse", "collapsing", "free fall", "freefall",
            "rekt", "wrecked", "devastated", "obliterated",
            
            # Trading terms
            "sell", "selling", "short", "shorting", "puts", "put options",
            "exit", "exiting", "close position", "take profit", "stop loss",
            "liquidation", "liquidated", "margin call", "capitulation", "capitulating",
            
            # Negative sentiment
            "loss", "losses", "losing", "red", "red candles", "bearish trend",
            "downward", "descending", "falling", "dropping", "declining",
            
            # Market events
            "bubble", "bubble bursting", "correction", "overvalued", "overbought",
            "sell off", "selloff", "panic", "panicking", "fear", "fearful",
            
            # Crypto-specific
            "scam", "scammer", "rug pull", "rug", "pulled", "exit scam",
            "dead", "died", "killed", "destroyed", "worst", "terrible",
            "warning", "beware", "caution", "danger",
            
            # Technical indicators
            "oversold", "rsi high", "macd bearish", "death cross", "support broken",
            "resistance", "rejection", "failed breakout", "false breakout",
            
            # Fear/uncertainty
            "uncertain", "worried", "concerned", "skeptical", "doubtful",
            "risky", "dangerous", "volatile", "unstable"
        ]
        
        bullish_count = sum(1 for word in bullish_words if word in text_to_analyze)
        bearish_count = sum(1 for word in bearish_words if word in text_to_analyze)
        
        if bullish_count > bearish_count:
            return "bullish"
        elif bearish_count > bullish_count:
            return "bearish"
        else:
            return "neutral"
    
    def _analyze_comments_sentiment(self, comments: List[Dict[str, Any]]) -> Dict[str, float]:
        """Analyze sentiment from comments, weighted by score and upvote ratio"""
        if not comments:
            return {"bullish": 0.0, "bearish": 0.0, "neutral": 0.0}
        
        bullish_weight = 0.0
        bearish_weight = 0.0
        neutral_weight = 0.0
        
        for comment in comments:
            body = comment.get("body", "")
            score = comment.get("score", 0)
            upvote_ratio = comment.get("upvote_ratio", 0.5)
            comment_sentiment = comment.get("sentiment", "neutral")
            
            # Weight by comment score and upvote ratio
            # High score + high upvote ratio = strong agreement
            weight = abs(score) * upvote_ratio
            
            if comment_sentiment == "bullish":
                bullish_weight += weight
            elif comment_sentiment == "bearish":
                bearish_weight += weight
            else:
                neutral_weight += weight
        
        total_weight = bullish_weight + bearish_weight + neutral_weight
        if total_weight == 0:
            return {"bullish": 0.0, "bearish": 0.0, "neutral": 1.0}
        
        return {
            "bullish": bullish_weight / total_weight,
            "bearish": bearish_weight / total_weight,
            "neutral": neutral_weight / total_weight
        }
    
    def _combine_sentiment_scores(
        self,
        keyword_sentiment: str,
        comment_sentiment: Dict[str, float],
        upvote_weight: float
    ) -> str:
        """Combine keyword and comment sentiment scores"""
        # Convert keyword sentiment to scores
        keyword_scores = {
            "bullish": {"bullish": 1.0, "bearish": 0.0, "neutral": 0.0},
            "bearish": {"bullish": 0.0, "bearish": 1.0, "neutral": 0.0},
            "neutral": {"bullish": 0.3, "bearish": 0.3, "neutral": 0.4}
        }
        
        base_keyword = keyword_scores.get(keyword_sentiment, keyword_scores["neutral"])
        
        # Weight: 60% keywords (title), 40% comments
        combined_bullish = (base_keyword["bullish"] * 0.6 + comment_sentiment["bullish"] * 0.4) * upvote_weight
        combined_bearish = (base_keyword["bearish"] * 0.6 + comment_sentiment["bearish"] * 0.4) * upvote_weight
        
        # Make decision with bias away from neutral
        # Threshold: 0.4 instead of 0.5 to reduce neutral results
        diff = combined_bullish - combined_bearish
        
        if diff > 0.15:  # Strong bullish bias
            return "bullish"
        elif diff < -0.15:  # Strong bearish bias
            return "bearish"
        elif diff > 0.05:  # Weak bullish bias (avoid neutral)
            return "bullish"
        elif diff < -0.05:  # Weak bearish bias (avoid neutral)
            return "bearish"
        else:
            # Only return neutral if truly ambiguous
            return "neutral"
    
    async def _analyze_sentiment_openai(self, title: str, comments: List[Dict[str, Any]]) -> str:
        """Use OpenAI to analyze sentiment from title and comments"""
        try:
            openai_client = get_openai_client()
            
            # Prepare comment text
            comment_texts = []
            for comment in comments[:5]:  # Top 5 comments
                body = comment.get("body", "")
                score = comment.get("score", 0)
                upvote_ratio = comment.get("upvote_ratio", 0.5)
                comment_texts.append(f"[Score: {score}, Upvote Ratio: {upvote_ratio:.2f}] {body[:200]}")
            
            comments_str = "\n".join(comment_texts) if comment_texts else "No comments"
            
            prompt = f"""Analyze the sentiment of this Reddit post and its comments. Return ONLY one word: "bullish", "bearish", or "neutral".

Post Title: {title}

Top Comments:
{comments_str}

Guidelines:
- "bullish" = optimistic, buying, price going up, positive sentiment
- "bearish" = pessimistic, selling, price going down, negative sentiment  
- "neutral" = only if truly ambiguous or mixed
- Weight comments with high scores (>10) and high upvote ratios (>0.7) more heavily
- Consider the overall community sentiment (upvote ratios indicate agreement)

Return only the word:"""

            response = await openai_client.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a sentiment analysis system for cryptocurrency/trading Reddit posts. Return only one word: bullish, bearish, or neutral."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=10
            )
            
            result = response.choices[0].message.content.strip().lower()
            
            # Validate response
            if result in ["bullish", "bearish", "neutral"]:
                return result
            else:
                logger.debug(f"OpenAI returned invalid sentiment: {result}")
                return "neutral"
                
        except Exception as e:
            logger.debug(f"OpenAI sentiment analysis error: {e}")
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
