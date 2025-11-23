"""
Test script to find the correct Polymarket URL format
Run: python test_polymarket_urls.py
"""
import asyncio
import httpx
import json


async def main():
    print("=" * 70)
    print("🔍 Testing Polymarket URL Construction")
    print("=" * 70)
    
    url = "https://gamma-api.polymarket.com/events"
    params = {"limit": 3, "offset": 0, "active": True, "closed": False}
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params)
    
    if resp.status_code != 200:
        print(f"❌ Error: {resp.status_code}")
        return
    
    events = resp.json()
    
    print(f"\n📋 Analyzing {len(events)} events:\n")
    
    for i, event in enumerate(events[:3], 1):
        print(f"{'='*70}")
        print(f"Event {i}: {event.get('title', 'N/A')}")
        print(f"{'='*70}")
        
        # Get all possible identifiers
        ticker = event.get("ticker", "")
        slug = event.get("slug", "")
        event_id = event.get("id", "")
        
        print(f"\nIdentifiers:")
        print(f"  ticker: {ticker}")
        print(f"  slug: {slug}")
        print(f"  id: {event_id}")
        
        # Check markets
        if event.get("markets"):
            market = event["markets"][0]
            market_id = market.get("id", "")
            condition_id = market.get("conditionId", "")
            
            print(f"\nMarket Identifiers:")
            print(f"  market_id: {market_id}")
            print(f"  condition_id: {condition_id}")
            
            # Try different URL formats
            print(f"\n📎 Possible URL formats:")
            print(f"  1. /event/{ticker} → https://polymarket.com/event/{ticker}")
            print(f"  2. /event/{slug} → https://polymarket.com/event/{slug}")
            print(f"  3. /event/{event_id} → https://polymarket.com/event/{event_id}")
            print(f"  4. /event/{condition_id} → https://polymarket.com/event/{condition_id}")
            print(f"  5. /market/{market_id} → https://polymarket.com/market/{market_id}")
            
            # Check for direct URL field
            if "url" in event:
                print(f"\n✅ DIRECT URL FOUND: {event['url']}")
            if "url" in market:
                print(f"✅ MARKET URL FOUND: {market['url']}")
            
            print()
        print()


if __name__ == "__main__":
    asyncio.run(main())

