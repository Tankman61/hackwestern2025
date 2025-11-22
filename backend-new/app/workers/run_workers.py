"""
Worker Runner Script
Starts both background workers in parallel.

Usage:
    python -m app.workers.run_workers

This will start:
1. Data Ingest Worker (every 10 seconds)
2. Trigger Monitor Worker (every 1 second)
"""
import asyncio
import logging
import os
import sys
from dotenv import load_dotenv

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.workers.ingest import DataIngestWorker
from app.workers.monitor import TriggerMonitorWorker

# Load environment variables
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def main():
    """Run both workers in parallel"""
    logger.info("🚀 Starting VibeTrade background workers...")
    
    # Verify required environment variables
    required_vars = [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_KEY",
        "OPENAI_API_KEY"
    ]
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        logger.error(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        logger.error("Please set these in your .env file")
        sys.exit(1)
    
    logger.info("✅ Environment variables validated")
    
    # Initialize workers
    ingest_worker = DataIngestWorker()
    monitor_worker = TriggerMonitorWorker(websocket_manager=None)  # MVP: No WebSocket yet
    
    # Run both workers in parallel
    try:
        await asyncio.gather(
            ingest_worker.start(),
            monitor_worker.start()
        )
    except KeyboardInterrupt:
        logger.info("🛑 Received shutdown signal (Ctrl+C)")
        await asyncio.gather(
            ingest_worker.stop(),
            monitor_worker.stop()
        )
        logger.info("👋 Workers stopped gracefully")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("👋 Exiting...")

