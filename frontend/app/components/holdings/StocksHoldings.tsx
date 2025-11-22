"use client";

import { useState, useEffect, useRef } from "react";
import { Flex, Text, Button, TextField } from "@radix-ui/themes";
import { PlusIcon, TrashIcon, ArrowLeftIcon } from "@radix-ui/react-icons";
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { useAlpacaWebSocket } from "@/hooks/useAlpacaWebSocket";
import type { AlpacaMessage } from "@/lib/websocket";
import { transformBarToChartData } from "@/lib/alpacaDataTransform";

type ChartType = "candlestick" | "bar" | "line" | "area" | "baseline" | "histogram";
type TimeFrame = "1m" | "5m" | "10m" | "15m" | "30m" | "1h" | "4h" | "1d";

interface Holding {
  id: string;
  symbol: string;
  name: string;
  quantity: string;
  avgPrice: string;
}

interface StocksHoldingsProps {
  initialSelectedHolding?: Holding | null;
  onReturn?: () => void;
}

export default function StocksHoldings({ initialSelectedHolding = null, onReturn }: StocksHoldingsProps = {}) {
  const [holdings, setHoldings] = useState<Holding[]>([
    { id: "1", symbol: "AAPL", name: "Apple Inc.", quantity: "150", avgPrice: "178.50" },
    { id: "2", symbol: "MSFT", name: "Microsoft Corporation", quantity: "85", avgPrice: "385.20" },
    { id: "3", symbol: "GOOGL", name: "Alphabet Inc.", quantity: "120", avgPrice: "142.30" },
    { id: "4", symbol: "AMZN", name: "Amazon.com Inc.", quantity: "95", avgPrice: "155.80" },
    { id: "5", symbol: "TSLA", name: "Tesla Inc.", quantity: "75", avgPrice: "242.50" },
    { id: "6", symbol: "NVDA", name: "NVIDIA Corporation", quantity: "110", avgPrice: "495.75" },
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
      if (holding.type === 'stocks') {
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
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("1m");
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1 = fit all, higher = zoomed in
  const dataPointsRef = useRef<Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>>([]);
  const hasInitialDataRef = useRef(false);

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

  // Normalize symbol for comparison
  const normalizeSymbol = (s: string): string => {
    return s.toUpperCase();
  };

  // Convert OHLC data to simple value data for line/area/baseline
  const convertToSimpleData = (data: typeof dataPointsRef.current) => {
    return data.map(dp => ({
      time: dp.time,
      value: dp.close
    }));
  };

  // Convert OHLC data to volume data for histogram
  const convertToVolumeData = (data: typeof dataPointsRef.current) => {
    return data.map(dp => ({
      time: dp.time,
      value: dp.volume || 0,
      color: dp.close >= dp.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'
    }));
  };

  // Handle incoming WebSocket messages
  const handleMessage = (message: AlpacaMessage) => {
    if (message.type === "connected") {
      setIsConnected(true);
      console.log("✅ Connected to stocks stream:", message.message);
    } else if (message.type === "bar" && selectedHolding) {
      const barData = message.data;
      const messageSymbol = normalizeSymbol(barData.symbol);
      const holdingSymbol = normalizeSymbol(selectedHolding.symbol);
      
      if (messageSymbol === holdingSymbol || barData.symbol === selectedHolding.symbol) {
        console.log(`📊 ${selectedHolding.symbol} received bar:`, barData);
        setCurrentPrice(barData.close);
        
        if (seriesRef.current) {
          const chartData = transformBarToChartData(barData);
          
          if (typeof chartData.time !== 'number' || isNaN(chartData.time)) {
            console.error('Invalid timestamp in bar data:', chartData.time);
            return;
          }
          
          // Check if we already have data for this exact timestamp (or very close - within 1 second)
          // This allows updating the same bar in real-time, but creates new bars for different time periods
          const existingIndex = dataPointsRef.current.findIndex(
            (dp) => Math.abs(dp.time - chartData.time) <= 1
          );
          
          if (existingIndex >= 0) {
            // Update existing data point (same timestamp - real-time update)
            dataPointsRef.current[existingIndex] = chartData;
            try {
              if (chartType === "candlestick" || chartType === "bar") {
                seriesRef.current.update(chartData as any);
              } else if (chartType === "histogram") {
                seriesRef.current.update({
                  time: chartData.time,
                  value: chartData.volume || 0,
                  color: chartData.close >= chartData.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'
                } as any);
              } else {
                seriesRef.current.update({ time: chartData.time, value: chartData.close } as any);
              }
            } catch (error) {
              console.warn('Failed to update existing bar:', error);
            }
          } else {
            // This is a new bar with a different timestamp - add it to the array
            if (!hasInitialDataRef.current) {
              // First data point - set initial data
              dataPointsRef.current = [chartData];
              // Set data based on chart type
              if (chartType === "candlestick" || chartType === "bar") {
                seriesRef.current.setData(dataPointsRef.current as any);
              } else if (chartType === "histogram") {
                seriesRef.current.setData(convertToVolumeData(dataPointsRef.current) as any);
              } else {
                seriesRef.current.setData(convertToSimpleData(dataPointsRef.current) as any);
              }
              hasInitialDataRef.current = true;
              chartRef.current?.timeScale().fitContent();
            } else {
              // Add new bar to the array
              dataPointsRef.current.push(chartData);
              
              // Keep only last 200 data points
              if (dataPointsRef.current.length > 200) {
                dataPointsRef.current.shift();
              }
              
              // Update the chart with the new bar
              try {
                if (chartType === "candlestick" || chartType === "bar") {
                  seriesRef.current.update(chartData as any);
                } else if (chartType === "histogram") {
                  seriesRef.current.update({
                    time: chartData.time,
                    value: chartData.volume || 0,
                    color: chartData.close >= chartData.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'
                  } as any);
                } else {
                  seriesRef.current.update({ time: chartData.time, value: chartData.close } as any);
                }
              } catch (error) {
                console.warn('Failed to update chart with new bar, resetting all data:', error);
                // If update fails, reset all data to ensure chart shows everything
                if (chartType === "candlestick" || chartType === "bar") {
                  seriesRef.current.setData(dataPointsRef.current as any);
                } else if (chartType === "histogram") {
                  seriesRef.current.setData(convertToVolumeData(dataPointsRef.current) as any);
                } else {
                  seriesRef.current.setData(convertToSimpleData(dataPointsRef.current) as any);
                }
              }
            }
          }
        }
      }
    } else if (message.type === "error") {
      console.error("❌ WebSocket error:", message.message);
      setIsConnected(false);
    }
  };

  // WebSocket connection for live prices
  const { subscribe } = useAlpacaWebSocket({
    symbols: selectedHolding ? [selectedHolding.symbol] : [],
    dataType: "stocks",
    onMessage: handleMessage,
    autoConnect: true,
  });

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

    // Initialize with candlestick series (will be changed by chartType effect)
    const initialSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    // Initialize with empty data - real-time data will populate it
    initialSeries.setData([]);

    seriesRef.current = initialSeries;
    
    // Reset data when switching holdings
    dataPointsRef.current = [];
    hasInitialDataRef.current = false;
    setCurrentPrice(null);

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

  // Update chart type
  useEffect(() => {
    if (!chartRef.current || !selectedHolding) return;
    
    // Don't switch chart type if we don't have a series yet (chart is still initializing)
    if (!seriesRef.current) return;

    // Remove existing series
    if (seriesRef.current) {
      chartRef.current.removeSeries(seriesRef.current);
    }

    let newSeries: ISeriesApi<any>;

    // Get current data and aggregate by time frame
    const rawData = dataPointsRef.current;
    const currentData = aggregateDataByTimeFrame(rawData, timeFrame);

    switch (chartType) {
      case "candlestick":
        newSeries = chartRef.current.addCandlestickSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderVisible: false,
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
        });
        if (currentData.length > 0) {
          newSeries.setData(currentData as any);
        }
        break;

      case "bar":
        newSeries = chartRef.current.addBarSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
        });
        if (currentData.length > 0) {
          newSeries.setData(currentData as any);
        }
        break;

      case "line":
        newSeries = chartRef.current.addLineSeries({
          color: '#2962FF',
          lineWidth: 2,
        });
        if (currentData.length > 0) {
          newSeries.setData(convertToSimpleData(currentData) as any);
        }
        break;

      case "area":
        newSeries = chartRef.current.addAreaSeries({
          lineColor: '#2962FF',
          topColor: 'rgba(41, 98, 255, 0.4)',
          bottomColor: 'rgba(41, 98, 255, 0.0)',
        });
        if (currentData.length > 0) {
          newSeries.setData(convertToSimpleData(currentData) as any);
        }
        break;

      case "baseline":
        const baseValue = currentData.length > 0 
          ? currentData[0].close 
          : currentPrice || parseFloat(selectedHolding.avgPrice.replace(/,/g, ''));
        newSeries = chartRef.current.addBaselineSeries({
          baseValue: { type: "price", price: baseValue },
          topLineColor: 'rgba(34, 197, 94, 1)',
          topFillColor1: 'rgba(34, 197, 94, 0.28)',
          topFillColor2: 'rgba(34, 197, 94, 0.05)',
          bottomLineColor: 'rgba(239, 68, 68, 1)',
          bottomFillColor1: 'rgba(239, 68, 68, 0.05)',
          bottomFillColor2: 'rgba(239, 68, 68, 0.28)',
        });
        if (currentData.length > 0) {
          newSeries.setData(convertToSimpleData(currentData) as any);
        }
        break;

      case "histogram":
        newSeries = chartRef.current.addHistogramSeries({
          color: '#22c55e',
          priceFormat: {
            type: "volume",
          },
        });
        if (currentData.length > 0) {
          newSeries.setData(convertToVolumeData(currentData) as any);
        }
        break;

      default:
        newSeries = chartRef.current.addCandlestickSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderVisible: false,
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
        });
        if (currentData.length > 0) {
          newSeries.setData(currentData as any);
        }
    }

    seriesRef.current = newSeries;
    
    // Only fit content if we have data
    if (currentData.length > 0) {
      chartRef.current.timeScale().fitContent();
    }
  }, [chartType, timeFrame, selectedHolding]);

  // Zoom controls
  const zoomIn = () => {
    if (!chartRef.current || !dataPointsRef.current.length) return;
    
    const aggregated = aggregateDataByTimeFrame(dataPointsRef.current, timeFrame);
    if (aggregated.length === 0) return;
    
    const timeScale = chartRef.current.timeScale();
    const visibleRange = timeScale.getVisibleRange();
    if (!visibleRange) {
      timeScale.fitContent();
      return;
    }
    
    const range = visibleRange.to - visibleRange.from;
    const center = visibleRange.from + range / 2;
    const newRange = range * 0.7; // Zoom in by 30%
    
    timeScale.setVisibleRange({
      from: center - newRange / 2,
      to: center + newRange / 2,
    });
    
    setZoomLevel(prev => prev + 1);
  };

  const zoomOut = () => {
    if (!chartRef.current || !dataPointsRef.current.length) return;
    
    const aggregated = aggregateDataByTimeFrame(dataPointsRef.current, timeFrame);
    if (aggregated.length === 0) return;
    
    const timeScale = chartRef.current.timeScale();
    const visibleRange = timeScale.getVisibleRange();
    if (!visibleRange) {
      timeScale.fitContent();
      return;
    }
    
    const range = visibleRange.to - visibleRange.from;
    const center = visibleRange.from + range / 2;
    const totalRange = aggregated[aggregated.length - 1].time - aggregated[0].time;
    const newRange = Math.min(range * 1.4, totalRange); // Zoom out by 40%, but not more than all data
    
    const from = Math.max(aggregated[0].time, center - newRange / 2);
    const to = Math.min(aggregated[aggregated.length - 1].time, center + newRange / 2);
    
    timeScale.setVisibleRange({
      from,
      to,
    });
    
    setZoomLevel(prev => Math.max(1, prev - 1));
  };

  const fitContent = () => {
    if (!chartRef.current || !dataPointsRef.current.length) return;
    chartRef.current.timeScale().fitContent();
    setZoomLevel(1);
  };

  const showLastPeriod = (seconds: number) => {
    if (!chartRef.current || !dataPointsRef.current.length) return;
    
    const aggregated = aggregateDataByTimeFrame(dataPointsRef.current, timeFrame);
    if (aggregated.length === 0) return;
    
    const now = aggregated[aggregated.length - 1].time;
    const from = Math.max(aggregated[0].time, now - seconds);
    
    chartRef.current.timeScale().setVisibleRange({
      from,
      to: now,
    });
    
    setZoomLevel(1);
  };

  // Update chart type
  useEffect(() => {
    if (!chartRef.current || !hasInitialDataRef.current || !selectedHolding) return;

    // Remove existing series
    if (seriesRef.current) {
      chartRef.current.removeSeries(seriesRef.current);
    }

    let newSeries: ISeriesApi<any>;

    switch (chartType) {
      case "candlestick":
        newSeries = chartRef.current.addCandlestickSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderVisible: false,
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
        });
        newSeries.setData(dataPointsRef.current as any);
        break;

      case "bar":
        newSeries = chartRef.current.addBarSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
        });
        newSeries.setData(dataPointsRef.current as any);
        break;

      case "line":
        newSeries = chartRef.current.addLineSeries({
          color: '#2962FF',
          lineWidth: 2,
        });
        newSeries.setData(convertToSimpleData(dataPointsRef.current) as any);
        break;

      case "area":
        newSeries = chartRef.current.addAreaSeries({
          lineColor: '#2962FF',
          topColor: 'rgba(41, 98, 255, 0.4)',
          bottomColor: 'rgba(41, 98, 255, 0.0)',
        });
        newSeries.setData(convertToSimpleData(dataPointsRef.current) as any);
        break;

      case "baseline":
        const baseValue = dataPointsRef.current.length > 0 
          ? dataPointsRef.current[0].close 
          : currentPrice || parseFloat(selectedHolding.avgPrice.replace(/,/g, ''));
        newSeries = chartRef.current.addBaselineSeries({
          baseValue: { type: "price", price: baseValue },
          topLineColor: 'rgba(34, 197, 94, 1)',
          topFillColor1: 'rgba(34, 197, 94, 0.28)',
          topFillColor2: 'rgba(34, 197, 94, 0.05)',
          bottomLineColor: 'rgba(239, 68, 68, 1)',
          bottomFillColor1: 'rgba(239, 68, 68, 0.05)',
          bottomFillColor2: 'rgba(239, 68, 68, 0.28)',
        });
        newSeries.setData(convertToSimpleData(dataPointsRef.current) as any);
        break;

      case "histogram":
        newSeries = chartRef.current.addHistogramSeries({
          color: '#22c55e',
          priceFormat: {
            type: "volume",
          },
        });
        newSeries.setData(convertToVolumeData(dataPointsRef.current) as any);
        break;

      default:
        newSeries = chartRef.current.addCandlestickSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderVisible: false,
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
        });
        newSeries.setData(dataPointsRef.current as any);
    }

    seriesRef.current = newSeries;
    chartRef.current.timeScale().fitContent();
  }, [chartType, selectedHolding, currentPrice]);

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
                : (parseFloat(selectedHolding.quantity.replace(/,/g, '')) * parseFloat(selectedHolding.avgPrice.replace(/,/g, '')) * 1.12).toFixed(2)
              }
            </Text>
            <Text size="5" weight="bold" style={{ color: 'var(--slate-12)' }}>${(parseFloat(selectedHolding.quantity.replace(/,/g, '')) * parseFloat(selectedHolding.avgPrice.replace(/,/g, '')) * 1.12).toLocaleString()}</Text>
          </div>
        </div>

        {/* Chart */}
        <div className="p-4 md:p-6" style={{ padding: 'clamp(1rem, 2vw, 1.5rem)' }}>
          <div className="flex items-center justify-between mb-4">
            <Text size="3" weight="bold" style={{ color: 'var(--slate-12)' }}>
              Live Price Chart
            </Text>
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: isConnected ? "var(--green-9)" : "var(--red-9)",
                }}
              />
              <Text size="2" style={{ color: 'var(--slate-11)' }}>
                {isConnected ? 'Live' : 'Connecting...'}
              </Text>
            </div>
          </div>
          <div ref={chartContainerRef} className="w-full mb-4" style={{ minHeight: 'min(40vh, 500px)', height: 'min(40vh, 500px)' }} />
          
          {/* Chart Type and Time Frame Selectors */}
          <div className="flex flex-col gap-4 mt-4">
            {/* Chart Type Selector */}
            <div className="flex flex-wrap gap-2 items-center">
              <Text size="2" weight="medium" style={{ color: 'var(--slate-11)', marginRight: '8px' }}>
                Chart Type:
              </Text>
              {(["candlestick", "bar", "line", "area", "baseline", "histogram"] as ChartType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    chartType === type
                      ? "bg-blue-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                  style={{
                    backgroundColor: chartType === type ? "var(--blue-9)" : "var(--slate-7)",
                    color: chartType === type ? "white" : "var(--slate-11)",
                  }}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
            
            {/* Time Frame Selector */}
            <div className="flex flex-wrap gap-2 items-center">
              <Text size="2" weight="medium" style={{ color: 'var(--slate-11)', marginRight: '8px' }}>
                Time Frame:
              </Text>
              {(["1m", "5m", "10m", "15m", "30m", "1h", "4h", "1d"] as TimeFrame[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeFrame(tf)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    timeFrame === tf
                      ? "bg-green-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                  style={{
                    backgroundColor: timeFrame === tf ? "var(--green-9)" : "var(--slate-7)",
                    color: timeFrame === tf ? "white" : "var(--slate-11)",
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>
            
            {/* Zoom Controls */}
            <div className="flex flex-wrap gap-2 items-center">
              <Text size="2" weight="medium" style={{ color: 'var(--slate-11)', marginRight: '8px' }}>
                Zoom:
              </Text>
              <button
                onClick={zoomOut}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-slate-700 text-slate-300 hover:bg-slate-600"
                style={{
                  backgroundColor: "var(--slate-7)",
                  color: "var(--slate-11)",
                }}
                title="Zoom Out"
              >
                −
              </button>
              <button
                onClick={fitContent}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-slate-700 text-slate-300 hover:bg-slate-600"
                style={{
                  backgroundColor: "var(--slate-7)",
                  color: "var(--slate-11)",
                }}
                title="Fit All"
              >
                Fit All
              </button>
              <button
                onClick={zoomIn}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-slate-700 text-slate-300 hover:bg-slate-600"
                style={{
                  backgroundColor: "var(--slate-7)",
                  color: "var(--slate-11)",
                }}
                title="Zoom In"
              >
                +
              </button>
              <div className="h-6 w-px bg-slate-600 mx-1" />
              <button
                onClick={() => showLastPeriod(3600)}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-slate-700 text-slate-300 hover:bg-slate-600"
                style={{
                  backgroundColor: "var(--slate-7)",
                  color: "var(--slate-11)",
                }}
                title="Show Last 1 Hour"
              >
                Last 1h
              </button>
              <button
                onClick={() => showLastPeriod(14400)}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-slate-700 text-slate-300 hover:bg-slate-600"
                style={{
                  backgroundColor: "var(--slate-7)",
                  color: "var(--slate-11)",
                }}
                title="Show Last 4 Hours"
              >
                Last 4h
              </button>
              <button
                onClick={() => showLastPeriod(86400)}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-slate-700 text-slate-300 hover:bg-slate-600"
                style={{
                  backgroundColor: "var(--slate-7)",
                  color: "var(--slate-11)",
                }}
                title="Show Last 1 Day"
              >
                Last 1d
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto" style={{ background: 'var(--slate-1)' }}>
      {/* Header */}
      <div className="border-b px-6 py-4" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
        <Text size="8" weight="bold" style={{ color: 'var(--slate-12)' }}>
          Stock Holdings
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
              placeholder="AAPL"
              value={newHolding.symbol}
              onChange={(e) => setNewHolding({ ...newHolding, symbol: e.target.value })}
            />
          </div>
          <div className="flex-2">
            <Text size="2" className="mb-2 block" style={{ color: 'var(--slate-11)' }}>Name</Text>
            <TextField.Root
              placeholder="Apple Inc."
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
              placeholder="150.00"
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
          <div className="grid grid-cols-[150px_2fr_150px_150px_80px] gap-4 px-4 pb-2 border-b" style={{ borderColor: 'var(--slate-6)' }}>
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
