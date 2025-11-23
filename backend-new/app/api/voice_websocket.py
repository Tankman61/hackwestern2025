"""
Voice WebSocket API
Bidirectional voice communication with LangGraph agent
"""
import asyncio
import json
import base64
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Any
from langchain_core.messages import HumanMessage, SystemMessage

from app.services.elevenlabs_service import elevenlabs_service
from app.agent.graph import agent_graph

router = APIRouter()
logger = logging.getLogger(__name__)


class VoiceSession:
    """
    Manages a single voice conversation session
    """
    def __init__(self, websocket: WebSocket, thread_id: str):
        self.websocket = websocket
        self.thread_id = thread_id
        self.stt = None
        self.tts = None
        self.is_speaking = False
        self.current_transcript = ""

    async def start(self):
        """Initialize STT and TTS connections"""
        try:
            # Create STT instance
            self.stt = elevenlabs_service.create_stt()
            await self.stt.connect(sample_rate=16000, codec="pcm")

            # Create TTS instance
            self.tts = elevenlabs_service.create_tts()
            await self.tts.connect(
                model_id="eleven_turbo_v2_5",
                output_format="mp3_44100_192",
                stability=0.7,  # Higher stability for cleaner audio
                similarity_boost=0.8
            )

            logger.info(f"✅ Voice session started: {self.thread_id}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to start voice session: {e}")
            return False

    async def handle_audio_input(self, audio_base64: str):
        """Handle incoming audio from user"""
        try:
            # Check if STT needs reconnection
            needs_reconnect = False
            if not self.stt or not self.stt.websocket:
                needs_reconnect = True
            else:
                # Try to detect if websocket is closed by attempting to send
                try:
                    # Test if websocket is still alive
                    await self.stt.send_audio(audio_base64, sample_rate=16000, commit=False)
                    return  # Success, no need to reconnect
                except Exception as send_err:
                    logger.warning(f"⚠️ STT send failed: {send_err}, reconnecting...")
                    needs_reconnect = True

            if needs_reconnect:
                # Close old connection if exists
                if self.stt:
                    try:
                        await self.stt.close()
                    except:
                        pass

                # Create new STT connection
                logger.info("🔄 Creating new STT connection...")
                self.stt = elevenlabs_service.create_stt()
                success = await self.stt.connect(sample_rate=16000, codec="pcm")
                if success:
                    logger.info("✅ STT reconnected successfully")
                    # Restart STT listener task
                    import asyncio
                    asyncio.create_task(self.listen_to_stt())
                    # Now send the audio
                    await self.stt.send_audio(audio_base64, sample_rate=16000, commit=False)
                else:
                    logger.error("❌ STT reconnection failed")
                    await self.send_error("Failed to reconnect STT")
                    return

        except Exception as e:
            logger.error(f"❌ Error processing audio input: {e}", exc_info=True)
            await self.send_error(f"Failed to process audio: {str(e)}")

    async def commit_audio(self):
        """Finalize current audio segment and get transcription"""
        try:
            # Check if STT is connected (websockets doesn't have .closed attribute)
            if not self.stt or not self.stt.websocket:
                logger.warning("STT disconnected during commit, cannot commit audio")
                return

            # Send commit signal to STT
            await self.stt.send_audio("", sample_rate=16000, commit=True)

        except Exception as e:
            logger.error(f"Error committing audio: {e}")

    async def listen_to_stt(self):
        """Listen for transcription results from STT"""
        try:
            async for transcript in self.stt.receive_transcripts():
                transcript_type = transcript.get("type")
                text = transcript.get("text", "")

                if transcript_type == "partial":
                    # Send partial transcript to frontend for display
                    await self.send_message({
                        "type": "partial_transcript",
                        "text": text
                    })

                elif transcript_type == "final":
                    # Send final transcript
                    await self.send_message({
                        "type": "final_transcript",
                        "text": text
                    })

                    # Process with agent
                    if text.strip():
                        await self.process_with_agent(text)

                elif transcript_type == "error":
                    await self.send_error(transcript.get("message", "STT error"))

        except Exception as e:
            logger.error(f"Error in STT listener: {e}")

    async def process_with_agent(self, user_text: str):
        """Send text to LangGraph agent and get response"""
        try:
            logger.info(f"🤖 Processing with agent: {user_text}")

            # Notify frontend agent is thinking
            await self.send_message({
                "type": "agent_thinking",
                "is_thinking": True
            })

            # Create human message
            config = {"configurable": {"thread_id": self.thread_id}}
            messages = [HumanMessage(content=user_text)]

            # Stream agent response
            agent_response_text = ""
            async for event in agent_graph.astream(
                {"messages": messages},
                config=config,
                stream_mode="values"
            ):
                if "messages" in event and event["messages"]:
                    last_msg = event["messages"][-1]

                    # Get agent's text response (not tool calls)
                    if hasattr(last_msg, "content") and last_msg.content:
                        if not hasattr(last_msg, "tool_calls") or not last_msg.tool_calls:
                            agent_response_text = last_msg.content

            # Send text response to frontend
            await self.send_message({
                "type": "agent_text",
                "text": agent_response_text
            })

            # Convert to speech
            if agent_response_text:
                await self.speak_response(agent_response_text)

            # Done thinking
            await self.send_message({
                "type": "agent_thinking",
                "is_thinking": False
            })

        except Exception as e:
            logger.error(f"Error processing with agent: {e}")
            await self.send_error(f"Agent error: {str(e)}")
            await self.send_message({
                "type": "agent_thinking",
                "is_thinking": False
            })

    async def speak_response(self, text: str):
        """Convert agent response to speech and stream to frontend"""
        tts = None
        try:
            logger.info(f"🔊 Speaking response: {text[:50]}...")

            # Notify frontend agent is speaking
            await self.send_message({
                "type": "agent_speaking",
                "is_speaking": True
            })

            # Create fresh TTS connection for this response (avoids timeout)
            from app.services.elevenlabs_service import elevenlabs_service
            tts = elevenlabs_service.create_tts()
            await tts.connect(
                model_id="eleven_turbo_v2_5",
                output_format="mp3_44100_192",
                stability=0.7,  # Higher stability for cleaner audio
                similarity_boost=0.8
            )

            # Send text to TTS
            await tts.send_text(text, flush=False)
            await tts.finalize()

            # Stream audio chunks to frontend
            async for audio_chunk in tts.receive_audio():
                # Encode audio as base64
                audio_base64 = base64.b64encode(audio_chunk).decode("utf-8")

                await self.send_message({
                    "type": "agent_audio",
                    "audio": audio_base64
                })

            # Done speaking
            await self.send_message({
                "type": "agent_speaking",
                "is_speaking": False
            })

            logger.info("✅ Finished speaking response")

        except Exception as e:
            logger.error(f"Error in speak_response: {e}")
            await self.send_error(f"TTS error: {str(e)}")
            await self.send_message({
                "type": "agent_speaking",
                "is_speaking": False
            })
        finally:
            # Close the TTS connection
            if tts:
                await tts.close()

    async def send_message(self, message: Dict[str, Any]):
        """Send message to frontend"""
        try:
            await self.websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending message to frontend: {e}")

    async def send_error(self, error_message: str):
        """Send error to frontend"""
        await self.send_message({
            "type": "error",
            "message": error_message
        })

    async def close(self):
        """Clean up resources"""
        if self.stt:
            await self.stt.close()
        if self.tts:
            await self.tts.close()
        logger.info(f"Voice session closed: {self.thread_id}")


