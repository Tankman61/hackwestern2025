"use client";

import { Flex, Text, Badge } from "@radix-ui/themes";

export default function RiskMonitorTab() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
        <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>
          Risk Monitor
        </Text>
      </div>

      {/* Risk Level */}
      <div className="px-3 py-4 border-b" style={{ borderColor: 'var(--slate-6)' }}>
        <Text size="1" className="mb-3 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
          Risk Level
        </Text>
        <Flex align="baseline" gap="2" className="mb-2">
          <Text size="8" weight="bold" className="font-mono leading-none" style={{ color: 'var(--red-10)' }}>
            73
          </Text>
          <Text size="2" style={{ color: 'var(--slate-11)' }}>/ 100</Text>
        </Flex>
        <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'var(--slate-6)' }}>
          <div className="h-full w-[73%]" style={{ background: 'var(--red-9)' }}></div>
        </div>
        <div className="mb-2">
          <Badge size="1" style={{ background: 'var(--red-4)', color: 'var(--red-11)', borderColor: 'var(--red-8)' }}>
            High
          </Badge>
        </div>
        <Text size="1" className="leading-relaxed" style={{ color: 'var(--slate-11)' }}>
          Major divergence detected. Prediction markets showing conflicting signals with current price action.
        </Text>
      </div>

      {/* Key Market Data */}
      <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
        <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
          Market Overview
        </Text>
        <div className="space-y-2">
          <Flex justify="between">
            <Text size="1" style={{ color: 'var(--slate-11)' }}>24h Volume</Text>
            <Text size="1" weight="bold" className="font-mono" style={{ color: 'var(--slate-12)' }}>$42.1B</Text>
          </Flex>
          <Flex justify="between">
            <Text size="1" style={{ color: 'var(--slate-11)' }}>24h Range</Text>
            <Text size="1" className="font-mono" style={{ color: 'var(--slate-12)' }}>$97.8k - $99.2k</Text>
          </Flex>
        </div>
      </div>

      {/* Technical Indicators */}
      <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
        <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
          Technical
        </Text>
        <div className="space-y-2">
          <Flex justify="between">
            <Text size="1" style={{ color: 'var(--slate-11)' }}>RSI (14)</Text>
            <Text size="1" className="font-mono" style={{ color: 'var(--red-10)' }}>67.8</Text>
          </Flex>
          <Flex justify="between">
            <Text size="1" style={{ color: 'var(--slate-11)' }}>MACD</Text>
            <Text size="1" className="font-mono" style={{ color: 'var(--green-11)' }}>+245</Text>
          </Flex>
        </div>
      </div>

      {/* Watchlist */}
      <div className="px-3 py-3 flex-1">
        <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
          Watchlist
        </Text>
        <div className="space-y-1.5">
          <Flex justify="between" className="py-1.5 border-b" style={{ borderColor: 'var(--slate-6)' }}>
            <Text size="1" style={{ color: 'var(--slate-12)' }}>ETH/USD</Text>
            <Text size="1" className="font-mono" style={{ color: 'var(--green-11)' }}>+2.4%</Text>
          </Flex>
          <Flex justify="between" className="py-1.5 border-b" style={{ borderColor: 'var(--slate-6)' }}>
            <Text size="1" style={{ color: 'var(--slate-12)' }}>SOL/USD</Text>
            <Text size="1" className="font-mono" style={{ color: 'var(--red-10)' }}>-1.2%</Text>
          </Flex>
          <Flex justify="between" className="py-1.5 border-b" style={{ borderColor: 'var(--slate-6)' }}>
            <Text size="1" style={{ color: 'var(--slate-12)' }}>AVAX/USD</Text>
            <Text size="1" className="font-mono" style={{ color: 'var(--green-11)' }}>+5.8%</Text>
          </Flex>
          <Flex justify="between" className="py-1.5">
            <Text size="1" style={{ color: 'var(--slate-12)' }}>MATIC/USD</Text>
            <Text size="1" className="font-mono" style={{ color: 'var(--red-10)' }}>-0.8%</Text>
          </Flex>
        </div>
      </div>
    </div>
  );
}
