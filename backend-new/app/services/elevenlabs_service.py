"""
ElevenLabs Voice Service
Uses WebSocket API for STT and TTS (SDK v1.12.0 compatible)
"""
import asyncio
import json
import base64
import logging
import os
from typing import Optional, AsyncGenerator
import websockets

logger = logging.getLogger(__name__)


class ElevenLabsSTT:
    """
    Speech-to-Text using ElevenLabs realtime WebSocket API
    """
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.ws_url = "wss://api.elevenlabs.io/v1/speech-to-text/realtime"
        self.websocket = None

    async def connect(self, sample_rate: int = 16000, codec: str = "pcm"):
        """Connect to ElevenLabs STT WebSocket"""
        try:
            # Build URL with query parameters
            url = f"{self.ws_url}?model_id=scribe_v2_realtime&language=en"

            # Connect with API key in header
            self.websocket = await websockets.connect(
                url,
                additional_headers={"xi-api-key": self.api_key}
            )

            logger.info(f"✅ Connected to ElevenLabs STT (sample_rate={sample_rate})")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to connect to ElevenLabs STT: {e}")
            return False

    async def send_audio(self, audio_base64: str, sample_rate: int = 16000, commit: bool = False):
        """Send audio chunk to STT"""
        if not self.websocket:
            raise RuntimeError("STT WebSocket not connected")

        try:
            message = {
                "message_type": "input_audio_chunk",  # Required!
                "audio_base_64": audio_base64,
                "sample_rate": sample_rate,
                "commit": commit
            }

            await self.websocket.send(json.dumps(message))

        except Exception as e:
            logger.error(f"Error sending audio to STT: {e}")
            raise

    async def receive_transcripts(self) -> AsyncGenerator[dict, None]:
        """Receive transcription results"""
        if not self.websocket:
            raise RuntimeError("STT WebSocket not connected")

        try:
            async for message in self.websocket:
                data = json.loads(message)
                logger.info(f"📨 STT received: {data}")

                # Handle different transcript types (ElevenLabs uses "message_type" field)
                msg_type = data.get("message_type")

                if msg_type == "partial_transcript":
                    logger.info(f"🗣️ Partial: {data.get('text', '')}")
                    yield {"type": "partial", "text": data.get("text", "")}

                elif msg_type == "committed_transcript":
                    logger.info(f"✅ Final: {data.get('text', '')}")
                    yield {"type": "final", "text": data.get("text", "")}

                elif msg_type == "input_error":
                    logger.error(f"STT Error: {data}")
                    yield {"type": "error", "message": data.get("error", "Unknown error")}

        except websockets.exceptions.ConnectionClosed:
            logger.info("STT WebSocket closed")
        except Exception as e:
            logger.error(f"STT receive error: {e}")

    async def close(self):
        """Close STT WebSocket"""
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
            logger.info("STT WebSocket closed")


class ElevenLabsTTS:
    """
    Text-to-Speech using ElevenLabs WebSocket API
    """
    def __init__(self, api_key: str, voice_id: str):
        self.api_key = api_key
        self.voice_id = voice_id
        self.websocket = None

    async def connect(
        self,
        model_id: str = "eleven_turbo_v2",
        output_format: str = "mp3_44100_128",
        stability: float = 0.7,
        similarity_boost: float = 0.8,
        style: float = 0.0,  # 0.0 = fast/natural, 1.0 = slow/exaggerated
        speaking_rate: float = 1.3  # 0.25 to 4.0, default 1.0
    ):
        """Connect to ElevenLabs TTS WebSocket"""
        try:
            # Build WebSocket URL with query params
            url = f"wss://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}/stream-input?model_id={model_id}&output_format={output_format}"

            # Connect to WebSocket
            self.websocket = await websockets.connect(url)

            # Send initialization message with API key in JSON (NOT headers!)
            init_message = {
                "text": " ",  # Required space character
                "xi_api_key": self.api_key,  # API key in message body
                "voice_settings": {
                    "stability": stability,
                    "similarity_boost": similarity_boost,
                    "style": style,
                    "use_speaker_boost": True
                },
                "generation_config": {
                    "chunk_length_schedule": [120, 160, 250, 290]  # Smaller chunks for lower latency
                },
                "pronunciation_dictionary_locators": [],
                "model_config": {
                    "speaking_rate": speaking_rate
                }
            }
            await self.websocket.send(json.dumps(init_message))

            logger.info(f"✅ Connected to ElevenLabs TTS (voice={self.voice_id}, model={model_id}, format={output_format}, rate={speaking_rate})")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to connect to ElevenLabs TTS: {e}")
            return False

    async def send_text(self, text: str, flush: bool = False):
        """Send text chunk to TTS"""
        if not self.websocket:
            raise RuntimeError("TTS WebSocket not connected")

        message = {
            "text": text,
            "try_trigger_generation": True,
            "flush": flush
        }

        await self.websocket.send(json.dumps(message))
        logger.debug(f"Sent text to TTS: {text[:50]}...")

    async def finalize(self):
        """Send final message to flush remaining audio"""
        if not self.websocket:
            return

        # Send empty text to signal end
        message = {"text": ""}
        await self.websocket.send(json.dumps(message))
        logger.debug("Finalized TTS stream")

    async def receive_audio(self) -> AsyncGenerator[bytes, None]:
        """Receive audio chunks"""
        if not self.websocket:
            raise RuntimeError("TTS WebSocket not connected")

        try:
            async for message in self.websocket:
                data = json.loads(message)

                # Check for audio chunks
                if "audio" in data:
                    # Decode base64 audio
                    audio_bytes = base64.b64decode(data["audio"])
                    yield audio_bytes

                # Check for final message
                if data.get("isFinal"):
                    logger.info("TTS stream complete")
                    break

        except websockets.exceptions.ConnectionClosed:
            logger.info("TTS WebSocket closed")
        except Exception as e:
            logger.error(f"TTS receive error: {e}")

    async def close(self):
        """Close TTS WebSocket"""
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
            logger.info("TTS WebSocket closed")


class ElevenLabsVoiceService:
    """
    Complete voice service managing both STT and TTS
    """
    def __init__(self):
        self.api_key = os.getenv("ELEVENLABS_API_KEY")
        if not self.api_key:
            logger.warning("⚠️ ELEVENLABS_API_KEY not set - voice features disabled")

        # Get voice ID from environment
        self.voice_id = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")

    def create_stt(self) -> ElevenLabsSTT:
        """Create STT instance"""
        if not self.api_key:
            raise RuntimeError("ElevenLabs API key not configured")
        return ElevenLabsSTT(self.api_key)

    def create_tts(self, voice_id: Optional[str] = None) -> ElevenLabsTTS:
        """Create TTS instance"""
        if not self.api_key:
            raise RuntimeError("ElevenLabs API key not configured")
        return ElevenLabsTTS(self.api_key, voice_id or self.voice_id)


# Global service instance
elevenlabs_service = ElevenLabsVoiceService()