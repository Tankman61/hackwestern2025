"""
Agent API - Chat endpoint for LangGraph agent
Allows direct injection of system alerts and user messages

NOTE (single-user voice-first MVP):
- Anomaly alerts should go through the live voice WebSocket session and TTS.
- Keep this HTTP endpoint around for text-only calls or UI hooks (e.g., voice-test),
  but voice alerts should use the voice session manager instead.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from langchain_core.messages import HumanMessage, SystemMessage
import logging

from app.agent.graph import agent_graph
from app.agent.state import AgentState

router = APIRouter()
logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = "default-session"
    alert_context: Optional[Dict[str, Any]] = None  # For system alerts from monitor worker


@router.post("/api/agent/chat")
async def agent_chat(request: ChatRequest):
    """
    Send a message to the LangGraph agent and get response.

    Used by:
    - Monitor worker to inject system alerts
    - Frontend to send user messages

    Example alert from monitor worker:
    {
        "message": "[SYSTEM ALERT] Bitcoin crashing! Risk at 85/100!",
        "thread_id": "alert-session",
        "alert_context": {
            "alert_type": "RISK_CRITICAL",
            "risk_score": 85,
            "btc_price": 75000,
            "price_change_24h": -8.5
        }
    }
    """
    try:
        config = {"configurable": {"thread_id": request.thread_id}}

        # If this is a system alert, inject context as system message first
        messages = []
        if request.alert_context:
            alert_type = request.alert_context.get("alert_type", "ALERT")
            risk_score = request.alert_context.get("risk_score", 0)
            hype_score = request.alert_context.get("hype_score", 0)
            btc_price = request.alert_context.get("btc_price", 0)
            price_change = request.alert_context.get("price_change_24h", 0)

            system_context = f"""URGENT SYSTEM ALERT:
Type: {alert_type}
Risk Score: {risk_score}/100
Hype Score: {hype_score}/100
BTC Price: ${btc_price:,.2f}
24h Change: {price_change:+.2f}%

The user needs to be informed immediately about this critical market event."""

            messages.append(SystemMessage(content=system_context))

        # Add the actual message
        messages.append(HumanMessage(content=request.message))

        # Collect agent response
        agent_response = ""
        final_state = None

        logger.info(f"🤖 Agent invoked with message: {request.message}")

        # Stream agent response
        async for event in agent_graph.astream(
            {"messages": messages},
            config=config,
            stream_mode="values"
        ):
            if "messages" in event and event["messages"]:
                last_msg = event["messages"][-1]

                # Capture final text response (not tool calls)
                if hasattr(last_msg, "content") and last_msg.content:
                    if not hasattr(last_msg, "tool_calls") or not last_msg.tool_calls:
                        agent_response = last_msg.content
                        final_state = event

        logger.info(f"✅ Agent responded: {agent_response[:100]}...")

        return {
            "success": True,
            "response": agent_response,
            "thread_id": request.thread_id,
            "state": {
                "risk_score": final_state.get("risk_score", 0) if final_state else 0,
                "portfolio_locked": final_state.get("portfolio_locked", False) if final_state else False,
            }
        }

    except Exception as e:
        logger.error(f"❌ Agent error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")


@router.get("/api/agent/health")
async def agent_health():
    """Check if agent is available"""
    return {
        "status": "healthy",
        "agent": "Akira",
        "graph": "available"
    }
