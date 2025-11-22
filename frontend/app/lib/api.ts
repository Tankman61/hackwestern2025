"use client";

/**
 * API Service for VibeTrade Backend
 * All endpoints connect to FastAPI backend
 */

import { toast } from "react-hot-toast";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ==================== TYPES ====================

export interface RiskMonitorData {
  risk_level: {
    score: number;
    level: 'Low' | 'Medium' | 'High';
    summary: string;
  };
  market_overview: {
    btc_price: number;
    price_change_24h: number;
    volume_24h: string;
    price_range_24h: {
      low: number;
      high: number;
    };
  };
  technical: {
    rsi: number;
    macd: number;
  };
  watchlist: Array<{
    ticker: string;
    change: string;
  }>;
}

export interface PortfolioData {
  balance_usd: number;
  total_value: number;
  pnl_total: number;
  pnl_percent: number;
  is_locked: boolean;
  lock_reason?: string | null;
  lock_expires_at?: string | null;
}

export interface Position {
  id: string;
  ticker: string;
  side: 'LONG' | 'SHORT';
  amount: number;
  entry_price: number;
  current_price: number;
  pnl: number;
  pnl_percent: number;
}

export interface Order {
  id: string;
  ticker: string;
  order_type: string;
  amount: number;
  limit_price: number | null;
  created_at: string | null;
  placed_ago: string;
  status?: string;
}

export interface TradeHistory {
  id: string;
  ticker: string;
  side: 'LONG' | 'SHORT';
  amount: number;
  entry_price: number;
  exit_price: number;
  pnl: number;
  filled_at: string | null;
  time_ago: string;
}

export interface PolymarketMarket {
  question: string;
  probability: number;
  change: string;
  volume: string;
  url: string;
}

export interface RedditPost {
  text: string;
  username: string;
  subreddit: string;
  sentiment: string;
  posted_ago: string;
  url: string;
}

export interface SentimentStats {
  bullish: number;
  bearish: number;
  score: number;
  volume: string;
}

export interface CreateOrderRequest {
  ticker: string;
  side: 'BUY' | 'SELL';
  order_type: 'MARKET' | 'LIMIT' | 'STOP_LOSS';
  amount: number;
  limit_price?: number;
}

export interface ClosePositionRequest {
  qty?: number;
}

export interface AdjustPositionRequest {
  amount: number;
}

// ==================== API CALLS ====================

type FetchOptions = RequestInit & {
  successMessage?: string;
  showSuccessToast?: boolean;
};

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { successMessage, showSuccessToast = false, ...fetchOptions } = options;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      });

      if (!response.ok) {
        let message = response.statusText || 'Request failed';
        try {
          const errorBody = await response.json();
          message = errorBody?.detail || JSON.stringify(errorBody);
        } catch {
          const fallback = await response.text();
          if (fallback) message = fallback;
        }
        throw new Error(`[${response.status}] ${message}`);
      }

      const data = await response.json();

      if (showSuccessToast && successMessage) {
        toast.success(successMessage);
      }

      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'API request failed';
      toast.error(message);
      throw error;
    }
  }

  // ==================== MARKET DATA ====================

  async getRiskMonitor(): Promise<RiskMonitorData> {
    return this.fetch<RiskMonitorData>('/api/risk-monitor');
  }

  async getPolymarket(): Promise<PolymarketMarket[]> {
    return this.fetch<PolymarketMarket[]>('/api/polymarket');
  }

  async getReddit(subreddit: string = 'All'): Promise<RedditPost[]> {
    return this.fetch<RedditPost[]>(`/api/reddit?subreddit=${encodeURIComponent(subreddit)}`);
  }

  async getSentiment(): Promise<SentimentStats> {
    return this.fetch<SentimentStats>('/api/sentiment');
  }

  // ==================== PORTFOLIO ====================

  async getPortfolio(): Promise<PortfolioData> {
    return this.fetch<PortfolioData>('/api/portfolio');
  }

  async getPositions(): Promise<Position[]> {
    return this.fetch<Position[]>('/api/positions');
  }

  async adjustPosition(symbol: string, data: AdjustPositionRequest): Promise<Position> {
    return this.fetch<Position>(`/api/positions/${symbol}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      showSuccessToast: true,
      successMessage: 'Position adjusted',
    });
  }

  async closePosition(symbol: string, data: ClosePositionRequest): Promise<any> {
    return this.fetch(`/api/positions/${symbol}/close`, {
      method: 'POST',
      body: JSON.stringify(data),
      showSuccessToast: true,
      successMessage: 'Position closed',
    });
  }

  async getHistory(): Promise<TradeHistory[]> {
    return this.fetch<TradeHistory[]>('/api/history');
  }

  // ==================== ORDERS ====================

  async getOrders(): Promise<Order[]> {
    return this.fetch<Order[]>('/api/orders');
  }

  async createOrder(data: CreateOrderRequest): Promise<any> {
    return this.fetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify(data),
      showSuccessToast: true,
      successMessage: 'Order placed',
    });
  }

  async cancelOrder(orderId: string): Promise<any> {
    return this.fetch(`/api/orders/${orderId}`, {
      method: 'DELETE',
      showSuccessToast: true,
      successMessage: 'Order cancelled',
    });
  }
}

export const api = new ApiService(API_BASE_URL);
