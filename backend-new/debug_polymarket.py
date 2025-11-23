"""
Debug script to test Polymarket API and see actual response structure
Run: python debug_polymarket.py
"""
import asyncio
import json
from app.services.polymarket import get_polymarket_client


async def main():
    print("=" * 60)
    print("🧪 Debugging Polymarket API")
    print("=" * 60)
    
    client = get_polymarket_client()
    
    print("\n📊 Fetching markets...")
    markets = await client.fetch_btc_markets(limit=10)
    
    print(f"\n✅ Retrieved {len(markets)} markets\n")
    
    for i, market in enumerate(markets, 1):
        print(f"{i}. {market['title'][:70]}")
        print(f"   Odds: {int(market['odds']*100)}% | Volume: {market['volume']}")
        print(f"   URL: {market['url']}")
        print()
    
    # Test URL quality
    base_url_count = sum(1 for m in markets if m['url'] == "https://polymarket.com")
    proper_url_count = len(markets) - base_url_count
    
    # Check for duplicate URLs
    urls = [m['url'] for m in markets]
    unique_urls = len(set(urls))
    
    print("=" * 60)
    print(f"📈 Results:")
    print(f"   Total markets: {len(markets)}")
    print(f"   Unique URLs: {unique_urls}")
    print(f"   Proper event URLs: {proper_url_count}")
    print(f"   Base URLs (broken): {base_url_count}")
    
    if unique_urls == len(markets) and proper_url_count == len(markets):
        print("\n✅ Perfect! All markets have unique, proper URLs!")
    elif base_url_count > 0:
        print(f"\n⚠️  WARNING: {base_url_count} markets have broken base URLs")
    elif unique_urls < len(markets):
        print(f"\n⚠️  WARNING: {len(markets) - unique_urls} duplicate URLs found")
    
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())

