"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi } from "lightweight-charts";
import { useAlpacaWebSocket } from "@/hooks/useAlpacaWebSocket";
import type { AlpacaMessage, AlpacaBar } from "@/lib/websocket";
import { transformBarToChartData } from "@/lib/alpacaDataTransform";

interface LiveChartProps {
  symbol: string;
  dataType: "crypto" | "stocks" | "options" | "etfs";
}

export default function LiveAlpacaChart({ symbol, dataType }: LiveChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const hasInitialDataRef = useRef(false);
  const dataPointsRef = useRef<Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>>([]);

  // Handle incoming Alpaca messages
  const handleMessage = (message: AlpacaMessage) => {
    if (message.type === "connected") {
      setIsConnected(true);
      console.log(`✅ ${symbol} chart connected:`, message.message);
    } else if (message.type === "subscribed") {
      console.log(`✅ ${symbol} subscribed to symbols:`, message.symbols);
    } else if (message.type === "bar") {
      console.log(`📊 ${symbol} received bar:`, message.data);
      const barData = message.data as AlpacaBar;
      
      // Normalize symbols for comparison (BTCUSD -> BTC, BTC/USD -> BTC, BTC -> BTC)
      const normalizeSymbol = (s: string): string => {
        let normalized = s.replace("/USD", "").replace("/", "");
        // Remove USD suffix if present
        if (normalized.endsWith("USD")) {
          normalized = normalized.slice(0, -3);
        }
        return normalized.toUpperCase();
      };
      
      const messageSymbol = normalizeSymbol(barData.symbol);
      const normalizedSymbol = normalizeSymbol(symbol);
      
      if (messageSymbol === normalizedSymbol || barData.symbol === symbol || messageSymbol === symbol) {
        console.log(`✅ ${symbol} bar matched! Price: $${barData.close}`);
        setLastPrice(barData.close);

        // Update chart with new data
        if (seriesRef.current) {
          const chartData = transformBarToChartData(barData);
          
          // Ensure time is a number (Unix timestamp in seconds)
          if (typeof chartData.time !== 'number' || isNaN(chartData.time)) {
            console.error('Invalid timestamp in bar data:', chartData.time);
            return;
          }
          
          // Check if we already have data for this timestamp (allow 5 second window for 4-second bars)
          const existingIndex = dataPointsRef.current.findIndex(
            (dp) => Math.abs(dp.time - chartData.time) <= 5
          );
          
          if (existingIndex >= 0) {
            // Update existing data point
            dataPointsRef.current[existingIndex] = chartData;
            try {
              seriesRef.current.update(chartData);
            } catch (error) {
              // If update fails (e.g., bar is too old), try to add as new data
              console.warn('Failed to update existing bar, trying to add as new:', error);
              // Only add if it's newer than the last bar
              if (dataPointsRef.current.length > 0) {
                const lastBar = dataPointsRef.current[dataPointsRef.current.length - 1];
                if (chartData.time > lastBar.time) {
                  dataPointsRef.current.push(chartData);
                  // Keep only last 100 data points
                  if (dataPointsRef.current.length > 100) {
                    dataPointsRef.current.shift();
                  }
                  seriesRef.current.update(chartData);
                }
              }
            }
          } else {
            // Add new data point
            if (!hasInitialDataRef.current) {
              // First data point - set initial data
              dataPointsRef.current = [chartData];
              seriesRef.current.setData(dataPointsRef.current);
              hasInitialDataRef.current = true;
              // Fit content to show all data
              chartRef.current?.timeScale().fitContent();
            } else {
              // Check if this bar is newer than the last bar
              if (dataPointsRef.current.length > 0) {
                const lastBar = dataPointsRef.current[dataPointsRef.current.length - 1];
                if (chartData.time >= lastBar.time) {
                  // Newer or same time - add it
                  dataPointsRef.current.push(chartData);
                  // Keep only last 100 data points
                  if (dataPointsRef.current.length > 100) {
                    dataPointsRef.current.shift();
                  }
                  try {
                    seriesRef.current.update(chartData);
                  } catch (error) {
                    // If update fails, reset with all data
                    console.warn('Failed to update chart, resetting data:', error);
                    seriesRef.current.setData(dataPointsRef.current);
                  }
                } else {
                  // Older bar - ignore it (chart has moved forward)
                  console.warn('Ignoring bar with older timestamp:', chartData.time, 'last:', lastBar.time);
                }
              } else {
                // No existing data, add it
                dataPointsRef.current.push(chartData);
                seriesRef.current.update(chartData);
              }
            }
          }
        }
      }
    } else if (message.type === "trade") {
      const tradeData = message.data;
      // Normalize symbols for comparison
      const normalizeSymbol = (s: string): string => {
        let normalized = s.replace("/USD", "").replace("/", "");
        if (normalized.endsWith("USD")) {
          normalized = normalized.slice(0, -3);
        }
        return normalized.toUpperCase();
      };
      
      const messageSymbol = normalizeSymbol(tradeData.symbol);
      const normalizedSymbol = normalizeSymbol(symbol);
      
      if (messageSymbol === normalizedSymbol || tradeData.symbol === symbol || messageSymbol === symbol) {
        setLastPrice(tradeData.price);
        
        // Update chart in real-time with trade data
        if (seriesRef.current && hasInitialDataRef.current) {
          const currentTime = Math.floor(Date.now() / 1000);
          const tradeTime = tradeData.timestamp;
          
          // Find the most recent bar (within the last 4 seconds)
          const recentBarIndex = dataPointsRef.current.findIndex(
            (dp) => Math.abs(dp.time - tradeTime) <= 4 || Math.abs(dp.time - currentTime) <= 4
          );
          
          if (recentBarIndex >= 0) {
            // Update existing bar's close price and adjust high/low in real-time
            const existing = dataPointsRef.current[recentBarIndex];
            const newHigh = Math.max(existing.high, tradeData.price);
            const newLow = Math.min(existing.low, tradeData.price);
            
            dataPointsRef.current[recentBarIndex] = {
              ...existing,
              close: tradeData.price,
              high: newHigh,
              low: newLow,
              volume: (existing.volume || 0) + (tradeData.size || 0)
            };
            seriesRef.current.update(dataPointsRef.current[recentBarIndex] as any);
          } else if (dataPointsRef.current.length > 0) {
            // No matching bar, update the last bar with new price
            const lastBar = dataPointsRef.current[dataPointsRef.current.length - 1];
            const newHigh = Math.max(lastBar.high, tradeData.price);
            const newLow = Math.min(lastBar.low, tradeData.price);
            
            dataPointsRef.current[dataPointsRef.current.length - 1] = {
              ...lastBar,
              close: tradeData.price,
              high: newHigh,
              low: newLow,
              volume: (lastBar.volume || 0) + (tradeData.size || 0)
            };
            seriesRef.current.update(dataPointsRef.current[dataPointsRef.current.length - 1] as any);
          }
        }
      }
    } else if (message.type === "error") {
      console.error(`❌ ${symbol} WebSocket error:`, message.message);
      setIsConnected(false);
    } else {
      console.log(`ℹ️ ${symbol} received message:`, message);
    }
  };

  // Use the WebSocket hook
  const { subscribe, unsubscribe, isConnected: checkConnection } = useAlpacaWebSocket({
    symbols: [symbol],
    dataType,
    onMessage: handleMessage,
    autoConnect: true,
  });

  // Log connection status
  useEffect(() => {
    const checkStatus = setInterval(() => {
      const connected = checkConnection();
      if (connected !== isConnected) {
        console.log(`🔌 ${symbol} connection status: ${connected ? 'Connected' : 'Disconnected'}`);
      }
    }, 1000);
    return () => clearInterval(checkStatus);
  }, [symbol, isConnected, checkConnection]);

  // Reset data when symbol changes
  useEffect(() => {
    hasInitialDataRef.current = false;
    dataPointsRef.current = [];
    if (seriesRef.current) {
      // Clear existing data
      seriesRef.current.setData([]);
    }
  }, [symbol, dataType]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Ensure container has dimensions
    const containerWidth = chartContainerRef.current.clientWidth || 800;
    const containerHeight = 400;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#111113" },
        textColor: "#B0B4BA",
      },
      grid: {
        vertLines: { color: "#2B2D31" },
        horzLines: { color: "#2B2D31" },
      },
      width: containerWidth,
      height: containerHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    // Initialize with empty data
    candlestickSeries.setData([]);

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      hasInitialDataRef.current = false;
      dataPointsRef.current = [];
    };
  }, []);

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: "var(--slate-12)" }}>
            {symbol}
          </h2>
          {lastPrice !== null ? (
            <p className="text-lg font-semibold" style={{ color: "var(--green-11)" }}>
              ${lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          ) : (
            <p className="text-sm" style={{ color: "var(--slate-9)" }}>
              Waiting for data...
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{
              backgroundColor: isConnected ? "var(--green-9)" : "var(--red-9)",
            }}
          />
          <span style={{ color: "var(--slate-11)" }}>
            {isConnected ? "Live" : "Disconnected"}
          </span>
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full" style={{ minHeight: '400px' }} />
    </div>
  );
}
