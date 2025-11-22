"use client";

import { Flex, Text, Button } from "@radix-ui/themes";

interface TradingTabProps {
  tradeType: "long" | "short";
  setTradeType: (type: "long" | "short") => void;
  positionSize: string;
  setPositionSize: (value: string) => void;
  currentPrice: string;
  stopLoss: string;
  setStopLoss: (value: string) => void;
  takeProfit: string;
  setTakeProfit: (value: string) => void;
}

export default function TradingTab({
  tradeType,
  setTradeType,
  positionSize,
  setPositionSize,
  currentPrice,
  stopLoss,
  setStopLoss,
  takeProfit,
  setTakeProfit
}: TradingTabProps) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-3 py-3 border-b shrink-0" style={{ borderColor: 'var(--slate-6)' }}>
        <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>
          Trading
        </Text>
      </div>

      {/* Trade Type */}
      <div className="p-3 border-b shrink-0" style={{ borderColor: 'var(--slate-6)' }}>
        <Text size="1" className="mb-3 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
          Type
        </Text>
        <Flex gap="3">
          <button
            onClick={() => setTradeType("long")}
            className="flex-1 py-2 rounded font-medium transition-all"
            style={{
              background: tradeType === "long" ? 'var(--green-9)' : 'var(--slate-4)',
              color: tradeType === "long" ? 'white' : 'var(--slate-11)',
              border: tradeType === "long" ? 'none' : '1px solid var(--slate-6)'
            }}
          >
            Long
          </button>
          <button
            onClick={() => setTradeType("short")}
            className="flex-1 py-2 rounded font-medium transition-all"
            style={{
              background: tradeType === "short" ? 'var(--red-9)' : 'var(--slate-4)',
              color: tradeType === "short" ? 'white' : 'var(--slate-11)',
              border: tradeType === "short" ? 'none' : '1px solid var(--slate-6)'
            }}
          >
            Short
          </button>
        </Flex>
      </div>

      {/* Position Size */}
      <div className="p-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
        <Flex justify="between" align="center" className="mb-2">
          <Text size="1" className="uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
            Size
          </Text>
          <span
            className="px-2 py-0.5 rounded text-xs font-mono"
            style={{ background: 'var(--violet-4)', color: 'var(--violet-11)' }}
            title="AI suggests 0.25 based on risk level"
          >
            AI: 0.25
          </span>
        </Flex>
        <input
          type="text"
          value={positionSize}
          onChange={(e) => setPositionSize(e.target.value)}
          className="w-full px-3 py-2 rounded border font-mono outline-none"
          style={{
            background: 'var(--slate-4)',
            borderColor: 'var(--slate-7)',
            color: 'var(--slate-12)'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = 'var(--blue-8)'}
          onBlur={(e) => e.currentTarget.style.borderColor = 'var(--slate-7)'}
        />
        <Text size="1" style={{ color: 'var(--slate-11)' }} className="mt-1">
          BTC
        </Text>
      </div>

      {/* Entry Price */}
      <div className="p-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
        <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
          Entry
        </Text>
        <input
          type="text"
          value={currentPrice}
          readOnly
          className="w-full px-3 py-2 rounded border font-mono"
          style={{
            background: 'var(--slate-4)',
            borderColor: 'var(--slate-6)',
            color: 'var(--slate-12)',
            cursor: 'not-allowed'
          }}
        />
        <Text size="1" style={{ color: 'var(--slate-11)' }} className="mt-1">
          Market price
        </Text>
      </div>

      {/* Stop Loss */}
      <div className="p-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
        <Flex justify="between" align="center" className="mb-2">
          <Text size="1" className="uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
            Stop Loss
          </Text>
          <button
            onClick={() => setStopLoss("97,200")}
            className="text-xs px-2 py-0.5 rounded transition-colors font-mono"
            style={{ background: 'var(--violet-4)', color: 'var(--violet-11)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--violet-5)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--violet-4)'}
            title="Use AI suggestion"
          >
            AI: 97.2k
          </button>
        </Flex>
        <input
          type="text"
          value={stopLoss}
          onChange={(e) => setStopLoss(e.target.value)}
          className="w-full px-3 py-2 rounded border font-mono outline-none"
          style={{
            background: 'var(--slate-4)',
            borderColor: 'var(--slate-7)',
            color: 'var(--slate-12)'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = 'var(--red-8)'}
          onBlur={(e) => e.currentTarget.style.borderColor = 'var(--slate-7)'}
        />
      </div>

      {/* Take Profit */}
      <div className="p-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
        <Flex justify="between" align="center" className="mb-2">
          <Text size="1" className="uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
            Take Profit
          </Text>
          <button
            onClick={() => setTakeProfit("100,500")}
            className="text-xs px-2 py-0.5 rounded transition-colors font-mono"
            style={{ background: 'var(--violet-4)', color: 'var(--violet-11)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--violet-5)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--violet-4)'}
            title="Use AI suggestion"
          >
            AI: 100.5k
          </button>
        </Flex>
        <input
          type="text"
          value={takeProfit}
          onChange={(e) => setTakeProfit(e.target.value)}
          className="w-full px-3 py-2 rounded border font-mono outline-none"
          style={{
            background: 'var(--slate-4)',
            borderColor: 'var(--slate-7)',
            color: 'var(--slate-12)'
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--green-8)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--slate-7)'}
        />
      </div>

      {/* Execute Button */}
      <div className="p-3 mt-auto shrink-0">
        <Button
          size="3"
          className="w-full font-bold cursor-pointer flex items-center justify-center"
          style={{
            background: tradeType === "long" ? 'var(--green-9)' : 'var(--red-9)',
            color: 'white'
          }}
        >
          {tradeType === "long" ? "Open Long Position" : "Open Short Position"}
        </Button>
        <Flex justify="center" align="center" gap="1" className="mt-4">
          <div className="w-1 h-1 rounded-full" style={{ background: 'var(--red-9)' }}></div>
          <Text size="1" style={{ color: 'var(--slate-11)' }}>
            Risk: High (73/100)
          </Text>
        </Flex>
      </div>
    </div>
  );
}
