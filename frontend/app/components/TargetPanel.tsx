"use client";

import { Flex, Text } from "@radix-ui/themes";
import { useState } from "react";

interface TargetPanelProps {
  issues?: number;
}

export default function TargetPanel({ issues = 7 }: TargetPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className="p-3 flex flex-col cursor-pointer relative rounded-lg overflow-hidden"
      style={{ 
        background: 'linear-gradient(to bottom, rgba(239, 68, 68, 0.3), rgba(185, 28, 28, 0.5))',
        border: '1px solid var(--slate-6)',
        minHeight: '200px'
      }}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Issues Badge */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2 py-1 rounded-full" style={{ background: 'rgba(185, 28, 28, 0.9)' }}>
        <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.4)' }}>
          <Text size="1" weight="bold" style={{ color: 'white', fontSize: '0.75rem' }}>N</Text>
        </div>
        <Text size="1" weight="medium" style={{ color: 'white', fontSize: '0.75rem' }}>{issues} Issues</Text>
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Handle dismiss
          }}
          className="ml-1 flex items-center justify-center"
          style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer', width: '16px', height: '16px' }}
        >
          <Text size="1" style={{ fontSize: '0.875rem', lineHeight: '1' }}>×</Text>
        </button>
      </div>

      {/* Target Visualization */}
      <div className="flex-1 flex items-center justify-center relative">
        <svg width="120" height="120" viewBox="0 0 120 120" className="relative">
          {/* Outer ring */}
          <circle cx="60" cy="60" r="55" fill="none" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="2" />
          {/* Middle ring */}
          <circle cx="60" cy="60" r="40" fill="none" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="2" />
          {/* Inner ring */}
          <circle cx="60" cy="60" r="25" fill="none" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="2" />
          {/* Center circle */}
          <circle cx="60" cy="60" r="10" fill="#fbbf24" stroke="white" strokeWidth="2" />
          
          {/* Dart */}
          <g transform="translate(60, 60) rotate(25)">
            <line x1="0" y1="0" x2="35" y2="-35" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
            <polygon points="35,-35 38,-32 35,-29 32,-32" fill="#3b82f6" />
            <polygon points="0,0 -2,2 0,4 2,2" fill="white" />
          </g>
        </svg>
      </div>

      {/* Status indicator */}
      <div className="absolute bottom-3 right-3">
        <div className="w-3 h-3 rounded-full" style={{ background: 'var(--green-9)', border: '1px solid rgba(0, 0, 0, 0.2)' }}></div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}>
          <Text size="1" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
            Click to view details →
          </Text>
        </div>
      )}
    </div>
  );
}

