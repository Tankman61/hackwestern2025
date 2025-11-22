"""
Agent Tools
Exports all available tools for the LangGraph agent
"""
from app.agent.tools.market_sentiment import get_market_sentiment
from app.agent.tools.holdings import list_holdings
from app.agent.tools.trade import execute_trade
from app.agent.tools.lock import lock_user_account
from app.agent.tools.price import get_current_price


# All tools available to the agent
ALL_TOOLS = [
    get_market_sentiment,
    get_current_price,
    list_holdings,
    execute_trade,
    lock_user_account,
]

__all__ = [
    "ALL_TOOLS",
    "get_market_sentiment",
    "get_current_price",
    "list_holdings",
    "execute_trade",
    "lock_user_account",
]