"""
LangGraph Agent State
Defines the state object that flows through the agent graph
"""
from typing import Annotated, Sequence, Optional
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage


class AgentState(TypedDict):
    """
    State that flows through the LangGraph agent

    Fields:
    - messages: Full conversation history (automatically managed by add_messages)
    - risk_score: Current market risk level (0-100)
    - risk_level: Current risk category (Low/Medium/High)
    - portfolio_locked: Whether trading is currently disabled
    - lock_reason: Why the account is locked (if locked)
    - pending_trade_id: ID of trade awaiting user approval
    - requires_approval: Whether agent is waiting for user decision
    """
    messages: Annotated[Sequence[BaseMessage], add_messages]
    risk_score: int
    risk_level: str
    portfolio_locked: bool
    lock_reason: Optional[str]
    pending_trade_id: Optional[str]
    requires_approval: bool