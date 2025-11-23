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
async def lock_user_account(reason: str, duration_seconds: int = 30) -> str:
    """
    Emergency lock the user's trading account to prevent bad trades.

    CRITICAL: Use this when risk_score > 85 or user shows FOMO/emotional trading.

    Args:
        reason: Why you're locking the account (e.g., "Risk score critical. Market crashing.")
        duration_seconds: How long to lock (default 30s for demos)

    This disables all trading buttons in the UI until lock expires.

    Example:
        lock_user_account("You're trying to buy the top! Risk is 88/100.", 30)

    Returns confirmation message.
    """
    try:
        db = get_supabase()

        # Calculate expiration time
        lock_expires_at = datetime.utcnow() + timedelta(seconds=duration_seconds)

        # Get the first portfolio record (there should only be one)
        portfolio_result = db.client.table("portfolio").select("id").limit(1).execute()

        if not portfolio_result.data:
            return "ERROR: Failed to lock account. Portfolio record not found."

        portfolio_id = portfolio_result.data[0]["id"]

        # Update portfolio lock status using the actual UUID
        result = db.client.table("portfolio").update({
            "is_locked": True,
            "lock_reason": reason,
            "lock_expires_at": lock_expires_at.isoformat()
        }).eq("id", portfolio_id).execute()

        if not result.data:
            return "ERROR: Failed to lock account. Update failed."

        minutes = duration_seconds // 60
        seconds = duration_seconds % 60
        duration_str = f"{minutes} minutes and {seconds} seconds" if minutes > 0 else f"{seconds} seconds"

        return f"""ACCOUNT LOCKED FOR {duration_str}

REASON: {reason}

All trading is disabled until {lock_expires_at.strftime('%H:%M:%S UTC')}.
This is for your own protection!""".strip()

    except Exception as e:
        return f"ERROR: Failed to lock account: {str(e)}"