// Trading API hooks for Alpaca paper trading integration

import { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:8000';

// ========== TYPES ==========

export interface Account {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  cash: number;
  portfolio_value: number;
  buying_power: number;
  equity: number;
  last_equity: number;
  multiplier: string;
  initial_margin: number;
  maintenance_margin: number;
  daytrade_count: number;
  daytrading_buying_power: number;
  regt_buying_power: number;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  transfers_blocked: boolean;
  account_blocked: boolean;
  created_at: string;
}

export interface Position {
  asset_id: string;
  symbol: string;
  exchange: string;
  asset_class: string;
  avg_entry_price: number;
  qty: number;
  qty_available: number;
  side: 'LONG' | 'SHORT';
  market_value: number;
  cost_basis: number;
  unrealized_pl: number;
  unrealized_plpc: number;
  unrealized_intraday_pl: number;
  unrealized_intraday_plpc: number;
  current_price: number;
  lastday_price: number;
  change_today: number;
  live_price?: number;
  live_pnl?: number;
  live_pnl_percent?: number;
}

export interface Order {
  id: string;
  client_order_id: string;
  created_at: string;
  updated_at: string;
  submitted_at: string;
  filled_at: string | null;
  expired_at: string | null;
  canceled_at: string | null;
  failed_at: string | null;
  replaced_at: string | null;
  replaced_by: string | null;
  replaces: string | null;
  asset_id: string;
  symbol: string;
  asset_class: string;
  notional: number | null;
  qty: number;
  filled_qty: number;
  filled_avg_price: number | null;
  order_class: string;
  order_type: string;
  type: string;
  side: 'buy' | 'sell';
  time_in_force: string;
  limit_price: number | null;
  stop_price: number | null;
  status: string;
  extended_hours: boolean;
  legs: any;
  trail_percent: number | null;
  trail_price: number | null;
  hwm: number | null;
}

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop-limit';
export type TimeInForce = 'day' | 'gtc' | 'ioc' | 'fok';

// ========== ACCOUNT HOOK ==========

export function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccount = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/api/account`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch account: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAccount(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch account');
      console.error('Error fetching account:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  return { account, loading, error, refetch: fetchAccount };
}

// ========== POSITIONS HOOK ==========

export function usePositions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/api/positions`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch positions: ${response.statusText}`);
      }
      
      const data = await response.json();
      setPositions(data.positions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch positions');
      console.error('Error fetching positions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPositions();
    
    // Poll every 5 seconds for updated P&L
    const interval = setInterval(fetchPositions, 5000);
    return () => clearInterval(interval);
  }, [fetchPositions]);

  const closePosition = useCallback(async (symbol: string, qty?: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/positions/${symbol}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: qty ? JSON.stringify({ qty }) : undefined,
      });
      
      if (!response.ok) {
        throw new Error(`Failed to close position: ${response.statusText}`);
      }
      
      await fetchPositions(); // Refresh positions
      return true;
    } catch (err) {
      console.error('Error closing position:', err);
      return false;
    }
  }, [fetchPositions]);

  return { positions, loading, error, refetch: fetchPositions, closePosition };
}

// ========== ORDERS HOOK ==========

export function useOrders(status: 'open' | 'closed' | 'all' = 'open') {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/api/orders?status=${status}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.statusText}`);
      }
      
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchOrders();
    
    // Poll every 3 seconds for order updates
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const cancelOrder = useCallback(async (orderId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/orders/${orderId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to cancel order: ${response.statusText}`);
      }
      
      await fetchOrders(); // Refresh orders
      return true;
    } catch (err) {
      console.error('Error cancelling order:', err);
      return false;
    }
  }, [fetchOrders]);

  const cancelAllOrders = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/orders`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to cancel all orders: ${response.statusText}`);
      }
      
      await fetchOrders(); // Refresh orders
      return true;
    } catch (err) {
      console.error('Error cancelling all orders:', err);
      return false;
    }
  }, [fetchOrders]);

  return { orders, loading, error, refetch: fetchOrders, cancelOrder, cancelAllOrders };
}

// ========== TRADING HOOK ==========

export function useTrading() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeMarketOrder = useCallback(async (
    symbol: string,
    qty: number,
    side: OrderSide,
    timeInForce: TimeInForce = 'gtc'
  ): Promise<Order | null> => {
    try {
      setSubmitting(true);
      setError(null);
      
      const response = await fetch(`${API_BASE}/api/orders/market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, qty, side, time_in_force: timeInForce }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to place market order');
      }
      
      const order = await response.json();
      return order;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to place market order';
      setError(message);
      console.error('Error placing market order:', err);
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const placeLimitOrder = useCallback(async (
    symbol: string,
    qty: number,
    side: OrderSide,
    limitPrice: number,
    timeInForce: TimeInForce = 'gtc'
  ): Promise<Order | null> => {
    try {
      setSubmitting(true);
      setError(null);
      
      const response = await fetch(`${API_BASE}/api/orders/limit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, qty, side, limit_price: limitPrice, time_in_force: timeInForce }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to place limit order');
      }
      
      const order = await response.json();
      return order;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to place limit order';
      setError(message);
      console.error('Error placing limit order:', err);
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const placeStopOrder = useCallback(async (
    symbol: string,
    qty: number,
    side: OrderSide,
    stopPrice: number,
    timeInForce: TimeInForce = 'gtc'
  ): Promise<Order | null> => {
    try {
      setSubmitting(true);
      setError(null);
      
      const response = await fetch(`${API_BASE}/api/orders/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, qty, side, stop_price: stopPrice, time_in_force: timeInForce }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to place stop order');
      }
      
      const order = await response.json();
      return order;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to place stop order';
      setError(message);
      console.error('Error placing stop order:', err);
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const placeStopLimitOrder = useCallback(async (
    symbol: string,
    qty: number,
    side: OrderSide,
    stopPrice: number,
    limitPrice: number,
    timeInForce: TimeInForce = 'gtc'
  ): Promise<Order | null> => {
    try {
      setSubmitting(true);
      setError(null);
      
      const response = await fetch(`${API_BASE}/api/orders/stop-limit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          qty,
          side,
          stop_price: stopPrice,
          limit_price: limitPrice,
          time_in_force: timeInForce
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to place stop-limit order');
      }
      
      const order = await response.json();
      return order;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to place stop-limit order';
      setError(message);
      console.error('Error placing stop-limit order:', err);
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return {
    submitting,
    error,
    placeMarketOrder,
    placeLimitOrder,
    placeStopOrder,
    placeStopLimitOrder,
  };
}
