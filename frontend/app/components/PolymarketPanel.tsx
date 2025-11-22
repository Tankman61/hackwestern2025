"use client";

import { Flex, Text } from "@radix-ui/themes";

interface Market {
  question: string;
  probability: number;
  change: string;
  volume: string;
}

interface PolymarketPanelProps {
  markets: Market[];
}

export default function PolymarketPanel({ markets }: PolymarketPanelProps) {
  return (
    <div className="border-r p-3 flex flex-col" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
      <Flex justify="between" align="center" className="mb-2">
        <Text size="1" weight="bold" className="uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
          Prediction Markets
        </Text>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--blue-9)' }}></div>
          <Text size="1" weight="medium" style={{ color: 'var(--blue-11)' }}>POLYMARKET</Text>
        </div>
      </Flex>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
        {markets.map((market, idx) => (
          <div
            key={idx}
            className="p-2 border rounded transition-colors"
            style={{ background: 'var(--slate-3)', borderColor: 'var(--slate-6)' }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--blue-7)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--slate-6)'}
          >
            <Text size="1" className="mb-1 block leading-snug" style={{ color: 'var(--slate-12)' }}>
              {market.question}
            </Text>
            <Flex justify="between" align="center">
              <Flex align="baseline" gap="1">
                <Text size="4" weight="bold" className="font-mono" style={{ color: market.change.startsWith('+') ? 'var(--green-11)' : 'var(--red-10)' }}>
                  {market.probability}%
                </Text>
                <Text size="1" style={{ color: market.change.startsWith('+') ? 'var(--green-11)' : 'var(--red-10)' }}>
                  {market.change}
                </Text>
              </Flex>
              <Text size="1" style={{ color: 'var(--slate-11)' }}>Vol: {market.volume}</Text>
            </Flex>
          </div>
        ))}
      </div>
    </div>
  );
}
