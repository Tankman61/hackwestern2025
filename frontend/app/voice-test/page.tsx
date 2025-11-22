"use client";

import { useState, useRef, useEffect } from "react";
import { Button, Text, Flex, Box, Badge } from "@radix-ui/themes";

export default function VoiceTestPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [agentResponse, setAgentResponse] = useState<string>("");
  const [error, setError] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<string[]>([]);  // Store base64 strings instead
  const isPlayingRef = useRef(false);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Get or create persistent thread_id
  const getThreadId = () => {
    if (typeof window === 'undefined') return `voice-session-${Date.now()}`;
    let threadId = localStorage.getItem('voice_thread_id');
    if (!threadId) {
      threadId = `voice-session-${Date.now()}`;
      localStorage.setItem('voice_thread_id', threadId);
    }
    return threadId;
  };
  const threadIdRef = useRef<string>(getThreadId());

  // Connect to voice WebSocket
  const connect = async () => {
    try {
      const ws = new WebSocket("ws://localhost:8000/ws/voice/agent");

      ws.onopen = () => {
        console.log("✅ Connected to voice WebSocket");

        // Send start message with persistent thread_id
        ws.send(JSON.stringify({
          type: "start",
          thread_id: threadIdRef.current
        }));
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError("WebSocket connection error");
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("Failed to connect:", err);
      setError("Failed to connect to voice service");
    }
  };

  // Handle WebSocket messages
  const handleWebSocketMessage = async (data: any) => {
    console.log("📨 Received:", data);

    switch (data.type) {
      case "ready":
        setIsConnected(true);
        setError("");
        break;

      case "partial_transcript":
        setTranscript(data.text);
        break;

      case "final_transcript":
        setTranscript(data.text);
        break;

      case "agent_thinking":
        setIsThinking(data.is_thinking);
        break;

      case "agent_text":
        setAgentResponse(data.text);
        break;

      case "agent_speaking":
        setIsSpeaking(data.is_speaking);
        // Clear audio queue when agent starts speaking fresh
        if (data.is_speaking) {
          audioQueueRef.current = [];
          if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
          }
          isPlayingRef.current = false;
        }
        break;

      case "agent_audio":
        // Decode and play audio
        await playAudio(data.audio);
        break;

      case "error":
        setError(data.message);
        break;
    }
  };

  // Convert Float32Array to 16-bit PCM
  const floatTo16BitPCM = (float32Array: Float32Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  };

  // Start recording with Web Audio API (raw PCM)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      streamRef.current = stream;

      // Create audio context for processing
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      }

      const source = audioContextRef.current.createMediaStreamSource(stream);

      // Use ScriptProcessorNode to capture raw audio samples
      const bufferSize = 4096;
      const processor = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);

          // Convert Float32 to 16-bit PCM
          const pcmData = floatTo16BitPCM(inputData);

          // Convert to base64
          const base64 = btoa(
            String.fromCharCode(...new Uint8Array(pcmData))
          );

          // Send to backend
          wsRef.current.send(JSON.stringify({
            type: "audio_chunk",
            audio: base64
          }));
        }
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      processorRef.current = processor;
      setIsRecording(true);
      setTranscript("");

      console.log("🎤 Started recording with PCM audio capture");

    } catch (err) {
      console.error("Failed to start recording:", err);
      setError("Microphone access denied");
    }
  };

  // Stop recording
  const stopRecording = () => {
    // Disconnect processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);

    // Send audio_end signal
    wsRef.current?.send(JSON.stringify({
      type: "audio_end"
    }));

    console.log("🛑 Stopped recording");
  };

  // Play audio from base64 using HTMLAudioElement (more reliable for MP3)
  const playAudio = async (base64Audio: string) => {
    try {
      // Add to queue
      audioQueueRef.current.push(base64Audio);

      // Start playing if not already playing
      if (!isPlayingRef.current) {
        playNextAudio();
      }
    } catch (err) {
      console.error("Error queueing audio:", err);
    }
  };

  const playNextAudio = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const base64Audio = audioQueueRef.current.shift()!;

    // Create blob URL from base64
    const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
    const blob = new Blob([audioData], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);

    // Create and play audio element
    const audio = new Audio(url);
    currentAudioRef.current = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudioRef.current = null;
      playNextAudio();
    };

    audio.onerror = (err) => {
      console.error("Audio playback error:", err);
      URL.revokeObjectURL(url);
      currentAudioRef.current = null;
      playNextAudio();
    };

    audio.play().catch(err => {
      console.error("Error playing audio:", err);
      URL.revokeObjectURL(url);
      currentAudioRef.current = null;
      playNextAudio();
    });
  };

  // Disconnect
  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
      wsRef.current.close();
      wsRef.current = null;
    }

    if (isRecording) {
      stopRecording();
    }

    setIsConnected(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen p-8" style={{ background: 'var(--slate-1)' }}>
      <Flex direction="column" gap="6" style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <Box>
          <Text size="8" weight="bold" style={{ color: 'var(--slate-12)' }}>
            🎙️ Voice Agent Test
          </Text>
          <Text size="2" style={{ color: 'var(--slate-11)' }}>
            Test real-time voice communication with Akira
          </Text>
        </Box>

        {/* Connection Status */}
        <Flex align="center" gap="3">
          <Badge color={isConnected ? "green" : "gray"}>
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
          {isThinking && <Badge color="blue">Agent Thinking...</Badge>}
          {isSpeaking && <Badge color="purple">Agent Speaking...</Badge>}
        </Flex>

        {/* Connection Controls */}
        <Flex gap="3">
          {!isConnected ? (
            <Button onClick={connect} size="3" style={{ cursor: 'pointer' }}>
              Connect to Voice Agent
            </Button>
          ) : (
            <>
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                size="3"
                color={isRecording ? "red" : "green"}
                style={{ cursor: 'pointer' }}
                disabled={!isConnected}
              >
                {isRecording ? "🔴 Stop Speaking" : "🎤 Start Speaking"}
              </Button>
              <Button onClick={disconnect} size="3" variant="outline" style={{ cursor: 'pointer' }}>
                Disconnect
              </Button>
            </>
          )}
        </Flex>

        {/* Error Display */}
        {error && (
          <Box p="4" style={{ background: 'var(--red-3)', borderRadius: '8px' }}>
            <Text size="2" style={{ color: 'var(--red-11)' }}>
              ❌ {error}
            </Text>
          </Box>
        )}

        {/* Transcript Display */}
        <Box p="4" style={{ background: 'var(--slate-3)', borderRadius: '8px', minHeight: '100px' }}>
          <Text size="1" weight="bold" style={{ color: 'var(--slate-11)' }}>
            Your Speech:
          </Text>
          <Text size="3" style={{ color: 'var(--slate-12)' }}>
            {transcript || "(speak to see transcription...)"}
          </Text>
        </Box>

        {/* Agent Response Display */}
        <Box p="4" style={{ background: 'var(--slate-3)', borderRadius: '8px', minHeight: '150px' }}>
          <Text size="1" weight="bold" style={{ color: 'var(--slate-11)' }}>
            Akira's Response:
          </Text>
          <Text size="3" style={{ color: 'var(--slate-12)', whiteSpace: 'pre-wrap' }}>
            {agentResponse || "(agent will respond here...)"}
          </Text>
        </Box>

        {/* Instructions */}
        <Box p="4" style={{ background: 'var(--blue-3)', borderRadius: '8px' }}>
          <Text size="2" weight="bold" style={{ color: 'var(--blue-11)' }}>
            💡 Instructions:
          </Text>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li><Text size="2" style={{ color: 'var(--blue-11)' }}>Click "Connect to Voice Agent" to start</Text></li>
            <li><Text size="2" style={{ color: 'var(--blue-11)' }}>Click "Start Speaking" and talk (microphone permission required)</Text></li>
            <li><Text size="2" style={{ color: 'var(--blue-11)' }}>Click "Stop Speaking" when done</Text></li>
            <li><Text size="2" style={{ color: 'var(--blue-11)' }}>Agent will process and respond with voice</Text></li>
            <li><Text size="2" style={{ color: 'var(--blue-11)' }}>Try asking: "What's the BTC price?" or "Check market sentiment"</Text></li>
          </ul>
        </Box>
      </Flex>
    </div>
  );
}