"use client";

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface UseWawaProps {
  vrm?: any;
  audioElem?: HTMLAudioElement | null;
}

export function useWawa({ vrm, audioElem }: UseWawaProps) {
  const analyserRef = useRef<THREE.AudioAnalyser | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  useEffect(() => {
    if (!vrm || !audioElem) return;

    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;

    // Create analyser
    const analyser = new THREE.AudioAnalyser(audioElem, 256);
    analyserRef.current = analyser;

    // Connect audio element to analyser
    try {
      const source = audioContext.createMediaElementSource(audioElem);
      sourceRef.current = source;
      source.connect(audioContext.destination);
    } catch (error) {
      console.warn('Could not create audio source for lip sync:', error);
    }

    const updateLipSync = () => {
      if (!analyser || !vrm) return;

      // Get frequency data
      const data = analyser.getFrequencyData();

      // Calculate average volume (simple approach)
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i];
      }
      const average = sum / data.length;

      // Normalize to 0-1 range
      const volume = Math.min(average / 255, 1);

      // Apply lip sync to VRM mouth blendshapes
      if (vrm.expressionManager) {
        // Try to set mouth open blendshape based on volume
        try {
          vrm.expressionManager.setValue('mouth_open', volume * 0.8);
          vrm.expressionManager.update();
        } catch (error) {
          // Blendshape might not exist, that's okay
          console.debug('Mouth blendshape not available for lip sync');
        }
      }

      // Continue updating while audio is playing
      if (!audioElem.paused && !audioElem.ended) {
        requestAnimationFrame(updateLipSync);
      } else {
        // Reset mouth when audio stops
        if (vrm.expressionManager) {
          try {
            vrm.expressionManager.setValue('mouth_open', 0);
            vrm.expressionManager.update();
          } catch (error) {
            // Ignore
          }
        }
      }
    };

    // Start lip sync when audio plays
    const handlePlay = () => {
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      updateLipSync();
    };

    // Stop lip sync when audio ends
    const handleEnded = () => {
      if (vrm.expressionManager) {
        try {
          vrm.expressionManager.setValue('mouth_open', 0);
          vrm.expressionManager.update();
        } catch (error) {
          // Ignore
        }
      }
    };

    audioElem.addEventListener('play', handlePlay);
    audioElem.addEventListener('ended', handleEnded);

    // Cleanup
    return () => {
      audioElem.removeEventListener('play', handlePlay);
      audioElem.removeEventListener('ended', handleEnded);

      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch (error) {
          // Ignore
        }
      }

      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch (error) {
          // Ignore
        }
      }

      analyserRef.current = null;
      audioContextRef.current = null;
      sourceRef.current = null;
    };
  }, [vrm, audioElem]);
}
