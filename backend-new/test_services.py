"""
Quick test script to verify all services are working
Run: python test_services.py
"""
import asyncio
import sys
import os

# Add project to path
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()


async def test_alpaca():
    """Test Alpaca BTC data fetch"""
    print("\n🧪 Testing Alpaca...")
    try:
        from app.services.alpaca import get_btc_data
        data = await get_btc_data()
        print(f"✅ Alpaca: BTC Price = ${data['btc_price']:,.2f}")
        return True
    except Exception as e:
        print(f"❌ Alpaca failed: {e}")
        return False


async def test_polymarket():
    """Test Polymarket API"""
    print("\n🧪 Testing Polymarket...")
    try:
        from app.services.polymarket import get_polymarket_client
        client = get_polymarket_client()
        markets = await client.fetch_btc_markets()
        print(f"✅ Polymarket: Fetched {len(markets)} markets")
        if markets:
            print(f"   Example: {markets}")
        return True
    except Exception as e:
        print(f"❌ Polymarket failed: {e}")
        return False


async def test_reddit():
    """Test Reddit scraper"""
    print("\n🧪 Testing Reddit...")
    try:
        from app.services.reddit import get_reddit_client
        client = get_reddit_client()
        posts = await client.fetch_posts(limit_per_sub=5)
        print(f"✅ Reddit: Fetched {len(posts)} posts")
        if posts:
            print(f"   Example: r/{posts[0]['subreddit']}: {posts[0]['title'][:60]}...")
        return True
    except Exception as e:
        print(f"❌ Reddit failed: {e}")
        return False


async def test_openai():
    """Test OpenAI analysis"""
    print("\n🧪 Testing OpenAI...")
    try:
        from app.services.openai_client import get_openai_client
        client = get_openai_client()
        
        # Simple test with mock data
        analysis = await client.analyze_market_data(
            btc_price=96500.00,
            price_change_24h=2.5,
            polymarket_markets=[
                {"title": "BTC > $100k", "odds": 0.68, "volume": "2.4M", "change": "+5%"}
            ],
            reddit_posts=[
                {"title": "Bitcoin breaking out!", "sentiment": "bullish"}
            ]
        )
        print(f"✅ OpenAI: Analysis generated")
        print(f"   Sentiment: {analysis['sentiment']}, Hype Score: {analysis['hype_score']}")
        return True
    except Exception as e:
        print(f"❌ OpenAI failed: {e}")
        return False


async def test_supabase():
    """Test Supabase connection"""
    print("\n🧪 Testing Supabase...")
    try:
        from app.services.supabase import get_supabase
        db = get_supabase()
        
        # Try to read portfolio
        portfolio = await db.get_portfolio()
        if portfolio:
            print(f"✅ Supabase: Connected (Balance: ${portfolio['balance_usd']})")
        else:
            print(f"✅ Supabase: Connected (No portfolio found)")
        return True
    except Exception as e:
        print(f"❌ Supabase failed: {e}")
        return False


async def main():
    print("=" * 60)
    print("🚀 VibeTrade Services Test Suite")
    print("=" * 60)
    
    results = await asyncio.gather(
        test_supabase(),
        test_alpaca(),
        test_polymarket(),
        test_reddit(),
        test_openai()
    )
    
    print("\n" + "=" * 60)
    print(f"📊 Results: {sum(results)}/5 services working")
    print("=" * 60)
    
    if all(results):
        print("✅ All services operational! Workers should work fine.")
        return 0
    else:
        print("⚠️  Some services failed. Fix them before running workers.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

