"use client";

import { Flex, Text } from "@radix-ui/themes";

interface TopBarProps {
  currentPrice: string;
  currentTime: string;
}

export default function TopBar({ currentPrice, currentTime }: TopBarProps) {
  return (
    <div className="h-12 border-b flex items-center px-4 justify-between" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
      <Flex align="center" gap="4">
        <Text size="4" weight="bold" className="font-mono" style={{ color: 'var(--slate-12)' }}>
          BTC/USD
        </Text>
        <div className="h-4 w-px" style={{ background: 'var(--slate-6)' }}></div>
        <Text size="1" style={{ color: 'var(--slate-11)' }}>
          BITSTAMP
        </Text>
        <Text size="3" weight="bold" className="font-mono ml-4" style={{ color: 'var(--green-11)' }}>
          {currentPrice}
        </Text>
        <Text size="1" style={{ color: 'var(--green-11)' }}>
          +0.92%
        </Text>
      </Flex>
      <Flex align="center" gap="3">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green-9)' }}></div>
          <Text size="1" className="font-mono" style={{ color: 'var(--slate-11)' }}>
            {currentTime || "00:00:00"} UTC
          </Text>
        </div>
      </Flex>
    </div>
  );
}
