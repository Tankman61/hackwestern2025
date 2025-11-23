"use client";

import { useState, useEffect, useRef } from "react";
import { Flex, Text, Button, TextField } from "@radix-ui/themes";
import { PlusIcon, TrashIcon, ArrowLeftIcon } from "@radix-ui/react-icons";
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { useAlpacaWebSocket } from "@/hooks/useAlpacaWebSocket";
import type { AlpacaMessage } from "@/lib/websocket";
import { transformBarToChartData } from "@/lib/alpacaDataTransform";

interface Holding {
  id: string;
  symbol: string;
  name: string;
  quantity: string;
  avgPrice: string;
}

interface ETFsHoldingsProps {
  initialSelectedHolding?: Holding | null;
  onReturn?: () => void;
}

export default function ETFsHoldings({ initialSelectedHolding = null, onReturn }: ETFsHoldingsProps = {}) {
  const [holdings, setHoldings] = useState<Holding[]>([
    { id: "1", symbol: "SPY", name: "SPDR S&P 500 ETF", quantity: "280", avgPrice: "464.00" },
    { id: "2", symbol: "VOO", name: "Vanguard S&P 500 ETF", quantity: "195", avgPrice: "499.00" },
    { id: "3", symbol: "QQQ", name: "Invesco QQQ Trust", quantity: "140", avgPrice: "420.00" },
    { id: "4", symbol: "VTI", name: "Vanguard Total Stock Market", quantity: "105", avgPrice: "250.00" },
    { id: "5", symbol: "IWM", name: "iShares Russell 2000", quantity: "55", avgPrice: "210.00" },
    { id: "6", symbol: "DIA", name: "SPDR Dow Jones Industrial", quantity: "25", avgPrice: "427.50" },
  ]);
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(initialSelectedHolding);
  
  // Update selected holding when prop changes
  useEffect(() => {
    if (initialSelectedHolding) {
      setSelectedHolding(initialSelectedHolding);
    }
  }, [initialSelectedHolding]);

  // Listen for custom event to select a holding (from dashboard click)
  useEffect(() => {
    const handleSelectHolding = (event: CustomEvent<Holding>) => {
      const holding = event.detail;
      if (holding.type === 'etfs') {
        setSelectedHolding(holding);
      }
    };

    window.addEventListener('selectHolding', handleSelectHolding as EventListener);
    return () => {
      window.removeEventListener('selectHolding', handleSelectHolding as EventListener);
    };
  }, []);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const [newHolding, setNewHolding] = useState({
    symbol: "",
    name: "",
    quantity: "",
    avgPrice: "",
  });

  const addHolding = () => {
    if (newHolding.symbol && newHolding.name && newHolding.quantity && newHolding.avgPrice) {
      setHoldings([
        ...holdings,
        {
          id: Date.now().toString(),
          ...newHolding,
        },
      ]);
      setNewHolding({ symbol: "", name: "", quantity: "", avgPrice: "" });
    }
  };

  const removeHolding = (id: string) => {
    setHoldings(holdings.filter((h) => h.id !== id));
  };

  // Handle incoming WebSocket messages
  const handleMessage = (message: AlpacaMessage) => {
    if (message.type === "connected") {
      setIsConnected(true);
      console.log("Connected to ETFs stream:", message.message);
    } else if (message.type === "bar" && selectedHolding && message.data.symbol === selectedHolding.symbol) {
      setCurrentPrice(message.data.close);
      
      // Update chart with new data
      if (seriesRef.current) {
        const chartData = transformBarToChartData(message.data);
        seriesRef.current.update(chartData as any);
      }
    } else if (message.type === "error") {
      console.error("WebSocket error:", message.message);
      setIsConnected(false);
    }
  };

  // WebSocket connection disabled - only Bitcoin subscriptions allowed to avoid port issues
  // const { subscribe } = useAlpacaWebSocket({
  //   symbols: selectedHolding ? [selectedHolding.symbol] : [],
  //   dataType: "etfs",
  //   onMessage: handleMessage,
  //   autoConnect: true,
  // });

  useEffect(() => {
    if (!selectedHolding || !chartContainerRef.current) {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
      return;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#111113' },
        textColor: '#B0B4BA',
      },
      grid: {
        vertLines: { color: '#2B2D31' },
        horzLines: { color: '#2B2D31' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || Math.max(400, window.innerHeight * 0.4),
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      autoSize: true,
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    seriesRef.current = candlestickSeries;

    const generateData = () => {
      const data = [];
      const basePrice = parseFloat(selectedHolding.avgPrice.replace(/,/g, ''));
      let time = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30;
      
      for (let i = 0; i < 30; i++) {
        const random = Math.random();
        const change = (random - 0.5) * basePrice * 0.05;
        const open = basePrice + change;
        const close = open + (Math.random() - 0.5) * basePrice * 0.03;
        const high = Math.max(open, close) + Math.random() * basePrice * 0.02;
        const low = Math.min(open, close) - Math.random() * basePrice * 0.02;
        
        data.push({
          time: time as any,
          open: open,
          high: high,
          low: low,
          close: close,
        });
        
        time += 60 * 60 * 24;
      }
      return data;
    };

    candlestickSeries.setData(generateData());

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const width = chartContainerRef.current.clientWidth;
        const height = chartContainerRef.current.clientHeight || Math.max(400, window.innerHeight * 0.4);
        chartRef.current.applyOptions({ width, height });
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Also listen for zoom changes
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
  }, [selectedHolding]);

  if (selectedHolding) {
    return (
      <div className="h-full w-full overflow-y-auto" style={{ background: 'var(--slate-1)' }}>
        {/* Header with Back Button */}
        <div className="border-b px-6 py-4" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
          <Flex align="center" gap="3">
            <Button
              variant="soft"
              onClick={() => {
                if (onReturn) {
                  onReturn();
                } else {
                  setSelectedHolding(null);
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <ArrowLeftIcon /> Return
            </Button>
            <div>
              <Text size="8" weight="bold" style={{ color: 'var(--slate-12)' }}>
                {selectedHolding.symbol}
              </Text>
              <Text size="3" className="block" style={{ color: 'var(--slate-11)' }}>
                {selectedHolding.name}
              </Text>
            </div>
          </Flex>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 p-4 md:p-6 border-b" style={{ borderColor: 'var(--slate-6)', padding: 'clamp(1rem, 2vw, 1.5rem)', gap: 'clamp(0.5rem, 1vw, 1rem)' }}>
          <div>
            <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Shares</Text>
            <Text size="5" weight="bold" style={{ color: 'var(--slate-12)' }}>{selectedHolding.quantity}</Text>
          </div>
          <div>
            <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Avg Price</Text>
            <Text size="5" weight="bold" style={{ color: 'var(--slate-12)' }}>${selectedHolding.avgPrice}</Text>
          </div>
          <div>
            <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Current Price</Text>
            <Text size="5" weight="bold" style={{ color: currentPrice ? 'var(--green-11)' : 'var(--slate-11)' }}>
              {currentPrice ? `$${currentPrice.toLocaleString()}` : 'Loading...'}
            </Text>
            {isConnected && <Text size="1" style={{ color: 'var(--green-11)' }}>● Live</Text>}
          </div>
          <div>
            <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Total Value</Text>
            <Text size="5" weight="bold" style={{ color: 'var(--slate-12)' }}>
              ${currentPrice 
                ? (parseFloat(selectedHolding.quantity.replace(/,/g, '')) * currentPrice).toLocaleString()
                : (parseFloat(selectedHolding.quantity.replace(/,/g, '')) * parseFloat(selectedHolding.avgPrice.replace(/,/g, '')) * 1.08).toFixed(2)
              }
            </Text>
            <Text size="5" weight="bold" style={{ color: 'var(--slate-12)' }}>${(parseFloat(selectedHolding.quantity.replace(/,/g, '')) * parseFloat(selectedHolding.avgPrice.replace(/,/g, '')) * 1.08).toLocaleString()}</Text>
          </div>
        </div>

        {/* Chart */}
        <div className="p-4 md:p-6" style={{ padding: 'clamp(1rem, 2vw, 1.5rem)' }}>
          <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--slate-12)' }}>
            Live Price Chart {isConnected ? '(Connected to Alpaca)' : '(Connecting...)'}
          </Text>
          <div ref={chartContainerRef} className="w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto" style={{ background: 'var(--slate-1)' }}>
      {/* Header */}
      <div className="border-b px-6 py-4" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
        <Text size="8" weight="bold" style={{ color: 'var(--slate-12)' }}>
          ETF Holdings
        </Text>
      </div>

      {/* Add New Holding Form */}
      <div className="p-4 md:p-6 border-b" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)', padding: 'clamp(1rem, 2vw, 1.5rem)' }}>
        <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--slate-12)' }}>
          Add New Holding
        </Text>
        <Flex gap="3" align="end">
          <div className="flex-1">
            <Text size="2" className="mb-2 block" style={{ color: 'var(--slate-11)' }}>Symbol</Text>
            <TextField.Root
              placeholder="SPY"
              value={newHolding.symbol}
              onChange={(e) => setNewHolding({ ...newHolding, symbol: e.target.value })}
            />
          </div>
          <div className="flex-2">
            <Text size="2" className="mb-2 block" style={{ color: 'var(--slate-11)' }}>Name</Text>
            <TextField.Root
              placeholder="SPDR S&P 500 ETF"
              value={newHolding.name}
              onChange={(e) => setNewHolding({ ...newHolding, name: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <Text size="2" className="mb-2 block" style={{ color: 'var(--slate-11)' }}>Quantity</Text>
            <TextField.Root
              placeholder="100"
              value={newHolding.quantity}
              onChange={(e) => setNewHolding({ ...newHolding, quantity: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <Text size="2" className="mb-2 block" style={{ color: 'var(--slate-11)' }}>Avg Price</Text>
            <TextField.Root
              placeholder="450.00"
              value={newHolding.avgPrice}
              onChange={(e) => setNewHolding({ ...newHolding, avgPrice: e.target.value })}
            />
          </div>
          <Button onClick={addHolding} style={{ background: 'var(--blue-9)', cursor: 'pointer' }}>
            <PlusIcon /> Add
          </Button>
        </Flex>
      </div>

      {/* Holdings List */}
      <div className="p-4 md:p-6 flex flex-col" style={{ padding: 'clamp(1rem, 2vw, 1.5rem)', height: 'calc(100vh - 300px)' }}>
        <div className="space-y-2 flex-shrink-0">
          {/* Header Row */}
          <div className="grid grid-cols-[minmax(100px,150px)_2fr_minmax(100px,150px)_minmax(100px,150px)_minmax(60px,80px)] gap-2 md:gap-4 px-2 md:px-4 pb-2 border-b" style={{ borderColor: 'var(--slate-6)', gap: 'clamp(0.5rem, 1vw, 1rem)', paddingLeft: 'clamp(0.5rem, 1vw, 1rem)', paddingRight: 'clamp(0.5rem, 1vw, 1rem)' }}>
            <Text size="2" weight="bold" style={{ color: 'var(--slate-11)' }}>Symbol</Text>
            <Text size="2" weight="bold" style={{ color: 'var(--slate-11)' }}>Name</Text>
            <Text size="2" weight="bold" style={{ color: 'var(--slate-11)' }}>Quantity</Text>
            <Text size="2" weight="bold" style={{ color: 'var(--slate-11)' }}>Avg Price</Text>
            <Text size="2" weight="bold" style={{ color: 'var(--slate-11)' }}>Action</Text>
          </div>
        </div>
        
        {/* Scrollable Holdings Rows */}
        <div className="overflow-y-auto flex-1 mt-2">
          <div className="space-y-2">
            {holdings.map((holding) => (
            <div
              key={holding.id}
              className="grid grid-cols-[minmax(100px,150px)_2fr_minmax(100px,150px)_minmax(100px,150px)_minmax(60px,80px)] gap-2 md:gap-4 p-2 md:p-4 rounded cursor-pointer transition-colors"
              style={{ background: 'var(--slate-3)', gap: 'clamp(0.5rem, 1vw, 1rem)', padding: 'clamp(0.5rem, 1vw, 1rem)' }}
              onClick={() => setSelectedHolding(holding)}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--slate-4)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--slate-3)'}
            >
              <Text size="3" weight="bold" style={{ color: 'var(--slate-12)' }}>
                {holding.symbol}
              </Text>
              <Text size="3" style={{ color: 'var(--slate-11)' }}>
                {holding.name}
              </Text>
              <Text size="3" className="font-mono" style={{ color: 'var(--slate-12)' }}>
                {holding.quantity}
              </Text>
              <Text size="3" className="font-mono" style={{ color: 'var(--slate-12)' }}>
                ${holding.avgPrice}
              </Text>
              <Button
                variant="soft"
                color="red"
                onClick={(e) => {
                  e.stopPropagation();
                  removeHolding(holding.id);
                }}
                style={{ cursor: 'pointer' }}
              >
                <TrashIcon />
              </Button>
            </div>
          ))}
          </div>
        </div>
      </div>
    </div>
  );
}
