"use client";

import { useState, useEffect, useRef } from "react";
import { Flex, Text, Button, TextField } from "@radix-ui/themes";
import { PlusIcon, TrashIcon, ArrowLeftIcon } from "@radix-ui/react-icons";
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { useAlpacaWebSocket } from "@/hooks/useAlpacaWebSocket";
import type { AlpacaMessage } from "@/lib/websocket";
import { transformBarToChartData } from "@/lib/alpacaDataTransform";
import PolymarketPanel from "../PolymarketPanel";
import TargetPanel from "../TargetPanel";
import { DropdownMenu, ChevronDownIcon } from "@radix-ui/themes";
import { motion, AnimatePresence } from "framer-motion";
import { api, type RedditPost, type SentimentStats } from "@/app/lib/api";

type ChartType = "candlestick" | "bar" | "line" | "area" | "baseline" | "histogram";
type TimeFrame = "1m" | "5m" | "10m" | "15m" | "30m" | "1h" | "4h" | "1d";

const subredditOptions = [
  "All",
  "r/Polymarket",
  "r/PredictionMarket",
  "r/wallstreetbets",
  "r/pennystocks",
  "r/cryptocurrency",
  "r/daytrading",
] as const;

type SubredditOption = typeof subredditOptions[number];

interface Holding {
  id: string;
  symbol: string;
  name: string;
  quantity: string;
  avgPrice: string;
  type?: "crypto" | "stocks" | "options" | "etfs";
}

interface CryptoHoldingsProps {
  initialSelectedHolding?: Holding | null;
  onReturn?: () => void;
}

