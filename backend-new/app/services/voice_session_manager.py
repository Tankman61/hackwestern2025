"""
Simple voice session manager for single-user MVP.
Stores the active voice session (from ws/voice/agent) and allows
server-side triggers to send speech through that session.
"""
import logging
from typing import Optional, Any

logger = logging.getLogger(__name__)

current_session: Optional[Any] = None


def register_session(session: Any):
    """Register the active voice session."""
    global current_session
    current_session = session
    logger.info("🎙️ Voice session registered for system alerts")


def unregister_session(session: Any):
    """Unregister the active voice session if it matches."""
    global current_session
    if current_session is session:
        current_session = None
        logger.info("🎙️ Voice session unregistered")


async def speak(text: str, alert_context: dict | None = None) -> bool:
    """
    Send a system message to the active voice session and speak it.
    Returns True if delivered, False otherwise.
    """
    if not current_session:
        logger.debug("No active voice session; cannot speak alert")
        return False

    try:
        if alert_context:
            # Route through agent for contextual reaction
            await current_session.process_system_alert(text, alert_context)
        else:
            # Send text to frontend for display
            await current_session.send_message({
                "type": "agent_text",
                "text": text
            })
            # Stream TTS audio via existing session
            await current_session.speak_response(text)
        return True
    except Exception as e:
        logger.error(f"Failed to speak via voice session: {e}", exc_info=True)
        return False


async def speak_via_agent(system_text: str, alert_context: dict) -> bool:
    """
    Send a system alert through the active voice session's agent pipeline
    so the agent can react and TTS the response.
    """
    if not current_session:
        logger.debug("No active voice session; cannot route alert through agent")
        return False
    if not hasattr(current_session, "process_system_alert"):
        logger.error("Active voice session missing process_system_alert")
        return False
    try:
        await current_session.process_system_alert(system_text, alert_context)
        return True
    except Exception as e:
        logger.error(f"Failed to route alert through voice agent: {e}", exc_info=True)
        return False
