"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import VRMViewerCompact from "./VRMViewerCompact";

interface LandingPageProps {
  onEnter: () => void;
}

export default function LandingPage({ onEnter }: LandingPageProps) {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div 
      className="fixed inset-0 flex flex-col items-center justify-center z-50 overflow-hidden"
      style={{ 
        background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 25%, #f9a8d4 50%, #f472b6 75%, #ec4899 100%)',
      }}
    >
      {/* Text Content - Top Center */}
      <div className="absolute top-20 left-0 right-0 z-20 flex flex-col items-center justify-center text-center px-8" style={{ pointerEvents: 'none' }}>
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
            pointerEvents: 'auto',
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
  );
}

