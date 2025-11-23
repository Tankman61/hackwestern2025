"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import VRMViewerCompact from "./VRMViewerCompact";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface LandingPageProps {
  onEnter: () => void;
}

export default function LandingPage({ onEnter }: LandingPageProps) {
  const [isHovering, setIsHovering] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    // Animate title flying off
    gsap.to(titleRef.current, {
      y: -200,
      opacity: 0,
      ease: "power2.out",
      scrollTrigger: {
        trigger: heroRef.current,
        start: "top top",
        end: "bottom top",
        scrub: 1,
      }
    });

    // Animate button flying off
    gsap.to(buttonRef.current, {
      y: -300,
      opacity: 0,
      rotation: 45,
      ease: "power2.out",
      scrollTrigger: {
        trigger: heroRef.current,
        start: "top top",
        end: "bottom top",
        scrub: 1,
      }
    });

    // Camera animation - move backwards
    const cameraAnimation = gsap.to({}, {
      duration: 1,
      ease: "none",
      onUpdate: () => {
        // This will be controlled by the VRMViewerCompact component
        const progress = cameraAnimation.progress();
        // Update global camera state
        if (typeof window !== 'undefined') {
          (window as any).landingCameraProgress = progress;
        }
      },
      scrollTrigger: {
        trigger: heroRef.current,
        start: "top top",
        end: "bottom top",
        scrub: 1,
      }
    });

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  return (
    <div
      className="h-[200vh] bg-gradient-to-br from-pink-100 via-pink-200 to-pink-300 overflow-x-hidden"
      style={{
        background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 25%, #f9a8d4 50%, #f472b6 75%, #ec4899 100%)',
      }}
    >
      {/* Hero Section */}
      <div ref={heroRef} className="relative h-screen flex flex-col items-center justify-center">
        {/* Text Content - Center */}
        <div ref={titleRef} className="z-20 flex flex-col items-center justify-center text-center px-8 mb-16">
          <motion.h1
            className="text-8xl font-bold mb-4 drop-shadow-lg"
            style={{
              color: '#831843',
              textShadow: '0 4px 20px rgba(236, 72, 153, 0.3)',
              fontFamily: 'var(--font-playfair), Georgia, serif',
              fontStyle: 'italic',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            VibeCode
          </motion.h1>

          <motion.p
            className="text-2xl mb-8 max-w-2xl drop-shadow-md"
            style={{
              color: '#9f1239',
              textShadow: '0 2px 10px rgba(236, 72, 153, 0.2)'
            }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            Your AI Trading Companion
          </motion.p>

          <motion.button
            ref={buttonRef}
            onClick={onEnter}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            className="px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300 border-2 shadow-lg"
            style={{
              background: isHovering
                ? 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)'
                : 'rgba(255, 255, 255, 0.2)',
              borderColor: isHovering ? '#be185d' : '#ec4899',
              color: isHovering ? 'white' : '#831843',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
            }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Enter Dashboard
          </motion.button>
        </div>

        {/* 3D Model - Landing Page Horse Girl */}
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ zIndex: 1 }}
        >
          <VRMViewerCompact
            viewMode="landing"
          />
        </motion.div>

        {/* Decorative elements - Pink artsy blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-10 left-10 w-96 h-96 rounded-full blur-3xl opacity-40"
            style={{ background: 'rgba(251, 182, 206, 0.6)' }}
          />
          <div
            className="absolute top-40 right-20 w-80 h-80 rounded-full blur-3xl opacity-30"
            style={{ background: 'rgba(244, 114, 182, 0.5)' }}
          />
          <div
            className="absolute bottom-20 left-1/4 w-72 h-72 rounded-full blur-3xl opacity-35"
            style={{ background: 'rgba(236, 72, 153, 0.4)' }}
          />
          <div
            className="absolute bottom-40 right-1/3 w-64 h-64 rounded-full blur-3xl opacity-30"
            style={{ background: 'rgba(219, 39, 119, 0.5)' }}
          />
          {/* Additional smaller decorative circles */}
          <div
            className="absolute top-1/3 left-1/2 w-48 h-48 rounded-full blur-2xl opacity-25"
            style={{ background: 'rgba(252, 231, 243, 0.6)' }}
          />
          <div
            className="absolute bottom-1/3 right-1/4 w-56 h-56 rounded-full blur-2xl opacity-20"
            style={{ background: 'rgba(251, 207, 232, 0.5)' }}
          />
        </div>
      </div>

      {/* Scrollable Content Sections */}
      <div className="min-h-screen bg-white/10 backdrop-blur-sm py-20 px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold mb-6" style={{ color: '#831843' }}>
              Advanced Trading Intelligence
            </h2>
            <p className="text-xl" style={{ color: '#9f1239' }}>
              Experience the future of trading with our AI-powered companion that learns your patterns
              and provides real-time insights to maximize your portfolio performance.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <motion.div
              className="bg-white/20 backdrop-blur-md rounded-2xl p-8 text-center"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              viewport={{ once: true }}
            >
              <div className="w-16 h-16 bg-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-2xl font-bold mb-4" style={{ color: '#831843' }}>Real-time Analysis</h3>
              <p style={{ color: '#9f1239' }}>Get instant market analysis and trading signals powered by advanced AI algorithms.</p>
            </motion.div>

            <motion.div
              className="bg-white/20 backdrop-blur-md rounded-2xl p-8 text-center"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <div className="w-16 h-16 bg-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl">🤖</span>
              </div>
              <h3 className="text-2xl font-bold mb-4" style={{ color: '#831843' }}>AI Companion</h3>
              <p style={{ color: '#9f1239' }}>Your personal trading assistant that understands your goals and risk tolerance.</p>
            </motion.div>

            <motion.div
              className="bg-white/20 backdrop-blur-md rounded-2xl p-8 text-center"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              viewport={{ once: true }}
            >
              <div className="w-16 h-16 bg-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl">🚀</span>
              </div>
              <h3 className="text-2xl font-bold mb-4" style={{ color: '#831843' }}>Portfolio Optimization</h3>
              <p style={{ color: '#9f1239' }}>Automatically optimize your portfolio based on market conditions and your preferences.</p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Second Section */}
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-rose-100 py-20 px-8">
        <div className="max-w-6xl mx-auto text-center">
          <motion.h2
            className="text-5xl font-bold mb-8"
            style={{
              color: '#7c2d12',
              fontFamily: 'var(--font-playfair), Georgia, serif',
              fontStyle: 'italic'
            }}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            Meet Your Trading Companion
          </motion.h2>
          <motion.p
            className="text-2xl mb-16 max-w-3xl mx-auto"
            style={{ color: '#9f1239' }}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
          >
            Our AI companion adapts to your trading style and provides personalized insights
            to help you make better investment decisions.
          </motion.p>

          <motion.button
            onClick={onEnter}
            className="px-12 py-6 rounded-xl text-xl font-semibold shadow-2xl transform transition-all duration-300 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            viewport={{ once: true }}
          >
            Start Trading Now
          </motion.button>
        </div>
      </div>

      {/* Scrollable Content Section */}
      <div className="min-h-screen bg-white/10 backdrop-blur-sm py-20 px-8 flex items-center">
        <div className="max-w-6xl mx-auto text-center">
          <motion.h2
            className="text-4xl font-bold mb-6"
            style={{ color: '#831843' }}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            Advanced Trading Intelligence
          </motion.h2>
          <motion.p
            className="text-xl mb-8 max-w-3xl mx-auto"
            style={{ color: '#9f1239' }}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
          >
            Experience the future of trading with our AI-powered companion that learns your patterns
            and provides real-time insights to maximize your portfolio performance.
          </motion.p>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              className="bg-white/20 backdrop-blur-md rounded-2xl p-8 text-center"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              viewport={{ once: true }}
            >
              <div className="w-16 h-16 bg-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-2xl font-bold mb-4" style={{ color: '#831843' }}>Real-time Analysis</h3>
              <p style={{ color: '#9f1239' }}>Get instant market analysis and trading signals powered by advanced AI algorithms.</p>
            </motion.div>

            <motion.div
              className="bg-white/20 backdrop-blur-md rounded-2xl p-8 text-center"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <div className="w-16 h-16 bg-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl">🤖</span>
              </div>
              <h3 className="text-2xl font-bold mb-4" style={{ color: '#831843' }}>AI Companion</h3>
              <p style={{ color: '#9f1239' }}>Your personal trading assistant that understands your goals and risk tolerance.</p>
            </motion.div>

            <motion.div
              className="bg-white/20 backdrop-blur-md rounded-2xl p-8 text-center"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              viewport={{ once: true }}
            >
              <div className="w-16 h-16 bg-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl">🚀</span>
              </div>
              <h3 className="text-2xl font-bold mb-4" style={{ color: '#831843' }}>Portfolio Optimization</h3>
              <p style={{ color: '#9f1239' }}>Automatically optimize your portfolio based on market conditions and your preferences.</p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

