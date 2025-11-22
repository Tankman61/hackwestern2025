"""
Supabase database client
Handles all database operations
"""
import os
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

logger = logging.getLogger(__name__)

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


class SupabaseWrapper:
    """Wrapper around Supabase client with helper methods for workers"""
    
    def __init__(self, client: Client):
        self.client = client
        logger.info("✅ Supabase wrapper initialized")
    
    # ==================== Market Context ====================
    
    async def insert_market_context(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert new market context data"""
        try:
            result = self.client.table("market_context").insert(data).execute()
            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Failed to insert market context: {e}")
            raise
    
    async def get_latest_market_context(self) -> Optional[Dict[str, Any]]:
        """Get the most recent market context entry"""
        try:
            result = self.client.table("market_context")\
                .select("*")\
                .order("created_at", desc=True)\
                .limit(1)\
                .execute()
            
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Failed to get latest market context: {e}")
            return None
    
    async def update_market_context_risk_score(self, context_id: str, risk_score: int) -> None:
        """Update risk_score for a specific market context"""
        try:
            self.client.table("market_context")\
                .update({"risk_score": risk_score})\
                .eq("id", context_id)\
                .execute()
        except Exception as e:
            logger.error(f"Failed to update risk_score: {e}")
            raise
    
    # ==================== Feed Items ====================
    
    async def upsert_feed_items(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Upsert feed items (Polymarket or Reddit)"""
        try:
            # Delete old items from same source before inserting new ones
            if items:
                source = items[0].get("source")
                if source:
                    self.client.table("feed_items")\
                        .delete()\
                        .eq("source", source)\
                        .execute()
            
            # Insert new items
            result = self.client.table("feed_items").insert(items).execute()
            return result.data if result.data else []
        except Exception as e:
            logger.error(f"Failed to upsert feed items: {e}")
            raise
    
    # ==================== Portfolio ====================
    
    async def get_portfolio(self) -> Optional[Dict[str, Any]]:
        """Get the single portfolio row"""
        try:
            result = self.client.table("portfolio").select("*").limit(1).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Failed to get portfolio: {e}")
            return None


def get_supabase() -> SupabaseWrapper:
    """Get Supabase wrapper instance"""
    return SupabaseWrapper(supabase)
