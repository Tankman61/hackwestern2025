"""
Test a single ingest worker cycle
Run: python test_ingest_once.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from app.workers.ingest import DataIngestWorker


async def main():
    print("=" * 60)
    print("🧪 Testing Single Ingest Cycle")
    print("=" * 60)
    
    worker = DataIngestWorker()
    
    print("\n🔄 Running one cycle...")
    await worker._run_cycle()
    
    print("\n✅ Cycle complete! Check Supabase to verify data was written:")
    print("   1. Check 'market_context' table for new row")
    print("   2. Check 'feed_items' table for Polymarket and Reddit posts")
    print("\n💡 Tip: Open Supabase dashboard → Table Editor")


if __name__ == "__main__":
    asyncio.run(main())

