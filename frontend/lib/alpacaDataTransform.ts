// Transform Alpaca data to lightweight-charts format

import type { AlpacaBar, AlpacaTrade } from './websocket';

export interface ChartDataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface LineChartDataPoint {
  time: number;
  value: number;
}

/**
 * Transform Alpaca bar data to lightweight-charts candlestick format
 * Lightweight-charts expects Unix timestamp in seconds
 */
export function transformBarToChartData(bar: AlpacaBar): ChartDataPoint {
  // Ensure timestamp is in seconds (not milliseconds)
  // If timestamp is in milliseconds, divide by 1000
  let timestamp: number;
  
  if (typeof bar.timestamp === 'number') {
    timestamp = bar.timestamp > 1e10 ? Math.floor(bar.timestamp / 1000) : bar.timestamp;
  } else if (typeof bar.timestamp === 'string') {
    timestamp = parseInt(bar.timestamp, 10);
    if (timestamp > 1e10) {
      timestamp = Math.floor(timestamp / 1000);
    }
  } else {
    // Fallback to current time if timestamp is invalid
    console.error('Invalid timestamp type:', typeof bar.timestamp, bar.timestamp);
    timestamp = Math.floor(Date.now() / 1000);
  }
  
  // Ensure timestamp is a valid number
  if (isNaN(timestamp) || !isFinite(timestamp)) {
    console.error('Invalid timestamp value:', bar.timestamp, 'converted to:', timestamp);
    timestamp = Math.floor(Date.now() / 1000);
  }
  
  return {
    time: timestamp,
    open: Number(bar.open),
    high: Number(bar.high),
    low: Number(bar.low),
    close: Number(bar.close),
    volume: bar.volume ? Number(bar.volume) : 0
  };
}

/**
 * Transform Alpaca trade data to lightweight-charts line format
 */
export function transformTradeToLineData(trade: AlpacaTrade): LineChartDataPoint {
  return {
    time: trade.timestamp,
    value: trade.price
  };
}

/**
 * Aggregate trades into OHLC bars for a given time period
 */
export class TradeAggregator {
  private trades: AlpacaTrade[] = [];
  private intervalMs: number;

  constructor(intervalSeconds: number = 60) {
    this.intervalMs = intervalSeconds * 1000;
  }

  addTrade(trade: AlpacaTrade) {
    this.trades.push(trade);
  }

  getBar(symbol: string): ChartDataPoint | null {
    if (this.trades.length === 0) return null;

    const prices = this.trades.map(t => t.price);
    const volumes = this.trades.map(t => t.size);
    
    // Use the timestamp of the last trade, floored to the interval
    const lastTimestamp = this.trades[this.trades.length - 1].timestamp;
    const flooredTimestamp = Math.floor(lastTimestamp / this.intervalMs) * this.intervalMs;

    return {
      time: flooredTimestamp,
      open: this.trades[0].price,
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: this.trades[this.trades.length - 1].price,
      volume: volumes.reduce((sum, vol) => sum + vol, 0)
    };
  }

  clear() {
    this.trades = [];
  }

  shouldFlush(currentTimestamp: number): boolean {
    if (this.trades.length === 0) return false;
    
    const firstTradeTime = this.trades[0].timestamp;
    return (currentTimestamp - firstTradeTime) >= this.intervalMs;
  }
}

/**
 * Format price for display
 */
export function formatPrice(price: number, decimals: number = 2): string {
  return price.toFixed(decimals);
}

/**
 * Format volume for display
 */
export function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) {
    return (volume / 1_000_000_000).toFixed(2) + 'B';
  } else if (volume >= 1_000_000) {
    return (volume / 1_000_000).toFixed(2) + 'M';
  } else if (volume >= 1_000) {
    return (volume / 1_000).toFixed(2) + 'K';
  }
  return volume.toString();
}

/**
 * Calculate price change percentage
 */
export function calculatePriceChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}
