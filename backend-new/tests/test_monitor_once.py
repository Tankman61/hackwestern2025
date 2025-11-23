"""
Test a single monitor worker cycle
Run: python test_monitor_once.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from app.workers.monitor import TriggerMonitorWorker


async def main():
    print("=" * 60)
    print("🧪 Testing Single Monitor Cycle")
    print("=" * 60)
    
    worker = TriggerMonitorWorker()
    
    print("\n🔄 Running one cycle...")
    await worker._run_cycle()
    
    print("\n✅ Cycle complete! Check Supabase:")
    print("   • market_context.risk_score should now have a value (not 0)")
    print("   • If risk_score > 80, you should see an alert in logs")


if __name__ == "__main__":
    asyncio.run(main())

