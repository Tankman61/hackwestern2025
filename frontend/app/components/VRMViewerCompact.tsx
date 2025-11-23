"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { retargetAnimation } from 'vrm-mixamo-retarget';
import { useWawa } from '../../hooks/useWawa';

// Singleton removed - only one VRMViewerCompact instance in the app now

interface VRMViewerCompactProps {
  onSceneClick?: () => void;
  modelPath?: string;
  viewMode?: 'dashboard' | 'landing';
  cameraOffset?: { x?: number; y?: number; z?: number };
  isGltf?: boolean;
}

export default function VRMViewerCompact({ onSceneClick, modelPath = "/horse_girl.vrm", viewMode = 'dashboard', cameraOffset, isGltf = false }: VRMViewerCompactProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const vrmRef = useRef<any>(null);
  const mixerRef = useRef<THREE.AnimationMixer>();
  const cubeRef = useRef<THREE.Mesh>();
  const clockRef = useRef<THREE.Clock>();

  // Animation state management
  const animationChainTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentChainIndexRef = useRef<number>(0);
  const currentChainRef = useRef<Array<{ name: string; path: string; emoji: string }>>([]);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const initializedRef = useRef<boolean>(false);
  const [currentCategory, setCurrentCategory] = useState<string | null>(null);
  const [testMode, setTestMode] = useState<'animation' | 'elevenlabs'>('animation');
  const [ttsText, setTtsText] = useState<string>('Hello! This is a test of ElevenLabs text-to-speech with lip sync.');
  const [isPlayingTts, setIsPlayingTts] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Blinking animation state
  const blinkStartTimeRef = useRef<number>(0);
  const isBlinkingRef = useRef<boolean>(false);

  // Animation monitoring for all characters
  const animationMonitorRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize lip sync hook
  useWawa({ vrm: vrmRef.current, audioElem: audioRef.current } as any);

  // Create a basic breathing animation as ultimate fallback
  const createBreathingAnimation = useCallback(() => {
    if (!vrmRef.current || !mixerRef.current) return null;

    try {
      // Create a simple breathing animation by scaling the chest/hips slightly
      const vrm = vrmRef.current;
      const mixer = mixerRef.current;

      // Create a simple keyframe animation for breathing
      const breathingClip = new THREE.AnimationClip('breathing', 2, [
        new THREE.VectorKeyframeTrack('.scale', [0, 1, 2], [1, 1, 1, 1.02, 1.02, 1.02, 1, 1, 1])
      ]);

      const breathingAction = mixer.clipAction(breathingClip);
      breathingAction.setLoop(THREE.LoopRepeat, Infinity);
      breathingAction.enabled = true;
      breathingAction.setEffectiveTimeScale(0.5); // Slow breathing
      breathingAction.setEffectiveWeight(0.1); // Very subtle

      console.log('💨 Created breathing fallback animation');
      return breathingAction;
    } catch (error) {
      console.error('Failed to create breathing animation:', error);
      return null;
    }
  }, []);

  // Monitor animation status for all characters
  useEffect(() => {
    const checkAnimationStatus = () => {
      if (!vrmRef.current || !mixerRef.current) return;

      const hasActiveAnimation = currentActionRef.current && currentActionRef.current.isRunning();
      const timeSinceInit = Date.now() - (initializedRef.current ? 0 : Date.now());

      // If no animation is running and we've been initialized for more than 5 seconds
      if (!hasActiveAnimation && timeSinceInit > 5000 && viewMode === 'dashboard') {
        console.log('🤖 Character detected as T-posing, forcing animation restart...');

        // Try to restart animation chain first
        if (!playAnimationChain(getIdleAnimations())) {
          // If that fails, try breathing animation as last resort
          setTimeout(() => {
            if (!currentActionRef.current || !currentActionRef.current.isRunning()) {
              console.log('🤖 Using breathing animation as final fallback');
              const breathingAction = createBreathingAnimation();
              if (breathingAction) {
                // Stop any existing actions first
                mixerRef.current?.stopAllAction();
                breathingAction.reset();
                breathingAction.play();
                currentActionRef.current = breathingAction;
              }
            }
          }, 2000);
        }
      }
    };

    // Check every 8 seconds for any T-posing
    animationMonitorRef.current = setInterval(checkAnimationStatus, 8000);

    // Also check immediately after a short delay
    const initialCheck = setTimeout(checkAnimationStatus, 3000);

    return () => {
      clearTimeout(initialCheck);
      if (animationMonitorRef.current) {
        clearInterval(animationMonitorRef.current);
        animationMonitorRef.current = null;
      }
    };
  }, [modelPath, viewMode, createBreathingAnimation]);

  // Blinking function using sine wave
  const updateBlinking = useCallback(() => {
    if (!vrmRef.current || viewMode !== 'landing') return;

    const now = Date.now();
    const timeSinceBlinkStart = now - blinkStartTimeRef.current;

    // Blink every 2-4 seconds randomly (more frequent for testing)
    if (!isBlinkingRef.current && Math.random() < 0.008) {
      isBlinkingRef.current = true;
      blinkStartTimeRef.current = now;
      console.log('👁️ Starting blink animation');
    }

    if (isBlinkingRef.current) {
      // Blink duration: 200ms (longer for visibility)
      const blinkDuration = 200;
      const progress = Math.min(timeSinceBlinkStart / blinkDuration, 1);

      // Sine wave for smooth blink: sin(π * progress) creates smooth open->close->open
      const blinkValue = Math.sin(Math.PI * progress);

      console.log('👁️ Blink progress:', progress.toFixed(2), 'value:', blinkValue.toFixed(2));

      // Apply blink to eye morph targets (common VRM blend shapes)
      const blinkTargets = ['Blink', 'Blink_L', 'Blink_R', 'EyeBlink', 'eyeBlink'];

      let foundTarget = false;
      blinkTargets.forEach(targetName => {
        if (vrmRef.current?.expressionManager) {
          try {
            // Check if the blend shape exists
            const preset = vrmRef.current.expressionManager.getPreset(targetName as any);
            if (preset) {
              vrmRef.current.expressionManager.setValue(targetName, blinkValue * 1.5); // Amplify for visibility
              foundTarget = true;
              console.log('👁️ Applied blink to:', targetName, 'value:', (blinkValue * 1.5).toFixed(2));
            }
          } catch (e) {
            // Blend shape doesn't exist, skip
            console.log('👁️ Blend shape not found:', targetName);
          }
        }
      });

      if (!foundTarget) {
        console.log('👁️ No blink blend shapes found in VRM model');
      }

      // End blink
      if (progress >= 1) {
        isBlinkingRef.current = false;
        console.log('👁️ Blink animation completed');
        // Reset to open eyes
        blinkTargets.forEach(targetName => {
          if (vrmRef.current?.expressionManager) {
            try {
              vrmRef.current.expressionManager.setValue(targetName, 0);
            } catch (e) {
              // Blend shape doesn't exist, skip
            }
          }
        });
      }
    }
  }, [viewMode]);

  // Animation categories
  const animationCategories = {
    idle: [
      { name: "Happy Idle", path: "/animations/idle/Happy Idle.fbx", emoji: "😊" },
      { name: "Old Man Idle", path: "/animations/idle/Old Man Idle.fbx", emoji: "👴" },
      { name: "Nervously Look Around", path: "/animations/idle/Nervously Look Around.fbx", emoji: "👀" },
      { name: "Warrior Idle", path: "/animations/idle/Warrior Idle.fbx", emoji: "⚔️" },
    ],
    regularIdleAdult: [
      { name: "Idle", path: "/animations/regular idle adult/Idle.fbx", emoji: "🧍" },
      { name: "Zombie Idle", path: "/animations/regular idle adult/Zombie Idle.fbx", emoji: "🧟" },
    ],
    happy: [
      { name: "Joyful Jump", path: "/animations/excited/Joyful Jump.fbx", emoji: "🦘" },
      { name: "Standing Clap", path: "/animations/excited/Standing Clap.fbx", emoji: "👏" },
      { name: "Victory Idle", path: "/animations/excited/Victory Idle.fbx", emoji: "✌️" },
    ],
    excited: [
      { name: "Joyful Jump", path: "/animations/excited/Joyful Jump.fbx", emoji: "🦘" },
    ],
    dance: [
      { name: "Hip Hop Dancing", path: "/animations/dance/Hip Hop Dancing.fbx", emoji: "💃" },
    ],
    angry: [
      { name: "Angry", path: "/animations/angry/Angry.fbx", emoji: "😠" },
    ],
    sad: [
      { name: "Sad Idle", path: "/animations/sad/Sad Idle.fbx", emoji: "😢" },
    ]
  };

  // Helper function to get appropriate idle animations based on model
  const getIdleAnimations = () => {
    // GLTF models don't support retargeted animations
    if (isGltf) {
      console.log('⚠️ Skipping animations for GLTF model');
      return [];
    }

    const isHorseGirl = modelPath.includes('horse_girl');
    if (isHorseGirl) {
      // Horse girl uses original idle animation chain, but add fallback
      console.log('🎬 Using original idle animations for Horse Girl with fallback');
      const horseAnimations = animationCategories.idle;
      const fallbackAnimations = animationCategories.regularIdleAdult;

      // Try horse animations first, then fallback to regular if they fail
      return [...horseAnimations, ...fallbackAnimations];
    } else {
      // All other VRM models use regular idle adult animations, with extra fallbacks
      console.log('🎬 Using regular idle adult animations for:', modelPath);
      const regularAnimations = animationCategories.regularIdleAdult;
      // Add some variety by including a couple more animation types as backup
      const backupAnimations = [
        animationCategories.happy[0], // Joyful Jump
        animationCategories.excited[0] // Victory Idle
      ].filter(Boolean);

      return [...regularAnimations, ...backupAnimations];
    }
  };

  // Callable animation state functions - exposed via ref
  const animationStateRef = useRef<{
    playIdle: () => void;
    playHappy: () => void;
    playAngry: () => void;
    playExcited: () => void;
    playDance: () => void;
    playSad: () => void;
  } | null>(null);

  // Set up callable functions - these can be called from outside the component
  useEffect(() => {
    animationStateRef.current = {
      playIdle: () => {
        console.log('🎬 Calling playIdle - cycling through idle animations');
        setCurrentCategory(null); // Reset to default idle cycling
      },
      playHappy: () => {
        console.log('🎬 Calling playHappy - cycling through happy animations');
        setCurrentCategory('happy');
      },
      playAngry: () => {
        console.log('🎬 Calling playAngry - playing single angry animation');
        setCurrentCategory('angry');
      },
      playExcited: () => {
        console.log('🎬 Calling playExcited - playing single excited animation');
        setCurrentCategory('excited');
      },
      playDance: () => {
        console.log('🎬 Calling playDance - playing single dance animation');
        setCurrentCategory('dance');
      },
      playSad: () => {
        console.log('🎬 Calling playSad - playing single sad animation');
        setCurrentCategory('sad');
      },
    };
  }, []);

  // Expose animation state functions globally for external calls
  useEffect(() => {
    if (typeof window !== 'undefined' && animationStateRef.current) {
      (window as any).vrmAnimationState = animationStateRef.current;
    }
  }, []);

  // Load landing animation (hip hop dance)
  const loadLandingAnimation = (vrm: any, mixer: THREE.AnimationMixer) => {
    try {
      const fbxLoader = new FBXLoader();

      fbxLoader.load(
        '/animations/landing/Hip Hop Dancing.fbx',
        (fbx: any) => {
          try {
            // Suppress console warnings from retargeting library about missing bones
            const originalWarn = console.warn;
            console.warn = (...args: any[]) => {
              // Filter out retargeting warnings about missing bones (they're harmless)
              const message = args[0]?.toString() || '';
              if (!message.includes('VRM bone') && !message.includes('Mixamo bone') && !message.includes('humanoid')) {
                originalWarn.apply(console, args);
              }
            };

            const retargetedClip = retargetAnimation(fbx, vrm);

            // Restore console.warn
            console.warn = originalWarn;

            if (retargetedClip) {
              // Create and play animation action
              const action = mixer.clipAction(retargetedClip);
              action.setLoop(THREE.LoopRepeat, Infinity);
              action.play();

              console.log('✅ Landing hip hop animation loaded and playing');
            } else {
              console.warn('⚠️ Could not retarget landing animation');
            }
          } catch (error) {
            console.error('Error processing landing animation:', error);
          }
        },
        (progress: any) => {
          console.log('Landing animation loading progress:', progress);
        },
        (error: any) => {
          console.error('Error loading landing hip hop animation:', error);
        }
      );
    } catch (error) {
      console.error('Error in loadLandingAnimation:', error);
    }
  };

  // Animation chaining system - plays animations in sequence with smooth crossfades
  const playAnimationChain = (animations: Array<{ name: string; path: string; emoji: string }>) => {
    console.log('🎬 playAnimationChain called with', animations.length, 'animations');
    console.log('VRM ready:', !!vrmRef.current, 'Mixer ready:', !!mixerRef.current);

    if (!vrmRef.current || !mixerRef.current || animations.length === 0) {
      console.warn('⚠️ Cannot play animation chain: VRM/mixer not ready or no animations');

      // Special fallback for Horse Girl if no animations available
      const isHorseGirl = modelPath.includes('horse_girl');
      if (isHorseGirl && vrmRef.current && mixerRef.current) {
        console.log('🐴 Horse Girl fallback: attempting to create basic idle pose');
        // Try to create a simple T-pose breaking animation
        setTimeout(() => {
          if (vrmRef.current && mixerRef.current && !currentActionRef.current) {
            console.log('🐴 Horse Girl: forcing basic animation as last resort');
            // Force start animations again with a delay
            setTimeout(() => playAnimationChain(getIdleAnimations()), 1000);
          }
        }, 1000);
      }
      return;
    }

    // Clear any existing chain
    if (animationChainTimeoutRef.current) {
      clearTimeout(animationChainTimeoutRef.current);
      animationChainTimeoutRef.current = null;
    }

    // Stop any current actions
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
    }
    currentActionRef.current = null;

    currentChainRef.current = animations;
    currentChainIndexRef.current = 0;

    const playNextInChain = () => {
      if (!vrmRef.current || !mixerRef.current || currentChainRef.current.length === 0) return;

      const animation = currentChainRef.current[currentChainIndexRef.current % currentChainRef.current.length];
      currentChainIndexRef.current++;

      const loader = new FBXLoader();
      console.log('📂 Loading animation from:', animation.path);
      console.log('Animation name:', animation.name);
      loader.load(
        animation.path,
        (fbx: any) => {
          console.log('✅ FBX animation loaded successfully:', animation.path);
          const vrm = vrmRef.current;
          const mixer = mixerRef.current;
          if (!vrm || !mixer) {
            console.warn('⚠️ VRM or mixer not available when FBX loaded');
            return;
          }

          let clipToPlay: THREE.AnimationClip | null = null;

          try {
            // Suppress console warnings from retargeting library about missing bones
            const originalWarn = console.warn;
            console.warn = (...args: any[]) => {
              // Filter out retargeting warnings about missing bones (they're harmless)
              const message = args[0]?.toString() || '';
              if (!message.includes('VRM bone') && !message.includes('Mixamo bone') && !message.includes('humanoid')) {
                originalWarn.apply(console, args);
              }
            };

            const retargetedClip = retargetAnimation(fbx, vrm);

            // Restore console.warn
            console.warn = originalWarn;

            if (retargetedClip) {
              clipToPlay = retargetedClip;
            }
          } catch (error) {
            // Restore console.warn in case of error
            console.warn = console.warn || (() => {});
            // Fallback to original
          }

          if (!clipToPlay && fbx.animations && fbx.animations.length > 0) {
            clipToPlay = fbx.animations[0];
          }

            if (clipToPlay) {
              console.log('✅ Animation clip ready:', {
                name: clipToPlay.name,
                duration: clipToPlay.duration,
                tracks: clipToPlay.tracks.length
              });

              // Create action on the VRM scene explicitly
              const newAction = mixer.clipAction(clipToPlay, vrm.scene);
              console.log('🎬 Created animation action, playing now...');

            // Smooth crossfade: fade out old, fade in new
            if (currentActionRef.current) {
              // Fade out current action over 1 second
              currentActionRef.current.fadeOut(1.0);
            }

            // Set up new action - ensure it plays immediately
            newAction.reset();
            newAction.setLoop(THREE.LoopRepeat, Infinity);
            newAction.enabled = true;
            newAction.setEffectiveTimeScale(1.0);
            newAction.setEffectiveWeight(1.0);

            // Start playing - order matters: set weight before play
            newAction.play();

            // Force mixer update to ensure action is activated
            mixer.update(0);

            // Update current action reference immediately
            currentActionRef.current = newAction;

            console.log('🎬 Playing:', animation.name, {
              duration: clipToPlay.duration,
              tracks: clipToPlay.tracks.length
            });

            // Update current action reference
            currentActionRef.current = newAction;

            console.log('🎬 Playing:', animation.name);

            // Schedule next animation in chain
            // Wait for fade-in to complete (1s) + play duration + fade-out start (1s before end)
            const animationDuration = clipToPlay.duration || 3;
            const playDuration = Math.max(animationDuration * 2, 6); // Play for 2x duration or at least 6 seconds
            const chainDelay = (playDuration - 1.0) * 1000; // Start fade-out 1 second before switching

            animationChainTimeoutRef.current = setTimeout(() => {
              playNextInChain(); // Chain to next animation
            }, chainDelay);
          }
        },
        undefined,
        (error: any) => {
          console.error('Failed to load animation:', animation.name, error);
          const isHorseGirl = modelPath.includes('horse_girl');
          if (isHorseGirl) {
            console.log('🐴 Horse Girl animation failed, trying fallback...');
          } else {
            console.log('🤖 General animation failed, trying next in chain...');
          }

          // Count consecutive failures to detect if all animations are broken
          if (!currentChainRef.current) return;

          const currentIndex = currentChainIndexRef.current % currentChainRef.current.length;
          const failureCount = (currentChainIndexRef.current - currentIndex) / currentChainRef.current.length;

          if (failureCount > 2) {
            console.warn('⚠️ Multiple animation failures detected, switching to emergency fallback');
            // Force immediate breathing animation as emergency fallback
            setTimeout(() => {
              if (!currentActionRef.current || !currentActionRef.current.isRunning()) {
                const breathingAction = createBreathingAnimation();
                if (breathingAction) {
                  mixerRef.current?.stopAllAction();
                  breathingAction.reset();
                  breathingAction.play();
                  currentActionRef.current = breathingAction;
                }
              }
            }, 500);
            return;
          }

          // Try next animation after a delay
          animationChainTimeoutRef.current = setTimeout(() => {
            playNextInChain();
          }, 1500); // Even faster fallback
        }
      );
    };

    // Start the chain
    playNextInChain();
  };

  useEffect(() => {
    console.log('🎭 VRMViewerCompact mounting/remounting for viewMode:', viewMode, 'modelPath:', modelPath, 'mount count:', Date.now());

    // Always reset animation state on mount to ensure clean slate
    console.log('🔄 Resetting animation state for fresh mount');
    initializedRef.current = false;
    if (animationChainTimeoutRef.current) {
      clearTimeout(animationChainTimeoutRef.current);
      animationChainTimeoutRef.current = null;
    }
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
    }
    currentActionRef.current = null;
    currentChainRef.current = [];
    currentChainIndexRef.current = 0;
    setCurrentCategory(null);

    // Clear any existing DOM content
    if (containerRef.current) {
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }
    }

    // Prevent duplicate initialization within this component instance
    if (initializedRef.current) {
      console.warn('⚠️ VRMViewerCompact already initialized for this instance, skipping...');
      return;
    }


    let mounted = true;
    let renderer: THREE.WebGLRenderer;
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let rafId: number | null = null;
    const clock = new THREE.Clock();

    async function init() {
      const container = containerRef.current;
      if (!container) return;

      // Clear any existing content from container before initializing
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }

      initializedRef.current = true;

    // Track the model that was loaded
    if (containerRef.current) {
      (containerRef.current as any).dataset.lastModel = modelPath;
    }

    // Add a fallback animation starter that triggers after VRM loads
    const fallbackAnimationStarter = () => {
      if (vrmRef.current && mixerRef.current && currentChainRef.current.length === 0) {
        console.log('🎬 Fallback: Starting idle animations as backup');
        playAnimationChain(getIdleAnimations());
      }
    };

    // Set up the fallback to trigger after a delay
    fallbackTimeoutRef.current = setTimeout(fallbackAnimationStarter, 1000);

      scene = new THREE.Scene();
      scene.background = null; // Transparent background

      // Different setup based on view mode
      if (viewMode === 'landing') {
        // Get container dimensions for proper sizing
        const containerWidth = container.clientWidth || window.innerWidth;
        const containerHeight = container.clientHeight || window.innerHeight;

        camera = new THREE.PerspectiveCamera(
          45,
          containerWidth / containerHeight,
          0.1,
          1000
        );
        // Camera at face level with the model
        const baseCamY = 1;
        const baseCamZ = 0.4;
        camera.position.set(
          cameraOffset?.x || 0.0,
          baseCamY + (cameraOffset?.y || 0),
          baseCamZ + (cameraOffset?.z || 0)
        );

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(containerWidth, containerHeight);
        renderer.domElement.style.background = 'transparent';
        renderer.domElement.style.border = 'none';
        renderer.domElement.style.margin = '0';
        renderer.domElement.style.padding = '0';
        container.appendChild(renderer.domElement);

        // Use horse girl as default for landing page if no specific model provided
        if (viewMode === 'landing' && !modelPath) {
            modelPath = "/horse_girl.vrm";
            console.log('🎭 Landing page: using default horse girl model');
        }
        console.log('🎭 VRMViewerCompact initializing with viewMode:', viewMode, 'modelPath:', modelPath);
      } else {
        // Dashboard setup - now expanded to fill available space
        if (container.clientWidth === 0 || container.clientHeight === 0) {
          container.style.width = '100%';
          container.style.height = '100%';
        }

        camera = new THREE.PerspectiveCamera(
          45,
          container.clientWidth / container.clientHeight || 1,
          0.1,
          1000
        );
        // Adjust camera for larger canvas - pull back slightly and move up for better full-body framing
        const baseCamY = 1;
        const baseCamZ = 1.3;
        camera.position.set(
          cameraOffset?.x || 0.0,
          baseCamY + (cameraOffset?.y || 0),
          baseCamZ + (cameraOffset?.z || 0)
        );

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.domElement.style.background = 'transparent';
        renderer.domElement.style.border = 'none';
        renderer.domElement.style.margin = '0';
        renderer.domElement.style.padding = '0';
        container.appendChild(renderer.domElement);
      }

      // Enhanced lighting for better visibility
      const ambient = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambient);

      // Main directional light (brighter)
      const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
      mainLight.position.set(1, 2, 2);
      mainLight.castShadow = true;
      scene.add(mainLight);

      // Fill light (brighter)
      const fillLight = new THREE.DirectionalLight(0xaaccff, 0.4);
      fillLight.position.set(-1, 0.5, 1);
      scene.add(fillLight);

      // Additional rim light for better visibility
      const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
      rimLight.position.set(0, 1, -2);
      scene.add(rimLight);

      try {
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader");

        const loader = new GLTFLoader();

        // Only register VRM plugin if this is a VRM file
        if (!isGltf) {
          const { VRMLoaderPlugin } = await import("@pixiv/three-vrm");
          loader.register((parser: any) => {
            return new VRMLoaderPlugin(parser);
          });
        }

        const url = modelPath; // Use the modelPath prop
        console.log(isGltf ? '🎭 Loading GLTF model from:' : '🎭 Loading VRM model from:', url);
        loader.load(
          url,
          async (gltf) => {
            console.log('✅ Model loaded successfully from:', url);

            let modelScene;
            let vrmData = null;

            if (isGltf) {
              // Handle plain GLTF files (Obama, Rumi)
              console.log('📦 Processing as GLTF model');
              modelScene = gltf.scene;

              // Create a fake VRM structure for compatibility
              vrmData = {
                scene: modelScene,
                humanoid: null,
                expressionManager: null,
              };
            } else {
              // Handle VRM files
              const { VRMUtils } = await import("@pixiv/three-vrm");
              const vrmModel = gltf.userData.vrm;
              if (!vrmModel) {
                console.error("VRM data not found in loaded model");
                return;
              }

              // Rotate model to face camera
              VRMUtils.rotateVRM0(vrmModel);
              vrmData = vrmModel;
              modelScene = vrmModel.scene;
            }

            // Center the model
            modelScene.position.set(0, 0, 0);
            scene.add(modelScene);
            console.log('Model scene added to scene, children count:', scene.children.length);

            // Store VRM reference (or fake VRM for GLTF)
            vrmRef.current = vrmData;

            // Create animation mixer
            const mixer = new THREE.AnimationMixer(modelScene);
            mixerRef.current = mixer;

            // Auto-look at model position
            if (viewMode !== 'landing') {
              camera.lookAt(0, 1, 0);
            } else {
              // Look up a bit instead of down at the model
              camera.lookAt(0, 1.2, 0);
            }
            console.log('✅ VRM model loaded and added to scene for', viewMode);
            console.log('Camera position:', camera.position);
            console.log('Camera mode:', viewMode === 'landing' ? 'manual control' : 'auto-look at model');

            // Load appropriate animation based on view mode
            if (viewMode === 'landing') {
              // Load hip hop animation for landing page (only for real VRM models)
              if (!isGltf && vrmData.humanoid) {
                loadLandingAnimation(vrmData, mixer);
              } else {
                console.log('⚠️ Skipping landing animation for GLTF model (no humanoid structure)');
              }
            } else {
              // Start idle animation chain with multiple attempts to ensure it always works
              const startAnimations = () => {
                if (vrmRef.current && mixerRef.current) {
                  const isHorseGirl = modelPath.includes('horse_girl');
                  console.log('🎬 Starting idle animations for dashboard view', isHorseGirl ? '(Horse Girl)' : '');
                  playAnimationChain(getIdleAnimations());
                  return true;
                }
                return false;
              };

              // Try immediately
              if (!startAnimations()) {
                // If not ready, try after a short delay
                setTimeout(() => {
                  if (!startAnimations()) {
                    // If still not ready, try one more time with longer delay
                    setTimeout(() => {
                      if (!startAnimations()) {
                        console.error('❌ Failed to start animations after multiple attempts');
                        // Emergency fallback: breathing animation
                        setTimeout(() => {
                          console.log('🚨 Emergency breathing animation fallback');
                          const breathingAction = createBreathingAnimation();
                          if (breathingAction) {
                            mixerRef.current?.stopAllAction();
                            breathingAction.reset();
                            breathingAction.play();
                            currentActionRef.current = breathingAction;
                          }
                        }, 1000);
                      }
                    }, 500);
                  }
                }, 200);
              }
            }
          },
          undefined,
          (error) => {
            console.error("❌ Failed to load VRM model:", url, error);
          }
        );
      } catch (error) {
        console.error("Error loading VRM:", error);
      }

      function onResize() {
        if (!mounted) return;
        if (!container) return;

        // Use container dimensions for both modes since landing page is now scrollable
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }

      window.addEventListener("resize", onResize);

      function animate() {
        if (!mounted) return;

        const dt = clock.getDelta();

        // Camera position is set during initialization - not reset every frame
        // This allows manual camera adjustments in dev tools without being overridden

        // Scroll-based camera control for landing page
        if (viewMode === 'landing' && typeof window !== 'undefined') {
          const scrollProgress = (window as any).landingCameraProgress || 0;
          if (scrollProgress > 0) {
            // Move camera backwards as user scrolls down
            const baseZ = 0.4; // Original Z position
            const maxZ = 2.0; // Maximum Z position when scrolled
            const currentZ = baseZ + (scrollProgress * (maxZ - baseZ));

            // Smoothly interpolate camera position
            camera.position.z += (currentZ - camera.position.z) * 0.1;
          }
        }

        // Update animation mixer FIRST (applies bone rotations)
        if (mixerRef.current) {
          mixerRef.current.update(dt);
        }

        // Update blinking animation (landing page only)
        updateBlinking();

        // Update VRM (physics for hair/clothes and bone updates)
        // This runs AFTER animation to ensure our rotations aren't overridden
        // Only update if this is a real VRM model (not GLTF)
        if (vrmRef.current && typeof vrmRef.current.update === 'function') {
          vrmRef.current.update(dt);
        }

        renderer.render(scene, camera);
        rafId = requestAnimationFrame(animate);
      }
      animate();

      // cleanup
      return () => {
        mounted = false;
        window.removeEventListener("resize", onResize);

        // Clear animation chain
        if (animationChainTimeoutRef.current) {
          clearTimeout(animationChainTimeoutRef.current);
          animationChainTimeoutRef.current = null;
        }

        // Stop all animations
        if (mixerRef.current) {
          mixerRef.current.stopAllAction();
        }

        // Clear refs
        vrmRef.current = null;
        mixerRef.current = null;
        currentActionRef.current = null;
        currentChainRef.current = [];

        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        if (renderer) {
          renderer.dispose();
        }
        if (container) {
          while (container.firstChild) container.removeChild(container.firstChild);
        }
      };
    }

    let asyncCleanup: (() => void) | null = null;
    init().then((maybeCleanup: any) => {
      if (typeof maybeCleanup === "function") asyncCleanup = maybeCleanup;
    });

    return () => {
      console.log('🧹 VRMViewerCompact unmounting cleanup for model:', modelPath);
      // Clear animation chain
      if (animationChainTimeoutRef.current) {
        clearTimeout(animationChainTimeoutRef.current);
        animationChainTimeoutRef.current = null;
      }
      // Clear fallback timeout
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }

      // Stop all animations
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
      }

      // Clear refs
      vrmRef.current = null;
      mixerRef.current = null;
      currentActionRef.current = null;
      currentChainRef.current = [];
      initializedRef.current = false;

      if (asyncCleanup) {
        try {
          asyncCleanup();
        } catch (e) {
          // noop
        }
      } else {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        const container = containerRef.current;
        if (container) {
          while (container.firstChild) container.removeChild(container.firstChild);
        }
      }
    };
  }, [modelPath]);

  // Start idle chain when VRM loads or category is cleared (only for dashboard mode)
  useEffect(() => {
    if (viewMode === 'landing') return; // Don't start idle animations for landing page

    let mounted = true;

    const handleVRMLoaded = () => {
      if (!mounted) return;
      if (vrmRef.current && mixerRef.current && !currentCategory && currentChainRef.current.length === 0) {
        console.log('🎬 Starting idle animation chain from vrm-loaded event');
        playAnimationChain(getIdleAnimations());
      }
    };

    window.addEventListener('vrm-loaded', handleVRMLoaded);

    // Also check if VRM is already loaded (with a small delay to avoid race conditions)
    const checkTimer = setTimeout(() => {
      if (!mounted) return;
      if (vrmRef.current && mixerRef.current && !currentCategory && currentChainRef.current.length === 0) {
        console.log('🎬 Starting idle animation chain from initial check');
        playAnimationChain(getIdleAnimations());
      }
    }, 1000);

    return () => {
      mounted = false;
      clearTimeout(checkTimer);
      window.removeEventListener('vrm-loaded', handleVRMLoaded);
    };
  }, [currentCategory, viewMode]);

  // Load animation chain when category changes (button click or programmatic call) - only for dashboard
  useEffect(() => {
    if (viewMode === 'landing') return; // Don't handle category changes for landing page

    // Wait a bit to ensure VRM and mixer are ready
    const checkAndPlay = () => {
      if (currentCategory === null && vrmRef.current && mixerRef.current) {
        // Default to idle cycling when category is null
        console.log('🔄 Default idle cycle');
        playAnimationChain(getIdleAnimations());
      } else if (currentCategory && vrmRef.current && mixerRef.current) {
        const categoryAnimations = animationCategories[currentCategory as keyof typeof animationCategories];
        if (categoryAnimations) {
          console.log('🎯 Category changed, starting animation chain for:', currentCategory);
          console.log('🔍 VRM:', !!vrmRef.current, 'Mixer:', !!mixerRef.current);
          playAnimationChain(categoryAnimations);
        }
      } else if (currentCategory) {
        // Retry if VRM/mixer not ready yet
        console.log('⏳ Waiting for VRM/mixer to be ready...');
        setTimeout(checkAndPlay, 200);
      }
    };

    checkAndPlay();
  }, [currentCategory, viewMode]);

  // Handle TTS playback
  const handleTtsTest = async () => {
    if (!ttsText.trim() || isPlayingTts) return;

    setIsPlayingTts(true);

    try {
      // Stop any current animations
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
      }

      // Call TTS API
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ttsText }),
      });

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.audio) {
        throw new Error('No audio data received');
      }

      // Create audio element and play
      // ElevenLabs returns base64 encoded audio (usually MP3)
      const audioBlob = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
      const blob = new Blob([audioBlob], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);

      // Set up event handlers before assigning to ref
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setIsPlayingTts(false);
        audioRef.current = null;
      };

      audio.onerror = (error) => {
        URL.revokeObjectURL(audioUrl);
        console.error('Audio playback error:', error);
        setIsPlayingTts(false);
        audioRef.current = null;
      };

      // Assign to ref so lip sync hook can access it
      audioRef.current = audio;

      // Play audio
      await audio.play();

    } catch (error) {
      console.error('TTS test error:', error);
      setIsPlayingTts(false);
      alert(`TTS Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };


  return (
    <div style={{
      width: "100%",
      height: "100%",
      position: "relative",
      background: "rgba(0,0,0,0)",
      border: "none",
      margin: 0,
      padding: 0,
      outline: "none"
    }}>
      <div
        ref={containerRef}
        onClick={onSceneClick}
        style={{
          width: "100%",
          height: "100%",
          minHeight: "100%",
          overflow: "hidden",
          background: "rgba(0,0,0,0)",
          border: "none",
          margin: 0,
          padding: 0,
          display: "block",
          position: "relative",
          cursor: onSceneClick ? "pointer" : "default",
          outline: "none"
        }}
      />

      {/* ElevenLabs Test Panel */}
      {testMode === 'elevenlabs' && (
        <div style={{
          position: "absolute",
          bottom: "1rem",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          width: "90%",
          maxWidth: "500px",
          padding: "1rem",
          borderRadius: "0.5rem",
          background: "rgba(0,0,0,0.8)",
          border: "1px solid rgba(255,255,255,0.3)",
          backdropFilter: "blur(8px)"
        }}>
          <label style={{ color: "white", fontSize: "0.875rem", fontWeight: "bold" }}>
            Test Text-to-Speech:
          </label>
          <textarea
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value)}
            placeholder="Enter text to convert to speech..."
            style={{
              padding: "0.75rem",
              borderRadius: "0.5rem",
              border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.1)",
              color: "white",
              fontSize: "0.875rem",
              minHeight: "80px",
              resize: "vertical",
              fontFamily: "inherit"
            }}
          />
          <button
            onClick={handleTtsTest}
            disabled={isPlayingTts || !ttsText.trim()}
            style={{
              padding: "0.75rem 1.5rem",
              borderRadius: "0.5rem",
              border: "none",
              background: isPlayingTts ? "rgba(100,100,100,0.5)" : "#4ade80",
              color: "white",
              fontSize: "0.875rem",
              fontWeight: "bold",
              cursor: isPlayingTts || !ttsText.trim() ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              opacity: isPlayingTts || !ttsText.trim() ? 0.6 : 1
            }}
          >
            {isPlayingTts ? "🎤 Playing..." : "▶️ Play TTS"}
          </button>
        </div>
      )}
    </div>
  );
}
