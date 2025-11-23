"use client";
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

export default function LandingVRMViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef<boolean>(false);

  useEffect(() => {
    // Prevent duplicate initialization
    if (initializedRef.current) {
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

      initializedRef.current = true;

      // Fullscreen scene for landing page
      scene = new THREE.Scene();
      scene.background = null; // Transparent background

      // Fullscreen camera - copy from VRMViewerCompact camera orientation
      camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      // Copy the same camera position and lookAt from VRMViewerCompact
      camera.position.set(0.0, 0.9, 1.0);
      camera.lookAt(0, 0.9, 0);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      container.appendChild(renderer.domElement);

      // Enhanced lighting - copy from VRMViewerCompact
      const ambient = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambient);

      const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
      mainLight.position.set(1, 2, 2);
      mainLight.castShadow = true;
      scene.add(mainLight);

      const fillLight = new THREE.DirectionalLight(0xaaccff, 0.4);
      fillLight.position.set(-1, 0.5, 1);
      scene.add(fillLight);

      const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
      rimLight.position.set(0, 1, -2);
      scene.add(rimLight);

      try {
        const loader = new GLTFLoader();
        loader.register((parser: any) => {
          return new VRMLoaderPlugin(parser);
        });

        // Load horse girl specifically for landing page
        const url = "/horse_girl.vrm";
        loader.load(
          url,
          (gltf) => {
            const vrm = gltf.userData.vrm;
            if (!vrm) {
              console.error("VRM data not found in loaded model");
              return;
            }

            // Copy VRM setup from VRMViewerCompact
            VRMUtils.rotateVRM0(vrm);
            vrm.scene.position.set(0, 0, 0);
            scene.add(vrm.scene);

            console.log('✅ Landing page VRM model loaded');
          },
          undefined,
          (error) => {
            console.error("Failed to load landing page VRM model:", error);
          }
        );
      } catch (error) {
        console.error("Error loading landing page VRM:", error);
      }

      function onResize() {
        if (!mounted) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }

      window.addEventListener("resize", onResize);

      function animate() {
        if (!mounted) return;

        const dt = clock.getDelta();

        renderer.render(scene, camera);
        rafId = requestAnimationFrame(animate);
      }
      animate();

      // cleanup
      return () => {
        mounted = false;
        window.removeEventListener("resize", onResize);

        if (rafId !== null) {
          cancelAnimationFrame(rafId);
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
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none" // Don't interfere with UI interactions
      }}
    />
  );
}
