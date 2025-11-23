"use client";

import { useState } from "react";
import { Flex, Text, Button, Badge } from "@radix-ui/themes";
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
  riskLevel: "low" | "medium" | "high";
  riskScore: number;
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
  setTakeProfit,
  riskLevel,
  riskScore
}: TradingTabProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const size = parseFloat(positionSize.replace(/,/g, ""));
    if (Number.isNaN(size) || size <= 0) {
      toast.error("Enter a valid size");
      return;
    }
    if (submitting) return;
    
    // Validate current price is available
    if (currentPrice === "0" || currentPrice === "0.00") {
      toast.error("Please wait for market price to load");
      return;
    }

    try {
      setSubmitting(true);
      
      // Parse current price, stop loss and take profit prices (remove commas and $)
      const currentPriceNum = parseFloat(currentPrice.replace(/,/g, "").replace("$", ""));
      const stopLossPrice = parseFloat(stopLoss.replace(/,/g, ""));
      const takeProfitPrice = parseFloat(takeProfit.replace(/,/g, ""));
      
      // Check balance for BUY orders (long positions) - non-blocking
      if (tradeType === "long") {
        // Perform balance check in background, don't block order if it fails
        (async () => {
          try {
            // Use a short timeout to prevent hanging
            const portfolio = await Promise.race([
              api.getPortfolio(),
              new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error("Balance check timeout")), 2000)
              )
            ]);
            const orderCost = size * currentPriceNum;
            const availableBalance = portfolio.balance_usd || 0;
            
            if (orderCost > availableBalance) {
              toast.error(
                `Insufficient balance: Order cost (${size} BTC × $${currentPriceNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = $${orderCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) exceeds available balance ($${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
                {
                  duration: 8000,
                  style: {
                    background: "var(--red-3)",
                    color: "var(--red-11)",
                    border: "2px solid var(--red-7)",
                    fontSize: "14px",
                    fontWeight: "500",
                  },
                }
              );
              // Note: We can't stop the order here since it's async, but the backend will reject it
            }
          } catch (error: any) {
            // Silently fail - backend will handle balance validation
            console.debug("Balance check unavailable, backend will validate:", error?.message || "Unknown error");
          }
        })();
        // Continue with order placement - backend will validate balance
      }
      
      console.log(`📊 Placing ${tradeType} order:`, {
        ticker: "BTC/USD",
        side: tradeType === "long" ? "BUY" : "SELL",
        amount: size,
        currentPrice: currentPriceNum,
        stopLoss: stopLossPrice,
        takeProfit: takeProfitPrice
      });
      
      // Validate stop loss and take profit prices make sense
      if (!Number.isNaN(stopLossPrice) && stopLossPrice > 0) {
        if (tradeType === "long") {
          // For LONG: stop loss should be BELOW entry price
          if (stopLossPrice >= currentPriceNum) {
            toast.error(`Stop loss (${stopLossPrice}) must be below entry price (${currentPriceNum}) for a long position`);
            setSubmitting(false);
            return;
          }
        } else {
          // For SHORT: stop loss should be ABOVE entry price
          if (stopLossPrice <= currentPriceNum) {
            toast.error(`Stop loss (${stopLossPrice}) must be above entry price (${currentPriceNum}) for a short position`);
            setSubmitting(false);
            return;
          }
        }
      }
      
      if (!Number.isNaN(takeProfitPrice) && takeProfitPrice > 0) {
        if (tradeType === "long") {
          // For LONG: take profit should be ABOVE entry price
          if (takeProfitPrice <= currentPriceNum) {
            toast.error(`Take profit (${takeProfitPrice}) must be above entry price (${currentPriceNum}) for a long position`);
            setSubmitting(false);
            return;
          }
          // Check if limit order would execute immediately (price already favorable)
          if (takeProfitPrice <= currentPriceNum * 1.001) { // Allow 0.1% buffer
            toast.error(`Take profit limit (${takeProfitPrice}) is too close to current price (${currentPriceNum}). It may execute immediately.`);
            setSubmitting(false);
            return;
          }
        } else {
          // For SHORT: take profit should be BELOW entry price
          if (takeProfitPrice >= currentPriceNum) {
            toast.error(`Take profit (${takeProfitPrice}) must be below entry price (${currentPriceNum}) for a short position`);
            setSubmitting(false);
            return;
          }
          // Check if limit order would execute immediately (price already favorable)
          if (takeProfitPrice >= currentPriceNum * 0.999) { // Allow 0.1% buffer
            toast.error(`Take profit limit (${takeProfitPrice}) is too close to current price (${currentPriceNum}). It may execute immediately.`);
            setSubmitting(false);
            return;
          }
        }
      }
      
      // Place market order first - this goes to /api/orders -> orders.py -> trading_service.place_market_order() -> Alpaca API
      const orderResult = await api.createOrder({
        ticker: "BTC/USD", // Backend normalizes to BTCUSD for Alpaca
        side: tradeType === "long" ? "BUY" : "SELL",
        order_type: "MARKET",
        amount: size,
      });
      
      console.log("✅ Main order placed:", orderResult);
      
      // TODO: TP/SL orders disabled for now - need proper implementation
      // Issues:
      // 1. STOP_LOSS not supported for crypto (need STOP_LIMIT)
      // 2. LIMIT orders for TP execute immediately if price is favorable
      // 3. Insufficient balance - orders use same funds as main order
      // Solution: Implement backend monitoring service or use bracket orders

      // Wait a moment for the position to be established
      await new Promise(resolve => setTimeout(resolve, 500));

      // Log TP/SL levels for debugging (not placing orders)
      if (!Number.isNaN(stopLossPrice) && stopLossPrice > 0) {
        console.log(`📌 Stop Loss set at: $${stopLossPrice} (not placing order yet)`);
      }

      if (!Number.isNaN(takeProfitPrice) && takeProfitPrice > 0) {
        console.log(`📌 Take Profit set at: $${takeProfitPrice} (not placing order yet)`);
      }
      
      toast.success(`✅ Order placed successfully! ${orderResult.id ? `Order ID: ${orderResult.id}` : ''}`);
      
      // Trigger a custom event to refresh history tab
      // The HistoryTab listens for WebSocket updates, but we also dispatch an event
      // to ensure immediate refresh if WebSocket hasn't updated yet
      console.log("📤 Dispatching orderPlaced event with order:", orderResult);
      window.dispatchEvent(new CustomEvent('orderPlaced', { detail: orderResult }));
    } catch (error: any) {
      console.error("❌ Failed to place order:", error);
      let errorMsg = error?.message || "Failed to place order. Check backend logs.";
      
      // Extract the actual error message (remove status code prefix like [500])
      if (errorMsg.includes("]")) {
        const parts = errorMsg.split("]");
        if (parts.length > 1) {
          errorMsg = parts.slice(1).join("]").trim();
        }
      }
      
      // Highlight insufficient balance errors with a more prominent notification
      if (errorMsg.toLowerCase().includes("insufficient balance")) {
        toast.error(errorMsg, {
          duration: 6000, // Show for 6 seconds instead of default
          style: {
            background: "var(--red-3)",
            color: "var(--red-11)",
            border: "2px solid var(--red-7)",
            fontSize: "14px",
            fontWeight: "500",
          },
        });
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .trading-size-input::placeholder {
          color: var(--slate-9);
          opacity: 0.6;
        }
      `}} />
      <div className="flex flex-col overflow-hidden" style={{ height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div className="px-3 py-3 border-b shrink-0" style={{ borderColor: 'var(--slate-6)' }}>
        <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>
          Trading
        </Text>
      </div>

      {/* Trade Type */}
      <div className="px-3 pt-3 pb-4 shrink-0">
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

      {/* Scrollable Content */}
      <div className="overflow-y-auto px-3 py-4 space-y-4" style={{ maxHeight: 'calc(100% - 16rem)' }}>
      {/* Position Size */}
      <div>
        <Flex justify="between" align="center" className="mb-2">
          <Text size="1" className="uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
            Size
          </Text>
          <Badge size="1" style={{ background: 'var(--purple-4)', color: 'var(--purple-11)', fontSize: '0.65rem' }}>
            AI suggestion: 0.5
          </Badge>
        </Flex>
        <input
          type="text"
          value={positionSize}
          onChange={(e) => setPositionSize(e.target.value)}
          placeholder="e.g: 0.5"
          className="trading-size-input w-full px-3 py-2 rounded border font-mono outline-none"
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
      <div>
        <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
          Entry
        </Text>
        <input
          type="text"
          value={currentPrice === "0" || currentPrice === "0.00" ? "Loading..." : `$${currentPrice}`}
          readOnly
          className="w-full px-3 py-2 rounded border font-mono"
          style={{
            background: 'var(--slate-4)',
            borderColor: 'var(--slate-6)',
            color: currentPrice === "0" || currentPrice === "0.00" ? 'var(--slate-11)' : 'var(--slate-12)',
            cursor: 'not-allowed'
          }}
        />
        <Text size="1" style={{ color: 'var(--slate-11)' }} className="mt-1">
          {currentPrice === "0" || currentPrice === "0.00" ? "Fetching market price..." : "Market price"}
        </Text>
      </div>

      {/* Stop Loss */}
      <div>
        <Flex justify="between" align="center" className="mb-2">
          <Text size="1" className="uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
            Stop Loss
          </Text>
          <Badge size="1" style={{ background: 'var(--purple-4)', color: 'var(--purple-11)', fontSize: '0.65rem' }}>
            AI suggestion: 85,000
          </Badge>
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
      <div>
        <Flex justify="between" align="center" className="mb-2">
          <Text size="1" className="uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
            Take Profit
          </Text>
          <Badge size="1" style={{ background: 'var(--purple-4)', color: 'var(--purple-11)', fontSize: '0.65rem' }}>
            AI suggestion: 95,000
          </Badge>
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
      </div>

      {/* Execute Trade Button - Always visible at bottom */}
      <div className="shrink-0 border-t" style={{
        borderColor: 'var(--slate-6)',
        flexShrink: 0,
        background: 'var(--slate-2)',
        padding: '0.75rem',
        paddingBottom: '1rem'
      }}>
        <Button
          size="3"
          className="w-full font-bold cursor-pointer flex items-center justify-center"
          style={{
            background: tradeType === "long" ? 'var(--green-9)' : 'var(--red-9)',
            color: 'white',
            fontSize: '0.875rem',
            fontWeight: 'bold',
            padding: '0.625rem 1rem',
            position: 'relative',
            zIndex: 30
          }}
          disabled={submitting || currentPrice === "0" || currentPrice === "0.00"}
          onClick={handleSubmit}
          onMouseEnter={(e) => {
            if (!submitting && currentPrice !== "0" && currentPrice !== "0.00") {
              e.currentTarget.style.opacity = '0.9';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          {submitting
            ? "Placing Order..."
            : currentPrice === "0" || currentPrice === "0.00"
              ? "Waiting for Price..."
              : tradeType === "long"
                ? "Place Long Order"
                : "Place Short Order"}
        </Button>
        <Flex justify="center" align="start" gap="1" className="mt-4">
          <div
            className="w-1 h-1 rounded-full"
            style={{
              background: riskLevel === "high" ? 'var(--red-9)' : riskLevel === "medium" ? 'var(--yellow-9)' : 'var(--green-9)'
            }}
          ></div>
          <Text size="1" style={{ color: 'var(--slate-11)', fontSize: '0.65rem' }}>
            Risk: {riskLevel === "high" ? "High" : riskLevel === "medium" ? "Medium" : "Low"} ({riskScore}/100)
          </Text>
        </Flex>
        <Text size="1" style={{ color: 'var(--slate-10)', textAlign: 'center', fontSize: '0.6rem' }} className="mt-1">
          Orders execute via Alpaca Paper Trading
        </Text>
      </div>
    </div>
    </>
  );
}
