"""
WebSocket endpoint for agent communication
WS /ws/agent - Bi-directional agent voice/text communication

MVP: Single user only, no connection manager needed
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

# TODO: Implement single WebSocket endpoint
# - No connection manager needed (MVP = 1 user)
# - Handle message types: AUDIO_CHUNK, USER_INTERRUPT, TRADE_DECISION
# - Send message types: AGENT_AUDIO, AGENT_TEXT, INTERRUPT, APPROVAL_REQUEST, LOCK_UI
# - Forward audio chunks to ElevenLabs Scribe (STT)
# - Send agent responses through ElevenLabs V3 (TTS)
# - Handle agent graph execution with LangGraph
