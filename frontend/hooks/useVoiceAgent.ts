"use client";

import { useState, useRef, useEffect } from "react";

interface UseVoiceAgentOptions {
  onTranscript?: (text: string) => void;
  onAgentResponse?: (text: string) => void;
  onError?: (error: string) => void;
}

interface UseVoiceAgentReturn {
  isConnected: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  transcript: string;
  agentResponse: string;
  error: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

export function useVoiceAgent(options: UseVoiceAgentOptions = {}): UseVoiceAgentReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [agentResponse, setAgentResponse] = useState<string>("");
  const [error, setError] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<string[]>([]);
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
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
      const ws = new WebSocket(`${wsUrl}/ws/voice/agent`);

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
        const errorMsg = "WebSocket connection error";
        setError(errorMsg);
        options.onError?.(errorMsg);
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("Failed to connect:", err);
      const errorMsg = "Failed to connect to voice service";
      setError(errorMsg);
      options.onError?.(errorMsg);
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
        options.onTranscript?.(data.text);
        break;

      case "final_transcript":
        setTranscript(data.text);
        options.onTranscript?.(data.text);
        break;

      case "agent_thinking":
        setIsThinking(data.is_thinking);
        break;

      case "agent_text":
        setAgentResponse(data.text);
        options.onAgentResponse?.(data.text);
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
        options.onError?.(data.message);
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
      const errorMsg = "Microphone access denied";
      setError(errorMsg);
      options.onError?.(errorMsg);
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

  return {
    isConnected,
    isRecording,
    isSpeaking,
    isThinking,
    transcript,
    agentResponse,
    error,
    connect,
    disconnect,
    startRecording,
    stopRecording,
  };
}

