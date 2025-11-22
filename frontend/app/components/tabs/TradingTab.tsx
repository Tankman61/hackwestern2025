"use client";

import { useState } from "react";
import { Flex, Text, Button } from "@radix-ui/themes";
import { api } from "@/app/lib/api";
import { toast } from "react-hot-toast";

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
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const size = parseFloat(positionSize);
    if (Number.isNaN(size) || size <= 0) {
      toast.error("Enter a valid position size");
      return;
    }
    if (submitting) return;

    try {
      setSubmitting(true);
      await api.createOrder({
        ticker: "BTC-USD",
        side: tradeType === "long" ? "BUY" : "SELL",
        order_type: "MARKET",
        amount: size,
      });
    } catch (error) {
      // toast handled in api layer
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-3 py-3 border-b shrink-0" style={{ borderColor: 'var(--slate-6)' }}>
        <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>
          Paper Trading
        </Text>
        {accountLoading ? (
          <Text size="1" style={{ color: 'var(--slate-11)' }}>Loading...</Text>
        ) : account ? (
          <Text size="1" style={{ color: 'var(--green-11)' }}>● Connected</Text>
        ) : (
          <Text size="1" style={{ color: 'var(--red-11)' }}>● Add API keys to .env</Text>
        )}
      </div>

      {/* Account Info */}
      {account && (
        <div className="p-3 border-b shrink-0" style={{ borderColor: 'var(--slate-6)' }}>
          <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
            Account
          </Text>
          <div className="space-y-1">
            <Flex justify="between">
              <Text size="1" style={{ color: 'var(--slate-11)' }}>Buying Power</Text>
              <Text size="1" className="font-mono" style={{ color: 'var(--slate-12)' }}>
                ${buyingPower.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </Flex>
            <Flex justify="between">
              <Text size="1" style={{ color: 'var(--slate-11)' }}>Portfolio</Text>
              <Text size="1" className="font-mono" style={{ color: 'var(--slate-12)' }}>
                ${account.portfolio_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </Flex>
          </div>
        </div>
      )}

      {/* Asset Type */}
      <div className="p-3 border-b shrink-0" style={{ borderColor: 'var(--slate-6)' }}>
        <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
          Asset Type
        </Text>
        <Flex gap="2">
          <button
            onClick={() => {
              setAssetType("crypto");
              setSymbol("BTC/USD");
            }}
            className="flex-1 py-2 rounded font-medium transition-all text-sm"
            style={{
              background: assetType === "crypto" ? 'var(--blue-9)' : 'var(--slate-4)',
              color: assetType === "crypto" ? 'white' : 'var(--slate-11)',
              border: assetType === "crypto" ? 'none' : '1px solid var(--slate-6)'
            }}
          >
            Crypto
          </button>
          <button
            onClick={() => {
              setAssetType("stocks");
              setSymbol("AAPL");
            }}
            className="flex-1 py-2 rounded font-medium transition-all text-sm"
            style={{
              background: assetType === "stocks" ? 'var(--blue-9)' : 'var(--slate-4)',
              color: assetType === "stocks" ? 'white' : 'var(--slate-11)',
              border: assetType === "stocks" ? 'none' : '1px solid var(--slate-6)'
            }}
          >
            Stocks
          </button>
        </Flex>
      </div>

      {/* Symbol */}
      <div className="p-3 border-b shrink-0" style={{ borderColor: 'var(--slate-6)' }}>
        <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
          Symbol
        </Text>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="w-full px-3 py-2 rounded border font-mono outline-none"
          style={{
            background: 'var(--slate-4)',
            borderColor: 'var(--slate-7)',
            color: 'var(--slate-12)'
          }}
        >
          {assetType === "crypto" ? (
            cryptoSymbols.map(sym => (
              <option key={sym} value={sym}>{sym}</option>
            ))
          ) : (
            stockSymbols.map(sym => (
              <option key={sym} value={sym}>{sym}</option>
            ))
          )}
        </select>
        {livePrice && (
          <Text size="1" style={{ color: 'var(--green-11)' }} className="mt-1">
            ● Live: ${livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        )}
      </div>

      {/* Order Type */}
      <div className="p-3 border-b shrink-0" style={{ borderColor: 'var(--slate-6)' }}>
        <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
          Order Type
        </Text>
        <Flex gap="2">
          <button
            onClick={() => setOrderType("market")}
            className="flex-1 py-2 rounded font-medium transition-all text-sm"
            style={{
              background: orderType === "market" ? 'var(--violet-9)' : 'var(--slate-4)',
              color: orderType === "market" ? 'white' : 'var(--slate-11)',
              border: orderType === "market" ? 'none' : '1px solid var(--slate-6)'
            }}
          >
            Market
          </button>
          <button
            onClick={() => setOrderType("limit")}
            className="flex-1 py-2 rounded font-medium transition-all text-sm"
            style={{
              background: orderType === "limit" ? 'var(--violet-9)' : 'var(--slate-4)',
              color: orderType === "limit" ? 'white' : 'var(--slate-11)',
              border: orderType === "limit" ? 'none' : '1px solid var(--slate-6)'
            }}
          >
            Limit
          </button>
        </Flex>
      </div>

      {/* Side */}
      <div className="p-3 border-b shrink-0" style={{ borderColor: 'var(--slate-6)' }}>
        <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
          Side
        </Text>
        <Flex gap="2">
          <button
            onClick={() => setTradeType("long")}
            className="flex-1 py-2 rounded font-medium transition-all"
            style={{
              background: tradeType === "long" ? 'var(--green-9)' : 'var(--slate-4)',
              color: tradeType === "long" ? 'white' : 'var(--slate-11)',
              border: tradeType === "long" ? 'none' : '1px solid var(--slate-6)'
            }}
          >
            Buy
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
            Sell
          </button>
        </Flex>
      </div>

      {/* Quantity */}
      <div className="p-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
        <Flex justify="between" align="center" className="mb-2">
          <Text size="1" className="uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
            Quantity
          </Text>
          {aiPositionSize > 0 && (
            <button
              onClick={() => setPositionSize(aiPositionSize.toFixed(4))}
              className="px-2 py-0.5 rounded text-xs font-mono"
              style={{ background: 'var(--violet-4)', color: 'var(--violet-11)' }}
              title="AI suggests 10% of buying power"
            >
              AI: {aiPositionSize.toFixed(4)}
            </button>
          )}
        </Flex>
        <input
          type="text"
          value={positionSize}
          onChange={(e) => setPositionSize(e.target.value)}
          placeholder="0.0"
          className="w-full px-3 py-2 rounded border font-mono outline-none"
          style={{
            background: 'var(--slate-4)',
            borderColor: 'var(--slate-7)',
            color: 'var(--slate-12)'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = 'var(--blue-8)'}
          onBlur={(e) => e.currentTarget.style.borderColor = 'var(--slate-7)'}
        />
        {estimatedCost > 0 && (
          <Flex justify="between" className="mt-1">
            <Text size="1" style={{ color: 'var(--slate-11)' }}>
              Est. Cost: ${estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            {!canAfford && (
              <Text size="1" style={{ color: 'var(--red-11)' }}>
                Insufficient funds
              </Text>
            )}
          </Flex>
        )}
      </div>

      {/* Limit Price */}
      {orderType === "limit" && (
        <div className="p-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
          <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
            Limit Price
          </Text>
          <input
            type="text"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            placeholder={livePrice ? livePrice.toString() : "0.0"}
            className="w-full px-3 py-2 rounded border font-mono outline-none"
            style={{
              background: 'var(--slate-4)',
              borderColor: 'var(--slate-7)',
              color: 'var(--slate-12)'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--violet-8)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--slate-7)'}
          />
        </div>
      )}

      {/* Stop Loss */}
      <div className="p-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
        <Flex justify="between" align="center" className="mb-2">
          <Text size="1" className="uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
            Stop Loss (Optional)
          </Text>
          {aiStopLoss > 0 && (
            <button
              onClick={() => setStopLoss(aiStopLoss.toFixed(2))}
              className="text-xs px-2 py-0.5 rounded transition-colors font-mono"
              style={{ background: 'var(--violet-4)', color: 'var(--violet-11)' }}
              title="2% from entry"
            >
              AI: ${aiStopLoss.toFixed(2)}
            </button>
          )}
        </Flex>
        <input
          type="text"
          value={stopLoss}
          onChange={(e) => setStopLoss(e.target.value)}
          placeholder="Optional"
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
            Take Profit (Optional)
          </Text>
          {aiTakeProfit > 0 && (
            <button
              onClick={() => setTakeProfit(aiTakeProfit.toFixed(2))}
              className="text-xs px-2 py-0.5 rounded transition-colors font-mono"
              style={{ background: 'var(--violet-4)', color: 'var(--violet-11)' }}
              title="5% from entry"
            >
              AI: ${aiTakeProfit.toFixed(2)}
            </button>
          )}
        </Flex>
        <input
          type="text"
          value={takeProfit}
          onChange={(e) => setTakeProfit(e.target.value)}
          placeholder="Optional"
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

      {/* Order Status */}
      {lastOrderStatus && (
        <div className="p-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
          <Text size="1" style={{ 
            color: lastOrderStatus.startsWith('✅') ? 'var(--green-11)' : 'var(--red-11)' 
          }}>
            {lastOrderStatus}
          </Text>
        </div>
      )}

      {/* Execute Button */}
      <div className="p-3 mt-auto shrink-0">
        <Button
          size="3"
          className="w-full font-bold flex items-center justify-center"
          style={{
            background: tradeType === "long" ? 'var(--green-9)' : 'var(--red-9)',
            color: 'white'
          }}
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting ? "Submitting..." : tradeType === "long" ? "Open Long Position" : "Open Short Position"}
        </Button>
        <Flex justify="center" align="center" gap="1" className="mt-3">
          <div className="w-1 h-1 rounded-full" style={{ 
            background: account ? 'var(--green-9)' : 'var(--red-9)' 
          }}></div>
          <Text size="1" style={{ color: 'var(--slate-11)' }}>
            {account ? 'Paper Trading Active' : 'Trading Unavailable'}
          </Text>
        </Flex>
      </div>
    </div>
  );
}
