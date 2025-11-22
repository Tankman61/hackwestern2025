"use client";

import { Flex, Text, Badge } from "@radix-ui/themes";

export default function PortfolioTab() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
        <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>
          Portfolio
        </Text>
      </div>

      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {/* Portfolio Summary */}
        <div className="mb-4 p-3 rounded border" style={{ background: 'var(--slate-3)', borderColor: 'var(--slate-6)' }}>
          <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
            Total Portfolio Value
          </Text>
          <Text size="6" weight="bold" className="font-mono" style={{ color: 'var(--slate-12)' }}>
            $142,847.23
          </Text>
          <Flex align="center" gap="1" className="mt-1">
            <Text size="2" className="font-mono" style={{ color: 'var(--green-11)' }}>
              +$8,492.15
            </Text>
            <Text size="1" style={{ color: 'var(--slate-11)' }}>
              (6.32%)
            </Text>
          </Flex>
        </div>

        {/* Open Positions */}
        <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
          Open Positions
        </Text>
        <div className="space-y-2">
          <div className="p-2.5 border rounded" style={{ background: 'var(--slate-3)', borderColor: 'var(--slate-6)' }}>
            <Flex justify="between" align="center" className="mb-1">
              <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>BTC/USD</Text>
              <Badge size="1" style={{ background: 'var(--green-4)', color: 'var(--green-11)' }}>LONG</Badge>
            </Flex>
            <Flex justify="between" className="mb-0.5">
              <Text size="1" style={{ color: 'var(--slate-11)' }}>Size</Text>
              <Text size="1" className="font-mono" style={{ color: 'var(--slate-12)' }}>0.5 BTC</Text>
            </Flex>
            <Flex justify="between" className="mb-0.5">
              <Text size="1" style={{ color: 'var(--slate-11)' }}>Entry</Text>
              <Text size="1" className="font-mono" style={{ color: 'var(--slate-12)' }}>$96,250</Text>
            </Flex>
            <Flex justify="between">
              <Text size="1" style={{ color: 'var(--slate-11)' }}>P&L</Text>
              <Text size="1" weight="bold" className="font-mono" style={{ color: 'var(--green-11)' }}>+$1,246.15</Text>
            </Flex>
          </div>

          <div className="p-2.5 border rounded" style={{ background: 'var(--slate-3)', borderColor: 'var(--slate-6)' }}>
            <Flex justify="between" align="center" className="mb-1">
              <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>ETH/USD</Text>
              <Badge size="1" style={{ background: 'var(--red-4)', color: 'var(--red-10)' }}>SHORT</Badge>
            </Flex>
            <Flex justify="between" className="mb-0.5">
              <Text size="1" style={{ color: 'var(--slate-11)' }}>Size</Text>
              <Text size="1" className="font-mono" style={{ color: 'var(--slate-12)' }}>2.0 ETH</Text>
            </Flex>
            <Flex justify="between" className="mb-0.5">
              <Text size="1" style={{ color: 'var(--slate-11)' }}>Entry</Text>
              <Text size="1" className="font-mono" style={{ color: 'var(--slate-12)' }}>$3,842</Text>
            </Flex>
            <Flex justify="between">
              <Text size="1" style={{ color: 'var(--slate-11)' }}>P&L</Text>
              <Text size="1" weight="bold" className="font-mono" style={{ color: 'var(--red-10)' }}>-$184.50</Text>
            </Flex>
          </div>
        </div>
      </div>
    </div>
  );
}
