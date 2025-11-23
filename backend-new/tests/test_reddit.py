"""
Quick test to check if Reddit fetching is working
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from app.services.reddit import get_reddit_client

async def test():
    print("🧪 Testing Reddit fetching...")
    client = get_reddit_client()
    posts = await client.fetch_posts(limit_per_sub=2)
    print(f"\n✅ Fetched {len(posts)} posts total")
    
    if posts:
        print("\n📊 Sample post:")
        post = posts[0]
        print(f"   Title: {post['title'][:60]}...")
        print(f"   Subreddit: {post['subreddit']}")
        print(f"   Sentiment: {post['sentiment']}")
        
        # Check sentiment stats
        stats = client.calculate_sentiment_stats(posts)
        print(f"\n📈 Sentiment stats:")
        print(f"   Bullish: {stats['sentiment_bullish']}")
        print(f"   Bearish: {stats['sentiment_bearish']}")
        print(f"   Score: {stats['sentiment_score']}")
    else:
        print("❌ No posts fetched! Check Reddit API or network connection")

if __name__ == "__main__":
    asyncio.run(test())