export default function CryptoHoldings({ initialSelectedHolding = null, onReturn }: CryptoHoldingsProps = {}) {
  const [holdings, setHoldings] = useState<Holding[]>([
    { id: "1", symbol: "BTC", name: "Bitcoin", quantity: "2.5", avgPrice: "42,350" },
    { id: "2", symbol: "ETH", name: "Ethereum", quantity: "18.3", avgPrice: "2,245" },
    { id: "3", symbol: "SOL", name: "Solana", quantity: "150", avgPrice: "98.50" },
    { id: "4", symbol: "ADA", name: "Cardano", quantity: "5,000", avgPrice: "0.58" },
    { id: "5", symbol: "AVAX", name: "Avalanche", quantity: "85", avgPrice: "35.20" },
    { id: "6", symbol: "MATIC", name: "Polygon", quantity: "3,200", avgPrice: "0.92" },
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
      // Only select if it's a crypto holding
      if (holding.type === 'crypto' || !holding.type) {
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
  const [agentExpanded, setAgentExpanded] = useState(false);
  const [sentimentExpanded, setSentimentExpanded] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "agent" as const, text: "Hey trader! I'm watching BTC/USD for you. Ask me anything about the markets! 💹", time: "14:30:12" },
  ]);
  const [selectedSubreddit, setSelectedSubreddit] = useState<SubredditOption>("All");
  const [subredditDropdownOpen, setSubredditDropdownOpen] = useState(false);
  
  // API Data States
  const [redditPosts, setRedditPosts] = useState<RedditPost[]>([]);
  const [sentimentStats, setSentimentStats] = useState<SentimentStats | null>(null);
  const [loadingReddit, setLoadingReddit] = useState(true);
  const [loadingSentiment, setLoadingSentiment] = useState(true);

  // Fetch Reddit posts
  useEffect(() => {
    const fetchReddit = async () => {
      try {
        const posts = await api.getReddit(selectedSubreddit);
        setRedditPosts(Array.isArray(posts) ? posts : []);
      } catch (error) {
        console.error("Failed to fetch Reddit posts:", error);
        setRedditPosts([]);
      } finally {
        setLoadingReddit(false);
      }
    };

    fetchReddit();
    const interval = setInterval(fetchReddit, 10000);
    return () => clearInterval(interval);
  }, [selectedSubreddit]);

  // Fetch Sentiment stats
  useEffect(() => {
    const fetchSentiment = async () => {
      try {
        const stats = await api.getSentiment();
        setSentimentStats(stats);
      } catch (error) {
        console.error("Failed to fetch sentiment:", error);
      } finally {
        setLoadingSentiment(false);
      }
    };

    fetchSentiment();
    const interval = setInterval(fetchSentiment, 5000);
    return () => clearInterval(interval);
  }, []);

  // Reset sentiment panel when subreddit changes
  useEffect(() => {
    setSentimentExpanded(false);
  }, [selectedSubreddit]);
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
    let normalized = s.replace("/USD", "").replace("/", "");
    if (normalized.endsWith("USD")) {
      normalized = normalized.slice(0, -3);
    }
    return normalized.toUpperCase();
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

  // Get time frame in seconds
  const getTimeFrameSeconds = (tf: TimeFrame): number => {
    switch (tf) {
      case "1m": return 60;
      case "5m": return 300;
      case "10m": return 600;
      case "15m": return 900;
      case "30m": return 1800;
      case "1h": return 3600;
      case "4h": return 14400;
      case "1d": return 86400;
      default: return 60;
    }
  };

  // Aggregate data points into the selected time frame
  const aggregateDataByTimeFrame = (data: typeof dataPointsRef.current, tf: TimeFrame): typeof dataPointsRef.current => {
    if (data.length === 0) return [];
    
    const timeFrameSeconds = getTimeFrameSeconds(tf);
    const aggregated: typeof dataPointsRef.current = [];
    const grouped = new Map<number, typeof dataPointsRef.current>();

    // Group data points by time frame bucket
    for (const point of data) {
      // Round down to the nearest time frame interval
      const bucketTime = Math.floor(point.time / timeFrameSeconds) * timeFrameSeconds;
      
      if (!grouped.has(bucketTime)) {
        grouped.set(bucketTime, []);
      }
      grouped.get(bucketTime)!.push(point);
    }

    // Aggregate each group into OHLC bars
    for (const [bucketTime, points] of grouped.entries()) {
      if (points.length === 0) continue;

      // Sort points by time to ensure correct order
      points.sort((a, b) => a.time - b.time);

      const open = points[0].open;
      const close = points[points.length - 1].close;
      const high = Math.max(...points.map(p => p.high));
      const low = Math.min(...points.map(p => p.low));
      const volume = points.reduce((sum, p) => sum + (p.volume || 0), 0);

      aggregated.push({
        time: bucketTime,
        open,
        high,
        low,
        close,
        volume
      });
    }

    // Sort by time
    aggregated.sort((a, b) => a.time - b.time);
    return aggregated;
  };

  // Handle incoming WebSocket messages
  const handleMessage = (message: AlpacaMessage) => {
    if (message.type === "connected") {
      setIsConnected(true);
      console.log(`✅ Connected to crypto stream:`, message.message);
    } else if (message.type === "subscribed") {
      console.log(`✅ Subscribed to symbols:`, message.symbols);
    } else if (message.type === "bar" && selectedHolding) {
      const barData = message.data;
      const messageSymbol = normalizeSymbol(barData.symbol);
      const holdingSymbol = normalizeSymbol(selectedHolding.symbol);
      
      // Check if this message is for the selected holding
      if (messageSymbol === holdingSymbol || barData.symbol === selectedHolding.symbol) {
        console.log(`📊 ${selectedHolding.symbol} received bar:`, barData);
        setCurrentPrice(barData.close);
      
      // Update chart with new data
      if (seriesRef.current) {
          const chartData = transformBarToChartData(barData);
          
          // Ensure time is a number
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
              // Update based on chart type
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
            // Add new data point
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
              // This is a new bar with a different timestamp - add it to the array
              dataPointsRef.current.push(chartData);
              
              // Keep only last 200 data points
              if (dataPointsRef.current.length > 200) {
                dataPointsRef.current.shift();
              }
              
              // Update the chart with the new bar
              try {
                // Update based on chart type
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
    } else if (message.type === "trade" && selectedHolding) {
      const tradeData = message.data;
      const messageSymbol = normalizeSymbol(tradeData.symbol);
      const holdingSymbol = normalizeSymbol(selectedHolding.symbol);
      
      if (messageSymbol === holdingSymbol || tradeData.symbol === selectedHolding.symbol) {
        setCurrentPrice(tradeData.price);
        
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
            // Update based on chart type
            if (chartType === "candlestick" || chartType === "bar") {
              seriesRef.current.update(dataPointsRef.current[recentBarIndex] as any);
            } else if (chartType === "histogram") {
              const updated = dataPointsRef.current[recentBarIndex];
              seriesRef.current.update({
                time: updated.time,
                value: updated.volume || 0,
                color: updated.close >= updated.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'
              } as any);
            } else {
              seriesRef.current.update({ 
                time: dataPointsRef.current[recentBarIndex].time, 
                value: dataPointsRef.current[recentBarIndex].close 
              } as any);
            }
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
            // Update based on chart type
            if (chartType === "candlestick" || chartType === "bar") {
              seriesRef.current.update(dataPointsRef.current[dataPointsRef.current.length - 1] as any);
            } else if (chartType === "histogram") {
              const updated = dataPointsRef.current[dataPointsRef.current.length - 1];
              seriesRef.current.update({
                time: updated.time,
                value: updated.volume || 0,
                color: updated.close >= updated.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'
              } as any);
            } else {
              seriesRef.current.update({ 
                time: dataPointsRef.current[dataPointsRef.current.length - 1].time, 
                value: dataPointsRef.current[dataPointsRef.current.length - 1].close 
              } as any);
            }
          }
        }
      }
    } else if (message.type === "error") {
      console.error("❌ WebSocket error:", message.message);
      setIsConnected(false);
    }
  };

  // WebSocket connection for live prices - automatically subscribes/unsubscribes when selectedHolding changes
  useAlpacaWebSocket({
    symbols: selectedHolding ? [selectedHolding.symbol] : [],
    dataType: "crypto",
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
      // Reset data when no holding is selected
      dataPointsRef.current = [];
      hasInitialDataRef.current = false;
      setCurrentPrice(null);
      return;
    }

    // Reset data when switching holdings
    dataPointsRef.current = [];
    hasInitialDataRef.current = false;
    setCurrentPrice(null);

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
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [selectedHolding]);

  // Update chart type and time frame
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

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    
    const userMessage = {
      role: "user" as const,
      text: messageInput,
      time: new Date().toLocaleTimeString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    const currentInput = messageInput;
    setMessageInput("");
    
    // Simulate agent response (replace with actual API call later)
    setTimeout(() => {
      const agentResponse = {
        role: "agent" as const,
        text: `I understand you're asking about "${currentInput}". Let me analyze the current market conditions for ${selectedHolding?.symbol || "BTC"}...`,
        time: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, agentResponse]);
    }, 1000);
  };

  // Initialize messages when holding is selected
  useEffect(() => {
    if (selectedHolding && messages.length === 0) {
      setMessages([{
        role: "agent",
        text: `Hey trader! I'm watching ${selectedHolding.symbol} for you. Ask me anything about the markets! 💹`,
        time: new Date().toLocaleTimeString()
      }]);
    }
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
            <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Quantity</Text>
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
                : (parseFloat(selectedHolding.quantity.replace(/,/g, '')) * parseFloat(selectedHolding.avgPrice.replace(/,/g, '')) * 1.15).toLocaleString()
              }
            </Text>
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
          
          {/* Chart Controls - Single Line */}
          <div className="flex flex-wrap items-center gap-2 mb-4" style={{ gap: 'clamp(0.5rem, 1vw, 0.75rem)' }}>
            {/* Chart Type */}
            <div className="flex items-center gap-1" style={{ gap: 'clamp(0.25rem, 0.5vw, 0.5rem)' }}>
              <Text size="2" weight="medium" style={{ color: 'var(--slate-11)', fontSize: 'clamp(0.75rem, 1vw, 0.875rem)' }}>
                Chart Type:
              </Text>
              {(["candlestick", "bar", "line", "area", "baseline", "histogram"] as ChartType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className="rounded-md font-medium transition-colors"
                  style={{
                    padding: 'clamp(0.375rem, 0.75vw, 0.5rem) clamp(0.75rem, 1.5vw, 1rem)',
                    fontSize: 'clamp(0.75rem, 1vw, 0.875rem)',
                    backgroundColor: chartType === type ? "var(--blue-9)" : "var(--slate-7)",
                    color: chartType === type ? "white" : "var(--slate-11)",
                  }}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
            
            {/* Separator */}
            <div className="bg-slate-600" style={{ height: 'clamp(1rem, 1.5vw, 1.5rem)', width: '1px' }} />
            
            {/* Time Frame */}
            <div className="flex items-center gap-1" style={{ gap: 'clamp(0.25rem, 0.5vw, 0.5rem)' }}>
              <Text size="2" weight="medium" style={{ color: 'var(--slate-11)', fontSize: 'clamp(0.75rem, 1vw, 0.875rem)' }}>
                Time Frame:
              </Text>
              {(["1m", "5m", "10m", "15m", "30m", "1h", "4h", "1d"] as TimeFrame[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeFrame(tf)}
                  className="rounded-md font-medium transition-colors"
                  style={{
                    padding: 'clamp(0.375rem, 0.75vw, 0.5rem) clamp(0.75rem, 1.5vw, 1rem)',
                    fontSize: 'clamp(0.75rem, 1vw, 0.875rem)',
                    backgroundColor: timeFrame === tf ? "var(--green-9)" : "var(--slate-7)",
                    color: timeFrame === tf ? "white" : "var(--slate-11)",
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>
            
            {/* Separator */}
            <div className="bg-slate-600" style={{ height: 'clamp(1rem, 1.5vw, 1.5rem)', width: '1px' }} />
            
            {/* Zoom Controls */}
            <div className="flex items-center gap-1" style={{ gap: 'clamp(0.25rem, 0.5vw, 0.5rem)' }}>
              <Text size="2" weight="medium" style={{ color: 'var(--slate-11)', fontSize: 'clamp(0.75rem, 1vw, 0.875rem)' }}>
                Zoom:
              </Text>
              <button
                onClick={zoomOut}
                className="rounded-md font-medium transition-colors"
                style={{
                  padding: 'clamp(0.375rem, 0.75vw, 0.5rem) clamp(0.75rem, 1.5vw, 1rem)',
                  fontSize: 'clamp(0.75rem, 1vw, 0.875rem)',
                  backgroundColor: "var(--slate-7)",
                  color: "var(--slate-11)",
                }}
                title="Zoom Out"
              >
                −
              </button>
              <button
                onClick={fitContent}
                className="rounded-md font-medium transition-colors"
                style={{
                  padding: 'clamp(0.375rem, 0.75vw, 0.5rem) clamp(0.75rem, 1.5vw, 1rem)',
                  fontSize: 'clamp(0.75rem, 1vw, 0.875rem)',
                  backgroundColor: "var(--slate-7)",
                  color: "var(--slate-11)",
                }}
                title="Fit All"
              >
                Fit All
              </button>
              <button
                onClick={zoomIn}
                className="rounded-md font-medium transition-colors"
                style={{
                  padding: 'clamp(0.375rem, 0.75vw, 0.5rem) clamp(0.75rem, 1.5vw, 1rem)',
                  fontSize: 'clamp(0.75rem, 1vw, 0.875rem)',
                  backgroundColor: "var(--slate-7)",
                  color: "var(--slate-11)",
                }}
                title="Zoom In"
              >
                +
              </button>
              <div className="bg-slate-600" style={{ height: 'clamp(1rem, 1.5vw, 1.5rem)', width: '1px', marginLeft: 'clamp(0.25rem, 0.5vw, 0.5rem)' }} />
              <button
                onClick={() => showLastPeriod(3600)}
                className="rounded-md font-medium transition-colors"
                style={{
                  padding: 'clamp(0.375rem, 0.75vw, 0.5rem) clamp(0.75rem, 1.5vw, 1rem)',
                  fontSize: 'clamp(0.75rem, 1vw, 0.875rem)',
                  backgroundColor: "var(--slate-7)",
                  color: "var(--slate-11)",
                }}
                title="Show Last 1 Hour"
              >
                Last 1h
              </button>
              <button
                onClick={() => showLastPeriod(14400)}
                className="rounded-md font-medium transition-colors"
                style={{
                  padding: 'clamp(0.375rem, 0.75vw, 0.5rem) clamp(0.75rem, 1.5vw, 1rem)',
                  fontSize: 'clamp(0.75rem, 1vw, 0.875rem)',
                  backgroundColor: "var(--slate-7)",
                  color: "var(--slate-11)",
                }}
                title="Show Last 4 Hours"
              >
                Last 4h
              </button>
              <button
                onClick={() => showLastPeriod(86400)}
                className="rounded-md font-medium transition-colors"
                style={{
                  padding: 'clamp(0.375rem, 0.75vw, 0.5rem) clamp(0.75rem, 1.5vw, 1rem)',
                  fontSize: 'clamp(0.75rem, 1vw, 0.875rem)',
                  backgroundColor: "var(--slate-7)",
                  color: "var(--slate-11)",
                }}
                title="Show Last 1 Day"
              >
                Last 1d
              </button>
            </div>
          </div>

          {/* Panels Layout: Target (left) | Two Panels (center) */}
          <div className="grid gap-4" style={{ 
            gridTemplateColumns: 'minmax(300px, 1fr) minmax(500px, 2fr)',
            gap: 'clamp(0.75rem, 1.5vw, 1rem)',
            minHeight: 'min(30vh, 300px)'
          }}>
            {/* Left: Target Panel */}
            <div className="flex flex-col" style={{ minHeight: 'min(30vh, 300px)' }}>
              <TargetPanel issues={8} />
            </div>
            
            {/* Center: Two Panels Side by Side */}
            <div className="grid grid-cols-2 gap-0" style={{ borderLeft: '1px solid var(--slate-6)' }}>
              <div className="flex flex-col border-r" style={{ borderColor: 'var(--slate-6)', minHeight: 'min(30vh, 300px)' }}>
                <PolymarketPanel />
              </div>
              <div className="flex flex-col" style={{ minHeight: 'min(30vh, 300px)' }}>
                {/* Social Sentiment Panel - Inline from main page */}
                <div
                  className="p-3 flex flex-col cursor-pointer h-full"
                  style={{ background: 'var(--slate-2)' }}
                  onClick={() => setSentimentExpanded(!sentimentExpanded)}
                >
                  <Flex justify="between" align="center" className="mb-2">
                    <Flex align="center" gap="1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--blue-9)' }}></div>
                      <Text size="1" weight="bold" className="uppercase tracking-wider" style={{ color: 'var(--slate-12)' }}>
                        POLYMARKET SOCIAL SENTIMENT
                      </Text>
                    </Flex>
                    <DropdownMenu.Root
                      open={subredditDropdownOpen}
                      onOpenChange={(open) => {
                        setSubredditDropdownOpen(open);
                        if (open) setSentimentExpanded(false);
                      }}
                    >
                      <DropdownMenu.Trigger>
                        <Button
                          variant="ghost"
                          color="blue"
                          size="1"
                          radius="full"
                          onClick={(e) => e.stopPropagation()}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', paddingInline: '0.75rem' }}
                        >
                          <Text size="1" weight="medium" style={{ color: 'var(--blue-11)' }}>
                            {selectedSubreddit}
                          </Text>
                          <ChevronDownIcon width="12" height="12" style={{ color: 'var(--blue-11)' }} />
                        </Button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content
                        side="top"
                        align="end"
                        sideOffset={6}
                        collisionPadding={8}
                        variant="soft"
                        color="blue"
                        size="1"
                        style={{ maxHeight: '130px', overflowY: 'auto', minWidth: '190px' }}
                      >
                        {subredditOptions.map((option) => (
                          <DropdownMenu.Item
                            key={option}
                            onSelect={() => {
                              setSelectedSubreddit(option);
                              setSentimentExpanded(false);
                              setSubredditDropdownOpen(false);
                            }}
                            className="cursor-pointer"
                            style={{
                              fontWeight: option === selectedSubreddit ? 600 : 400,
                              color: option === selectedSubreddit ? 'var(--blue-12)' : 'var(--slate-12)'
                            }}
                          >
                            {option}
                          </DropdownMenu.Item>
                        ))}
                      </DropdownMenu.Content>
                    </DropdownMenu.Root>
                  </Flex>

                  {!sentimentExpanded ? (
                    <div className="flex-1 flex flex-col justify-start px-2">
                      {loadingSentiment || !sentimentStats ? (
                        <Text size="1" style={{ color: 'var(--slate-11)' }}>Loading...</Text>
                      ) : (
                        <Flex direction="column" gap="2" className="mt-2">
                          <div>
                            <Text size="1" className="block" style={{ color: 'var(--slate-11)', marginBottom: '0.15rem' }}>Bullish/Bearish Ratio</Text>
                            <Flex align="baseline" gap="1">
                              <Text size="5" weight="bold" className="font-mono" style={{ color: 'var(--green-11)' }}>{sentimentStats.bullish ?? 0}</Text>
                              <Text size="2" style={{ color: 'var(--slate-11)' }}>/</Text>
                              <Text size="5" weight="bold" className="font-mono" style={{ color: 'var(--red-10)' }}>{sentimentStats.bearish ?? 0}</Text>
                            </Flex>
                          </div>
                          <div>
                            <Text size="1" className="block" style={{ color: 'var(--slate-11)', marginBottom: '0.15rem' }}>Sentiment Score</Text>
                            <Text size="4" weight="bold" className="font-mono" style={{ color: (sentimentStats.score ?? 0) >= 0 ? 'var(--green-11)' : 'var(--red-10)' }}>
                              {(sentimentStats.score ?? 0) > 0 ? `+${sentimentStats.score}` : `${sentimentStats.score}`}
                            </Text>
                          </div>
                          <div>
                            <Text size="1" className="block" style={{ color: 'var(--slate-11)', marginBottom: '0.15rem' }}>Post Volume (24h)</Text>
                            <Text size="4" weight="bold" className="font-mono" style={{ color: 'var(--slate-12)' }}>{sentimentStats.volume || "0"}</Text>
                          </div>
                        </Flex>
                      )}
                    </div>
                  ) : (
                    <div
                      className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin"
                      style={{ maxHeight: '200px', marginTop: sentimentExpanded ? 0 : '0.5rem' }}
                    >
                      {loadingReddit ? (
                        <Text size="1" style={{ color: 'var(--slate-11)' }}>Loading posts...</Text>
                      ) : redditPosts.length === 0 ? (
                        <Text size="1" style={{ color: 'var(--slate-11)' }}>No posts available</Text>
                      ) : (
                        redditPosts.map((post, idx) => (
                          <a
                            key={idx}
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-2 border rounded"
                            style={{ background: 'var(--slate-4)', borderColor: 'var(--slate-6)', textDecoration: 'none' }}
                          >
                            <Flex justify="between" className="mb-1">
                              <div>
                                <Text size="1" weight="medium" style={{ color: 'var(--blue-11)' }}>{post.username}</Text>
                                {post.subreddit && (
                                  <Text size="1" className="block" style={{ color: 'var(--slate-10)' }}>{post.subreddit}</Text>
                                )}
                              </div>
                              <Text size="1" style={{ color: 'var(--slate-11)' }}>{post.posted_ago}</Text>
                            </Flex>
                            <Text size="1" className="leading-relaxed" style={{ color: 'var(--slate-12)' }}>
                              {post.text}
          </Text>
                            <div className="mt-1">
                              <span className={`text-xs px-1.5 py-0.5 rounded`} style={{
                                background: post.sentiment === 'bullish' ? 'var(--green-3)' : 'var(--red-4)',
                                color: post.sentiment === 'bullish' ? 'var(--green-11)' : 'var(--red-10)'
                              }}>
                                {post.sentiment}
                              </span>
                            </div>
                          </a>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Agent Modal - Inline from main page */}
        <AnimatePresence>
          {agentExpanded && (
            <>
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="fixed inset-0 z-50" 
                style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }} 
                onClick={() => setAgentExpanded(false)} 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 20 }} 
                transition={{ type: "spring", damping: 25, stiffness: 300 }} 
                className="fixed inset-0 z-50 flex items-center justify-center p-8" 
                onClick={() => setAgentExpanded(false)}
              >
                <div 
                  className="relative w-full max-w-2xl h-[600px] overflow-hidden rounded-lg shadow-2xl border" 
                  style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }} 
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.03), transparent, rgba(139, 92, 246, 0.03))' }}></div>
                  <div className="relative h-full flex flex-col">
                    <div className="p-4 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                      <Flex justify="between" align="center">
                        <Flex align="center" gap="3">
                          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl border-2 shadow-lg relative" style={{ background: 'linear-gradient(135deg, var(--red-9), var(--red-10))', borderColor: 'var(--red-7)' }}>
                            <span>🎯</span>
                          </div>
                          <div>
                            <Text size="4" weight="bold" style={{ color: 'var(--slate-12)' }}>Agent Divergence</Text>
                            <Flex align="center" gap="1">
                              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--green-9)' }}></div>
                              <Text size="1" weight="medium" style={{ color: 'var(--green-11)' }}>Online & Monitoring</Text>
                            </Flex>
                          </div>
                        </Flex>
                        <button 
                          className="w-8 h-8 flex items-center justify-center rounded-lg" 
                          onClick={() => setAgentExpanded(false)}
                          style={{ color: 'var(--slate-11)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--slate-4)';
                            e.currentTarget.style.color = 'var(--slate-12)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--slate-11)';
                          }}
                        >
                          <Text size="4">✕</Text>
                        </button>
                      </Flex>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className="max-w-[80%]">
                            <div className="px-4 py-2 rounded-lg" style={{ background: msg.role === 'agent' ? 'var(--slate-3)' : 'var(--red-9)', color: msg.role === 'agent' ? 'var(--slate-12)' : 'white' }}>
                              <Text size="2">{msg.text}</Text>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 border-t" style={{ borderColor: 'var(--slate-6)' }}>
                      <Flex gap="2">
                        <input 
                          type="text" 
                          placeholder="Ask me about the markets..." 
                          value={messageInput} 
                          onChange={(e) => setMessageInput(e.target.value)} 
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} 
                          className="flex-1 px-3 py-2 rounded-lg border outline-none" 
                          style={{ background: 'var(--slate-4)', borderColor: 'var(--slate-7)', color: 'var(--slate-12)' }} 
                        />
                        <Button onClick={handleSendMessage} style={{ background: 'var(--red-9)', color: 'white', cursor: 'pointer' }}>Send</Button>
                      </Flex>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto" style={{ background: 'var(--slate-1)' }}>
      {/* Header */}
      <div className="border-b px-6 py-4" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
        <Text size="8" weight="bold" style={{ color: 'var(--slate-12)' }}>
          Crypto Holdings
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
              placeholder="BTC"
              value={newHolding.symbol}
              onChange={(e) => setNewHolding({ ...newHolding, symbol: e.target.value })}
            />
          </div>
          <div className="flex-2">
            <Text size="2" className="mb-2 block" style={{ color: 'var(--slate-11)' }}>Name</Text>
            <TextField.Root
              placeholder="Bitcoin"
              value={newHolding.name}
              onChange={(e) => setNewHolding({ ...newHolding, name: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <Text size="2" className="mb-2 block" style={{ color: 'var(--slate-11)' }}>Quantity</Text>
            <TextField.Root
              placeholder="1.5"
              value={newHolding.quantity}
              onChange={(e) => setNewHolding({ ...newHolding, quantity: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <Text size="2" className="mb-2 block" style={{ color: 'var(--slate-11)' }}>Avg Price</Text>
            <TextField.Root
              placeholder="50,000"
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
              className="grid grid-cols-[150px_2fr_150px_150px_80px] gap-4 p-4 rounded cursor-pointer transition-colors"
              style={{ background: 'var(--slate-3)' }}
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
