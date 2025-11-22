"use client";

import { Flex, Text } from "@radix-ui/themes";

export default function HistoryTab() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
        <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>
          Trade History
        </Text>
      </div>

      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        <div className="space-y-2">
          <div className="p-2.5 border-l-2 rounded" style={{ background: 'var(--slate-3)', borderColor: 'var(--green-9)' }}>
            <Flex justify="between" align="center" className="mb-1">
              <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>BTC/USD LONG</Text>
              <Text size="1" weight="bold" className="font-mono" style={{ color: 'var(--green-11)' }}>+$2,847</Text>
            </Flex>
            <Flex justify="between" className="mb-0.5">
              <Text size="1" style={{ color: 'var(--slate-11)' }}>Entry: $94,200</Text>
              <Text size="1" style={{ color: 'var(--slate-11)' }}>Exit: $98,900</Text>
            </Flex>
            <Text size="1" style={{ color: 'var(--slate-11)' }}>2 hours ago • 0.6 BTC</Text>
          </div>

          <div className="p-2.5 border-l-2 rounded" style={{ background: 'var(--slate-3)', borderColor: 'var(--red-9)' }}>
            <Flex justify="between" align="center" className="mb-1">
              <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>SOL/USD SHORT</Text>
              <Text size="1" weight="bold" className="font-mono" style={{ color: 'var(--red-10)' }}>-$420</Text>
            </Flex>
            <Flex justify="between" className="mb-0.5">
              <Text size="1" style={{ color: 'var(--slate-11)' }}>Entry: $142</Text>
              <Text size="1" style={{ color: 'var(--slate-11)' }}>Exit: $156</Text>
            </Flex>
            <Text size="1" style={{ color: 'var(--slate-11)' }}>5 hours ago • 30 SOL</Text>
          </div>

          <div className="p-2.5 border-l-2 rounded" style={{ background: 'var(--slate-3)', borderColor: 'var(--green-9)' }}>
            <Flex justify="between" align="center" className="mb-1">
              <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>ETH/USD LONG</Text>
              <Text size="1" weight="bold" className="font-mono" style={{ color: 'var(--green-11)' }}>+$1,240</Text>
            </Flex>
            <Flex justify="between" className="mb-0.5">
              <Text size="1" style={{ color: 'var(--slate-11)' }}>Entry: $3,680</Text>
              <Text size="1" style={{ color: 'var(--slate-11)' }}>Exit: $3,920</Text>
            </Flex>
            <Text size="1" style={{ color: 'var(--slate-11)' }}>1 day ago • 5.2 ETH</Text>
          </div>

          <div className="p-2.5 border-l-2 rounded" style={{ background: 'var(--slate-3)', borderColor: 'var(--green-9)' }}>
            <Flex justify="between" align="center" className="mb-1">
              <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>BTC/USD LONG</Text>
              <Text size="1" weight="bold" className="font-mono" style={{ color: 'var(--green-11)' }}>+$892</Text>
            </Flex>
            <Flex justify="between" className="mb-0.5">
              <Text size="1" style={{ color: 'var(--slate-11)' }}>Entry: $92,100</Text>
              <Text size="1" style={{ color: 'var(--slate-11)' }}>Exit: $93,384</Text>
            </Flex>
            <Text size="1" style={{ color: 'var(--slate-11)' }}>2 days ago • 0.7 BTC</Text>
          </div>
        </div>
      </div>
    </div>
  );
}
