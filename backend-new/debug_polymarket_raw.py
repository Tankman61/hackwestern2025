"""
Debug script to see the RAW API response from Polymarket
Run: python debug_polymarket_raw.py
"""
import asyncio
import json
import httpx


async def main():
    print("=" * 60)
    print("🔍 Fetching RAW Polymarket API Response")
    print("=" * 60)
    
    url = "https://gamma-api.polymarket.com/events"
    params = {
        "limit": 5,
        "offset": 0,
        "active": True,
        "closed": False,
        "archived": False
    }
    
    print(f"\n📡 Calling: {url}")
    print(f"📦 Params: {params}\n")
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, params=params)
        
        print(f"✅ Status: {resp.status_code}\n")
        
        if resp.status_code == 200:
            data = resp.json()
            
            # Pretty print the first event/market
            print("📋 FULL STRUCTURE OF FIRST ITEM:")
            print("=" * 60)
            
            if isinstance(data, list) and len(data) > 0:
                first_item = data[0]
                print(json.dumps(first_item, indent=2))
            elif isinstance(data, dict):
                if "data" in data or "events" in data:
                    items = data.get("data", data.get("events", []))
                    if items and len(items) > 0:
                        print(json.dumps(items[0], indent=2))
                    else:
                        print("No items found in response")
                else:
                    print(json.dumps(data, indent=2))
            
            print("\n" + "=" * 60)
            print("\n💡 Look for these key fields:")
            print("   - 'slug' (for URL construction)")
            print("   - 'id' (unique identifier)")
            print("   - 'question' or 'title' (market name)")
            print("   - 'markets' (nested markets if it's an event)")
            
        else:
            print(f"❌ Error: Status {resp.status_code}")
            print(resp.text)
            
    except Exception as e:
        print(f"❌ Failed: {e}")


if __name__ == "__main__":
    asyncio.run(main())