@router.websocket("/ws/voice/agent")
async def voice_agent_websocket(websocket: WebSocket):
    """
    Voice WebSocket endpoint for bidirectional voice communication

    Protocol:
    Client → Server:
        - {"type": "start", "thread_id": "session-123"}
        - {"type": "audio_chunk", "audio": "base64_encoded_audio"}
        - {"type": "audio_end"}
        - {"type": "stop"}

    Server → Client:
        - {"type": "ready"}
        - {"type": "partial_transcript", "text": "..."}
        - {"type": "final_transcript", "text": "..."}
        - {"type": "agent_thinking", "is_thinking": true}
        - {"type": "agent_text", "text": "..."}
        - {"type": "agent_speaking", "is_speaking": true}
        - {"type": "agent_audio", "audio": "base64_encoded_audio"}
        - {"type": "error", "message": "..."}
    """
    logger.info("🎙️ Voice WebSocket connection incoming...")
    await websocket.accept()
    logger.info("✅ Voice WebSocket connection accepted")

    session = None
    stt_task = None

    try:
        # Wait for start message
        data = await websocket.receive_json()

        if data.get("type") != "start":
            await websocket.send_json({
                "type": "error",
                "message": "First message must be 'start' with thread_id"
            })
            await websocket.close()
            return

        thread_id = data.get("thread_id", "default-voice-session")

        # Create voice session
        session = VoiceSession(websocket, thread_id)
        success = await session.start()

        if not success:
            await websocket.send_json({
                "type": "error",
                "message": "Failed to initialize voice session"
            })
            await websocket.close()
            return

        # Start STT listener task
        stt_task = asyncio.create_task(session.listen_to_stt())

        # Send ready signal
        await websocket.send_json({"type": "ready"})

        # Main message loop
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "audio_chunk":
                # User is speaking - send audio to STT
                audio_base64 = data.get("audio")
                if audio_base64:
                    logger.info(f"📥 Received audio chunk: {len(audio_base64)} bytes")
                    await session.handle_audio_input(audio_base64)

            elif msg_type == "audio_end":
                # User stopped speaking - commit audio for final transcription
                logger.info("🛑 Audio end received, committing...")
                await session.commit_audio()

            elif msg_type == "stop":
                # Client wants to disconnect
                logger.info("Client requested disconnect")
                break

            else:
                logger.warning(f"Unknown message type: {msg_type}")

    except WebSocketDisconnect:
        logger.info("Client disconnected")

    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass

    finally:
        # Cleanup
        if stt_task:
            stt_task.cancel()
            try:
                await stt_task
            except asyncio.CancelledError:
                pass

        if session:
            await session.close()

        try:
            await websocket.close()
        except:
            pass

        logger.info("Voice WebSocket connection closed")