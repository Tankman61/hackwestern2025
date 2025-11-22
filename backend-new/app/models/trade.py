"""
Trade/Order data models
Matches Supabase trades table schema
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# TODO: Define Trade model
# - id: str (UUID)
# - ticker: str
# - side: str (BUY/SELL)
# - order_type: str (MARKET/LIMIT/STOP_LOSS)
# - amount: float
# - limit_price: Optional[float]
# - status: str (PENDING_APPROVAL/OPEN/FILLED/CANCELLED)
# - created_at: datetime
