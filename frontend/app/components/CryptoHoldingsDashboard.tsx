"use client";

import { useState, useEffect, useRef } from "react";
import { Text, DropdownMenu } from "@radix-ui/themes";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { useAlpacaWebSocket } from "@/hooks/useAlpacaWebSocket";
import type { AlpacaMessage } from "@/lib/websocket";
import { transformBarToChartData } from "@/lib/alpacaDataTransform";
import { api } from "@/app/lib/api";

interface Holding {
  id: string;
  symbol: string;
  name: string;
  quantity: string;
  avgPrice: string;
  type: "crypto" | "stocks" | "options" | "etfs";
}

interface HoldingCardProps {
  holding: Holding;
  currentPrice: number | null;
  isConnected: boolean;
  onClick?: () => void;
}

type HoldingsFilter = "all" | "crypto" | "stocks" | "options" | "etfs";

function HoldingCard({ holding, currentPrice, isConnected, onClick }: HoldingCardProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const dataPointsRef = useRef<Array<{ time: number; value: number }>>([]);
  const hasInitialDataRef = useRef(false);
  const [localPrice, setLocalPrice] = useState<number | null>(currentPrice);
  const [localConnected, setLocalConnected] = useState(isConnected);
  const [showLoadingText, setShowLoadingText] = useState(true);
  const lastSignalTimeRef = useRef<number>(Date.now());
  const [showConnected, setShowConnected] = useState(false);

  // Normalize symbol for comparison
  const normalizeSymbol = (s: string): string => {
    let normalized = s.replace("/USD", "").replace("/", "");
    if (normalized.endsWith("USD")) {
      normalized = normalized.slice(0, -3);
    }
    return normalized.toUpperCase();
  };

  // Handle incoming WebSocket messages
  const handleMessage = (message: AlpacaMessage) => {
    if (message.type === "connected") {
      setLocalConnected(true);
    } else if (message.type === "bar") {
      const barData = message.data;
      const messageSymbol = normalizeSymbol(barData.symbol);
      const holdingSymbol = normalizeSymbol(holding.symbol);

      if (messageSymbol === holdingSymbol || barData.symbol === holding.symbol) {
        setLocalConnected(true); // Mark as connected when receiving data
        setLocalPrice(barData.close);
        lastSignalTimeRef.current = Date.now(); // Update signal time on every bar

        if (seriesRef.current) {
          const chartData = transformBarToChartData(barData);
          
          if (typeof chartData.time !== 'number' || isNaN(chartData.time)) {
            return;
          }
          
          const newDataPoint = { time: chartData.time, value: chartData.close };
          
          if (!hasInitialDataRef.current) {
            dataPointsRef.current = [newDataPoint];
            seriesRef.current.setData([newDataPoint] as any);
            hasInitialDataRef.current = true;
          } else {
            dataPointsRef.current.push(newDataPoint);
            if (dataPointsRef.current.length > 50) {
              dataPointsRef.current.shift();
            }
            try {
              seriesRef.current.update(newDataPoint as any);
            } catch (error) {
              seriesRef.current.setData(dataPointsRef.current as any);
            }
          }
        }
      }
    }
  };

  // WebSocket connection - only allow Bitcoin subscriptions to avoid port issues
  useAlpacaWebSocket({
    symbols: holding.type === "crypto" && (holding.symbol === "BTC" || holding.symbol?.includes("BTC")) ? ["BTC"] : [],
    dataType: "crypto", // Force crypto type, only BTC will actually subscribe
    onMessage: handleMessage,
    autoConnect: holding.type === "crypto" && (holding.symbol === "BTC" || holding.symbol?.includes("BTC")),
  });

  // Check if 10 seconds have passed since last signal
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastSignalTimeRef.current > 10000) {
        setShowConnected(false);
      } else {
        setShowConnected(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Update local state when props change
  useEffect(() => {
    if (currentPrice !== null) {
      setLocalPrice(currentPrice);
    }
    setLocalConnected(isConnected);

    // Hide "Loading..." text after 10 seconds if no data
    const timeout = setTimeout(() => {
      if (!localPrice) {
        setShowLoadingText(false);
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [currentPrice, isConnected, localPrice]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#111113' },
        textColor: '#B0B4BA',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || Math.max(100, window.innerHeight * 0.15),
      timeScale: {
        visible: false,
      },
      rightPriceScale: {
        visible: false,
      },
      leftPriceScale: {
        visible: false,
      },
      handleScroll: false,
      handleScale: false,
      autoSize: true,
    });

    chartRef.current = chart;

    const lineSeries = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 2,
    });

    lineSeries.setData([]);
    seriesRef.current = lineSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const width = chartContainerRef.current.clientWidth;
        const height = chartContainerRef.current.clientHeight || Math.max(100, window.innerHeight * 0.15);
        chartRef.current.applyOptions({ width, height });
      }
    };

    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver && chartContainerRef.current) {
        resizeObserver.unobserve(chartContainerRef.current);
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [holding.symbol]);

  const avgPriceNum = parseFloat(holding.avgPrice.replace(/,/g, ''));
  const quantityNum = parseFloat(holding.quantity.replace(/,/g, ''));
  const displayPrice = localPrice || currentPrice;
  const currentValue = displayPrice ? displayPrice * quantityNum : avgPriceNum * quantityNum;
  const priceChange = displayPrice ? displayPrice - avgPriceNum : 0;
  const priceChangePercent = displayPrice ? (priceChange / avgPriceNum) * 100 : 0;

  return (
    <div
      className="border rounded-lg flex flex-col cursor-pointer hover:border-blue-500 transition-colors"
      style={{
        background: 'var(--slate-3)',
        borderColor: 'var(--slate-6)',
        height: '280px',
        maxWidth: '380px',
        padding: '0.75rem'
      }}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-baseline gap-2 overflow-hidden">
          <Text size="4" weight="bold" style={{ color: 'var(--slate-12)', whiteSpace: 'nowrap' }}>
            {holding.symbol}
          </Text>
          <Text size="2" style={{ color: 'var(--slate-11)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {holding.name}
          </Text>
        </div>
        <div className={`h-2 w-2 rounded-full shrink-0 ${showConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>

      {/* Price Info */}
      <div className="mb-2 shrink-0">
        <Text size="3" weight="bold" style={{ color: localPrice ? 'var(--slate-12)' : 'var(--slate-11)' }}>
          {localPrice ? `$${localPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : (showLoadingText ? 'Loading...' : '')}
        </Text>
        {localPrice && (
          <Text
            size="2"
            style={{
              color: priceChange >= 0 ? 'var(--green-11)' : 'var(--red-11)',
              marginLeft: '8px'
            }}
          >
            {priceChange >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
          </Text>
        )}
      </div>

      {/* Mini Chart */}
      <div ref={chartContainerRef} className="flex-1 min-h-0" />

      {/* Holdings Info */}
      <div className="mt-2 pt-2 border-t shrink-0" style={{ borderColor: 'var(--slate-6)' }}>
        <div className="flex justify-between text-xs" style={{ color: 'var(--slate-11)' }}>
          <span>Qty: {holding.quantity}</span>
          <span>Value: ${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
}

interface CryptoHoldingsDashboardProps {
  onHoldingClick?: (holding: Holding) => void;
  resetFilter?: boolean;
}

export default function CryptoHoldingsDashboard({ onHoldingClick, resetFilter }: CryptoHoldingsDashboardProps = {}) {
  const [filter, setFilter] = useState<HoldingsFilter>("all");

  // Reset filter to "all" when resetFilter prop is true
  useEffect(() => {
    if (resetFilter) {
      setFilter("all");
    }
  }, [resetFilter]);

  const [allHoldings, setAllHoldings] = useState<Holding[]>([
    // Crypto Holdings
    { id: "1", symbol: "BTC", name: "Bitcoin", quantity: "0", avgPrice: "0", type: "crypto" },
    { id: "2", symbol: "ETH", name: "Ethereum", quantity: "0", avgPrice: "0", type: "crypto" },
    { id: "3", symbol: "SOL", name: "Solana", quantity: "0", avgPrice: "0", type: "crypto" },
    { id: "4", symbol: "ADA", name: "Cardano", quantity: "0", avgPrice: "0", type: "crypto" },
    { id: "5", symbol: "AVAX", name: "Avalanche", quantity: "0", avgPrice: "0", type: "crypto" },
    { id: "6", symbol: "MATIC", name: "Polygon", quantity: "0", avgPrice: "0", type: "crypto" },
    // Stock Holdings
    { id: "7", symbol: "AAPL", name: "Apple Inc.", quantity: "0", avgPrice: "0", type: "stocks" },
    { id: "8", symbol: "MSFT", name: "Microsoft Corporation", quantity: "0", avgPrice: "0", type: "stocks" },
    { id: "9", symbol: "GOOGL", name: "Alphabet Inc.", quantity: "0", avgPrice: "0", type: "stocks" },
    { id: "10", symbol: "AMZN", name: "Amazon.com Inc.", quantity: "0", avgPrice: "0", type: "stocks" },
    { id: "11", symbol: "TSLA", name: "Tesla Inc.", quantity: "0", avgPrice: "0", type: "stocks" },
    { id: "12", symbol: "NVDA", name: "NVIDIA Corporation", quantity: "0", avgPrice: "0", type: "stocks" },
    // Option Holdings
    { id: "13", symbol: "AAPL", name: "Apple Call Option", quantity: "0", avgPrice: "0", type: "options" },
    { id: "14", symbol: "TSLA", name: "Tesla Put Option", quantity: "0", avgPrice: "0", type: "options" },
    // ETF Holdings
    { id: "15", symbol: "SPY", name: "SPDR S&P 500 ETF", quantity: "0", avgPrice: "0", type: "etfs" },
    { id: "16", symbol: "QQQ", name: "Invesco QQQ Trust", quantity: "0", avgPrice: "0", type: "etfs" },
    { id: "17", symbol: "VTI", name: "Vanguard Total Stock Market ETF", quantity: "0", avgPrice: "0", type: "etfs" },
  ]);

  // Fetch real positions from API and update holdings
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const positions = await api.getPositions();

        // Update holdings with real quantities and prices from positions
        setAllHoldings(prev => prev.map(holding => {
          // Find matching position by symbol
          const position = positions.find((p: any) => {
            // Normalize both symbols for comparison
            const posSymbol = p.symbol.replace("/USD", "").replace("USD", "").replace("/", "");
            const holdingSymbol = holding.symbol.replace("/USD", "").replace("USD", "").replace("/", "");
            return posSymbol === holdingSymbol;
          });

          if (position) {
            console.log(`Matched position for ${holding.symbol}:`, position);
            return {
              ...holding,
              quantity: position.qty.toString(),
              avgPrice: position.avg_entry_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            };
          }
          return holding;
        }));
      } catch (error) {
        console.warn("Trading service unavailable - using default data:", error);
        // Don't retry if service is not enabled
        return;
      }
    };

    fetchPositions();
    // Only refresh if first fetch succeeds
    // const interval = setInterval(fetchPositions, 10000);
    // return () => clearInterval(interval);
  }, []);

  const filteredHoldings = filter === "all" 
    ? allHoldings 
    : allHoldings.filter(h => h.type === filter);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden" style={{ background: 'var(--slate-2)' }}>
      {/* Scrollable content area */}
      <div className="flex-1 p-6 overflow-y-auto" style={{ minHeight: 0 }}>
        {/* Dropdown Filter */}
        <div className="mb-6">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <button
              className="flex items-center gap-2 rounded-md border"
              style={{
                background: 'var(--slate-3)',
                borderColor: 'var(--slate-6)',
                color: 'var(--slate-12)',
                padding: '0.375rem 0.75rem',
                gap: '0.25rem',
                fontSize: '0.75rem',
                minWidth: '9rem',
                justifyContent: 'space-between'
              }}
            >
              <Text size="2" weight="medium" style={{ fontSize: '0.75rem' }}>
                {filter === "all" ? "All Holdings" :
                 filter === "crypto" ? "Crypto Holdings" :
                 filter === "stocks" ? "Stock Holdings" :
                 filter === "options" ? "Option Holdings" :
                 "ETF Holdings"}
              </Text>
              <ChevronDownIcon style={{ width: '0.75rem', height: '0.75rem' }} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content style={{ minWidth: '9rem', background: 'var(--slate-3)', border: '1px solid var(--slate-6)', color: 'var(--slate-12)' }}>
            <DropdownMenu.Item onSelect={() => setFilter("all")} style={{ fontSize: '0.75rem', color: 'var(--slate-12)' }}>
              All Holdings
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => setFilter("crypto")} style={{ fontSize: '0.75rem', color: 'var(--slate-12)' }}>
              Crypto Holdings
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => setFilter("stocks")} style={{ fontSize: '0.75rem', color: 'var(--slate-12)' }}>
              Stock Holdings
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => setFilter("options")} style={{ fontSize: '0.75rem', color: 'var(--slate-12)' }}>
              Option Holdings
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => setFilter("etfs")} style={{ fontSize: '0.75rem', color: 'var(--slate-12)' }}>
              ETF Holdings
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 'clamp(0.75rem, 1.5vw, 1rem)' }}>
          {filteredHoldings.map((holding) => (
            <HoldingCard
              key={holding.id}
              holding={holding}
              currentPrice={null}
              isConnected={false}
              onClick={() => onHoldingClick?.(holding)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
