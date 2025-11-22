"""
Tool: lock_user_account()
Emergency lockout to prevent bad trades during high-risk scenarios
Directly updates Supabase portfolio.is_locked field
"""
import os
from datetime import datetime, timedelta
from langchain_core.tools import tool
from app.services.supabase import get_supabase


@tool
async def lock_user_account(reason: str, duration_seconds: int = 300) -> str:
    """
    Emergency lock the user's trading account to prevent bad trades.

    CRITICAL: Use this when risk_score > 90 or user is about to make a terrible decision.

    Args:
        reason: Why you're locking the account (e.g., "Risk score critical: 95/100. Market crashing.")
        duration_seconds: How long to lock (default 300s = 5 minutes)

    This disables all trading buttons in the UI until lock expires.

    Example:
        lock_user_account("You're trying to buy the top! Risk is 88/100.", 600)

    Returns confirmation message.
    """
    try:
        db = get_supabase()

        # Calculate expiration time
        lock_expires_at = datetime.utcnow() + timedelta(seconds=duration_seconds)

        # Update portfolio lock status
        result = db.table("portfolio").update({
            "is_locked": True,
            "lock_reason": reason,
            "lock_expires_at": lock_expires_at.isoformat()
        }).eq("id", 1).execute()  # Assuming single portfolio with id=1

        if not result.data:
            return "ERROR: Failed to lock account. Portfolio record might not exist."

        minutes = duration_seconds // 60
        seconds = duration_seconds % 60
        duration_str = f"{minutes}m {seconds}s" if minutes > 0 else f"{seconds}s"

        return f"""
🔒 ACCOUNT LOCKED FOR {duration_str}

REASON: {reason}

All trading is disabled until {lock_expires_at.strftime('%H:%M:%S UTC')}.
This is for your own protection!
""".strip()

    except Exception as e:
        return f"ERROR: Failed to lock account: {str(e)}"