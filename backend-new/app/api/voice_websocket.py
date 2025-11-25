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
from app.services.voice_session_manager import register_session, unregister_session
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
        self.current_tts = None  # Track active TTS connection for immediate interruption
        self.tts_task = None  # Track ongoing TTS task for interruption
        self.is_speaking = False
        self.current_transcript = ""
        self.last_partial_text = ""  # Track latest partial for fallback
        self.turn_id = 0  # Increment per user utterance to avoid duplicate agent runs

    def _sanitize_for_speech(self, text: str) -> str:
        """Strip simple markdown (bold/inline code) that can break TTS pronunciation."""
        if not text:
            return ""
        sanitized = text.replace("**", "")
        sanitized = sanitized.replace("`", "")
        return sanitized

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
                similarity_boost=0.8,
                style=0.0,  # Fast/natural style
                speaking_rate=1.3  # 30% faster than default
            )

            logger.info(f"✅ Voice session started: {self.thread_id}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to start voice session: {e}")
            return False

    async def handle_audio_input(self, audio_base64: str):
        """Handle incoming audio from user"""
        try:
            # INTERRUPT: If agent is speaking, stop immediately
            if self.is_speaking and self.tts_task and not self.tts_task.done():
                logger.info("🛑 User interrupted - cancelling TTS")

                # Close TTS connection IMMEDIATELY to stop audio stream
                if self.current_tts:
                    try:
                        await self.current_tts.close()
                        logger.info("✅ TTS connection closed immediately")
                    except Exception as close_err:
                        logger.warning(f"Error closing TTS: {close_err}")
                    self.current_tts = None

                # Cancel the task
                self.tts_task.cancel()
                try:
                    await self.tts_task
                except asyncio.CancelledError:
                    pass

                self.is_speaking = False

                # Notify frontend speech was interrupted
                await self.send_message({
                    "type": "agent_speaking",
                    "is_speaking": False
                })

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
                    # Restart STT listener task (asyncio already imported at top)
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
                    self.last_partial_text = text
                    await self.send_message({
                        "type": "partial_transcript",
                        "text": text
                    })

                elif transcript_type == "final":
                    # Use last partial as fallback if final is empty
                    if not text and self.last_partial_text:
                        text = self.last_partial_text
                    self.last_partial_text = ""

                    # Send final transcript
                    await self.send_message({
                        "type": "final_transcript",
                        "text": text
                    })

                    # Process with agent
                    if text.strip():
                        self.turn_id += 1
                        await self.process_with_agent(text, turn_id=self.turn_id)

                elif transcript_type == "commit_throttled":
                    # ElevenLabs can throttle commits if <0.3s audio; treat the last partial as final if we have one
                    if self.last_partial_text:
                        fallback_text = self.last_partial_text
                        self.last_partial_text = ""
                        await self.send_message({
                          "type": "final_transcript",
                          "text": fallback_text
                        })
                        self.turn_id += 1
                        await self.process_with_agent(fallback_text, turn_id=self.turn_id)
                    else:
                        logger.warning(f"Commit throttled with no partial text; ignoring. Details: {transcript}")

                elif transcript_type == "error":
                    await self.send_error(transcript.get("message", "STT error"))

        except Exception as e:
            logger.error(f"Error in STT listener: {e}")

    async def process_with_agent(self, user_text: str, turn_id: int):
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
                        else:
                            logger.info(f"Agent emitted tool calls for turn {turn_id}")

            # Send text response to frontend
            safe_text = self._sanitize_for_speech(agent_response_text)
            await self.send_message({
                "type": "agent_text",
                "text": safe_text
            })

            # Convert to speech (track task for interruption)
            if agent_response_text:
                # Cancel any existing TTS for this turn to avoid overlaps
                if self.tts_task and not self.tts_task.done():
                    self.tts_task.cancel()
                    try:
                        await self.tts_task
                    except asyncio.CancelledError:
                        pass

                self.tts_task = asyncio.create_task(self.speak_response(safe_text, turn_id=turn_id))
                try:
                    await self.tts_task
                except asyncio.CancelledError:
                    logger.info("TTS task was cancelled")
                    pass

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

    async def process_system_alert(self, alert_text: str, alert_context: dict):
        """Process a system alert through the agent and speak the response"""
        try:
            logger.info(f"🚨 Processing system alert via agent: {alert_text}")

            await self.send_message({
                "type": "agent_thinking",
                "is_thinking": True
            })

            config = {"configurable": {"thread_id": self.thread_id}}
            messages = []

            # Build comprehensive SYSTEM ALERT context
            risk_score = alert_context.get('risk_score', 0)
            hype_score = alert_context.get('hype_score', 0)
            btc_price = alert_context.get('btc_price', 0)
            price_change = alert_context.get('price_change_24h', 0)

            # Determine if this is BEAR or MOON case
            is_bear = risk_score >= 80 or price_change <= -5.0
            is_moon = hype_score >= 90 or price_change >= 5.0

            context_lines = [
                f"URGENT SYSTEM ALERT:",
                f"Type: {alert_context.get('alert_type', 'ALERT')}",
                f"Risk Score: {risk_score}/100",
                f"Hype Score: {hype_score}/100",
                f"BTC Price: ${btc_price:,.2f}",
                f"24h Change: {price_change:+.2f}%",
                "",
            ]

            if is_bear:
                context_lines.append("🐻 BEAR CASE DETECTED - Price crash/high risk!")
                context_lines.append("According to your EMERGENCY PROTOCOLS, you must:")
                context_lines.append("1. SCREAM about the crash using the alert data")
                context_lines.append("2. Call list_holdings() to check BTC positions")
                context_lines.append("3. Call execute_trade() to SELL 50-80% of BTC")
                context_lines.append("4. Call lock_user_account() to prevent panic buying")
                context_lines.append("5. Explain what you did")
            elif is_moon:
                context_lines.append("🚀 MOON CASE DETECTED - Price pump/high hype!")
                context_lines.append("According to your EMERGENCY PROTOCOLS, you must:")
                context_lines.append("1. SCREAM with EXCITEMENT using the alert data")
                context_lines.append("2. Call list_holdings() to check cash balance")
                context_lines.append("3. Call execute_trade() to BUY with 10-20% of cash")
                context_lines.append("4. DO NOT lock account")
                context_lines.append("5. Explain what you did")
            else:
                context_lines.append("Market alert - assess and respond appropriately")

            context_str = "\n".join(context_lines)

            system_prompt = f"{alert_text}\n\n{context_str}\n\nTake action NOW according to your emergency protocols!"
            messages.append(SystemMessage(content=system_prompt))

            # Instead of asking for acknowledgment, trigger ACTION
            if is_bear:
                messages.append(HumanMessage(content="The market is crashing! Take protective action immediately!"))
            elif is_moon:
                messages.append(HumanMessage(content="Bitcoin is mooning! Catch this momentum NOW!"))
            else:
                messages.append(HumanMessage(content="What's happening with the market?"))

            agent_response_text = ""
            async for event in agent_graph.astream(
                {"messages": messages},
                config=config,
                stream_mode="values"
            ):
                if "messages" in event and event["messages"]:
                    last_msg = event["messages"][-1]
                    if hasattr(last_msg, "content") and last_msg.content:
                        if not hasattr(last_msg, "tool_calls") or not last_msg.tool_calls:
                            agent_response_text = last_msg.content

            if agent_response_text:
                await self.send_message({
                    "type": "agent_text",
                    "text": agent_response_text
                })
                self.tts_task = asyncio.create_task(self.speak_response(agent_response_text, turn_id=-1))
                try:
                    await self.tts_task
                except asyncio.CancelledError:
                    logger.info("TTS task was cancelled")

            await self.send_message({
                "type": "agent_thinking",
                "is_thinking": False
            })

        except Exception as e:
            logger.error(f"Error processing system alert: {e}")
            await self.send_error(f"Agent error: {str(e)}")
            await self.send_message({
                "type": "agent_thinking",
                "is_thinking": False
            })

    async def speak_response(self, text: str, turn_id: int = -1):
        """Convert agent response to speech and stream to frontend"""
        tts = None
        try:
            if turn_id == -1:
                logger.info(f"🔊 Speaking system alert: {text[:50]}...")
            else:
                logger.info(f"🔊 Speaking response (turn {turn_id}): {text[:50]}...")

            # Mark as speaking
            self.is_speaking = True

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
                similarity_boost=0.8,
                style=0.0,  # Fast/natural style
                speaking_rate=1.3  # 30% faster than default
            )

            # Track this TTS connection for immediate interruption
            self.current_tts = tts

            # Send text to TTS
            await tts.send_text(text, flush=False)
            await tts.finalize()

            # Stream audio chunks to frontend
            async for audio_chunk in tts.receive_audio():
                # Check if we were interrupted
                if not self.is_speaking:
                    logger.info("🛑 TTS interrupted, stopping stream")
                    break

                # Encode audio as base64
                audio_base64 = base64.b64encode(audio_chunk).decode("utf-8")

                await self.send_message({
                    "type": "agent_audio",
                    "audio": audio_base64
                })

            # Done speaking
            self.is_speaking = False
            await self.send_message({
                "type": "agent_speaking",
                "is_speaking": False
            })

            logger.info("✅ Finished speaking response")

        except asyncio.CancelledError:
            # Task was cancelled (interrupted)
            logger.info("🛑 TTS task cancelled (interrupted)")
            self.is_speaking = False
            await self.send_message({
                "type": "agent_speaking",
                "is_speaking": False
            })
            raise  # Re-raise to signal cancellation
        except Exception as e:
            logger.error(f"Error in speak_response: {e}")
            self.is_speaking = False
            await self.send_error(f"TTS error: {str(e)}")
            await self.send_message({
                "type": "agent_speaking",
                "is_speaking": False
            })
        finally:
            # Close the TTS connection
            if tts:
                await tts.close()
            self.current_tts = None
            self.is_speaking = False

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

        # Register session for system alerts (single-user MVP)
        register_session(session)

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
        unregister_session(session)
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
