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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Enable scrolling on body when landing page is mounted
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'auto';

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
      scrollTrigger: {
        trigger: heroRef.current,
        start: "top top",
        end: "bottom top",
        scrub: 1,
        onUpdate: (self) => {
          // This will be controlled by the VRMViewerCompact component
          const progress = self.progress;
          // Update global camera state
          if (typeof window !== 'undefined') {
            (window as any).landingCameraProgress = progress;
          }
        }
      }
    });

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
      // Restore original overflow when component unmounts
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-screen bg-gradient-to-br from-pink-100 via-pink-200 to-pink-300 z-[9999]"
      style={{
        background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 25%, #f9a8d4 50%, #f472b6 75%, #ec4899 100%)',
      }}
    >
      {/* Hero Section - Full Screen */}
      <div ref={heroRef} className="relative w-full h-screen flex flex-col items-center justify-center">
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
            VibeTrade
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

      {/* Why VibeTrade Section */}
      <div className="min-h-screen bg-white py-20 px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 
              className="text-6xl font-bold mb-8 text-center"
              style={{
                color: '#831843',
                fontFamily: 'var(--font-playfair), Georgia, serif',
                fontStyle: 'italic',
              }}
            >
              Why VibeTrade?
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12 mt-16">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h3 className="text-3xl font-bold mb-4" style={{ color: '#831843' }}>
                AI-Powered Trading Intelligence
              </h3>
              <p className="text-lg leading-relaxed" style={{ color: '#9f1239' }}>
                Experience the future of trading with our AI companion that learns your patterns, 
                understands your risk tolerance, and provides real-time insights to maximize your portfolio performance.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <h3 className="text-3xl font-bold mb-4" style={{ color: '#831843' }}>
                Real-Time Market Analysis
              </h3>
              <p className="text-lg leading-relaxed" style={{ color: '#9f1239' }}>
                Get instant market analysis, sentiment tracking, and trading signals powered by advanced AI algorithms. 
                Stay ahead of the market with predictive insights.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              viewport={{ once: true }}
            >
              <h3 className="text-3xl font-bold mb-4" style={{ color: '#831843' }}>
                Personalized Trading Companion
              </h3>
              <p className="text-lg leading-relaxed" style={{ color: '#9f1239' }}>
                Your AI companion adapts to your trading style and provides personalized insights 
                to help you make better investment decisions tailored to your goals.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              viewport={{ once: true }}
            >
              <h3 className="text-3xl font-bold mb-4" style={{ color: '#831843' }}>
                Risk Management
              </h3>
              <p className="text-lg leading-relaxed" style={{ color: '#9f1239' }}>
                Advanced risk monitoring and portfolio optimization based on market conditions. 
                Protect your capital while maximizing opportunities.
              </p>
            </motion.div>
          </div>

          {/* Feature Images */}
          <div className="grid md:grid-cols-2 gap-8 mt-20">
            <motion.div
              className="flex justify-center"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              viewport={{ once: true }}
            >
              <img
                src="/photo1.png"
                alt="VibeTrader Feature 1"
                className="w-full max-w-2xl rounded-lg shadow-xl"
                style={{ objectFit: 'contain', height: 'auto' }}
              />
            </motion.div>
            <motion.div
              className="flex justify-center"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.0 }}
              viewport={{ once: true }}
            >
              <img
                src="/photo2.png"
                alt="VibeTrader Feature 2"
                className="w-full max-w-2xl rounded-lg shadow-xl"
                style={{ objectFit: 'contain', height: 'auto' }}
              />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Product Features Section */}
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 py-20 px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 
              className="text-6xl font-bold mb-4 text-center"
              style={{
                color: '#831843',
                fontFamily: 'var(--font-playfair), Georgia, serif',
                fontStyle: 'italic',
              }}
            >
              What Makes VibeTrader Different?
            </h2>
            <p className="text-xl mt-6" style={{ color: '#9f1239' }}>
              We don't just show you data—we actively protect your capital with AI-powered risk management
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12 mt-16">
            {/* Feature 1: AI Agent */}
            <motion.div
              className="bg-white rounded-2xl p-8 shadow-lg border-2"
              style={{ borderColor: '#fce7f3' }}
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <div className="text-5xl mb-4"></div>
              <h3 className="text-3xl font-bold mb-4" style={{ color: '#831843' }}>
                Interrupting AI Agent
              </h3>
              <p className="text-lg leading-relaxed" style={{ color: '#9f1239' }}>
                Unlike passive dashboards, our AI agent actively interrupts your session when it detects market anomalies. 
                It doesn't just warn you—it can lock your account to prevent bad trades and guide you through volatile markets 
                with a personality-driven coaching style.
              </p>
            </motion.div>

            {/* Feature 2: Divergence Detection */}
            <motion.div
              className="bg-white rounded-2xl p-8 shadow-lg border-2"
              style={{ borderColor: '#fce7f3' }}
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <div className="text-5xl mb-4"></div>
              <h3 className="text-3xl font-bold mb-4" style={{ color: '#831843' }}>
                Multi-Source Divergence Detection
              </h3>
              <p className="text-lg leading-relaxed" style={{ color: '#9f1239' }}>
                We analyze the correlation between spot prices, prediction market odds, and social sentiment. 
                When these signals diverge (e.g., price goes up but prediction odds collapse), our system flags 
                potential market anomalies before they become obvious to retail traders.
              </p>
            </motion.div>

            {/* Feature 3: Real-time Risk Scoring */}
            <motion.div
              className="bg-white rounded-2xl p-8 shadow-lg border-2"
              style={{ borderColor: '#fce7f3' }}
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              viewport={{ once: true }}
            >
              <div className="text-5xl mb-4"></div>
              <h3 className="text-3xl font-bold mb-4" style={{ color: '#831843' }}>
                Real-Time Risk Scoring
              </h3>
              <p className="text-lg leading-relaxed" style={{ color: '#9f1239' }}>
                Our risk engine calculates a dynamic risk score (0-100) every second by combining sentiment analysis, 
                technical indicators, and prediction market divergence. When risk exceeds 80, the AI agent automatically 
                intervenes to protect your capital.
              </p>
            </motion.div>

            {/* Feature 4: Voice-Powered Trading */}
            <motion.div
              className="bg-white rounded-2xl p-8 shadow-lg border-2"
              style={{ borderColor: '#fce7f3' }}
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="text-5xl mb-4">🎙️</div>
              <h3 className="text-3xl font-bold mb-4" style={{ color: '#831843' }}>
                Voice-Powered Trading Companion
              </h3>
              <p className="text-lg leading-relaxed" style={{ color: '#9f1239' }}>
                Talk to your AI trading coach naturally. Ask questions, get real-time market insights, and execute trades 
                through conversation. Our AI agent uses advanced voice synthesis to provide emotional, context-aware responses 
                that adapt to market conditions.
              </p>
            </motion.div>

            {/* Feature 5: Autonomous Protection */}
            <motion.div
              className="bg-white rounded-2xl p-8 shadow-lg border-2"
              style={{ borderColor: '#fce7f3' }}
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              viewport={{ once: true }}
            >
              <div className="text-5xl mb-4"></div>
              <h3 className="text-3xl font-bold mb-4" style={{ color: '#831843' }}>
                Autonomous Capital Protection
              </h3>
              <p className="text-lg leading-relaxed" style={{ color: '#9f1239' }}>
                During extreme market events, our AI can autonomously execute protective trades and lock your account 
                to prevent panic-driven decisions. It's like having a professional risk manager watching your portfolio 24/7, 
                except this one never sleeps and has zero tolerance for bad trades.
              </p>
            </motion.div>

            {/* Feature 6: Multi-Platform Data Fusion */}
            <motion.div
              className="bg-white rounded-2xl p-8 shadow-lg border-2"
              style={{ borderColor: '#fce7f3' }}
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 1.0 }}
              viewport={{ once: true }}
            >
              <div className="text-5xl mb-4"></div>
              <h3 className="text-3xl font-bold mb-4" style={{ color: '#831843' }}>
                Unified Data Platform
              </h3>
              <p className="text-lg leading-relaxed" style={{ color: '#9f1239' }}>
                We aggregate live data from Polymarket prediction markets, Reddit sentiment analysis, and real-time 
                price feeds—all in one place. No more switching between multiple tabs and platforms. Everything you need 
                to make informed trading decisions is unified and analyzed for you.
              </p>
            </motion.div>
          </div>
        </div>
      </div>

    </div>
  );
}

