"use client";

import { Flex, Text, Badge, Button } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { api, type PortfolioData, type Position, type Order } from "@/app/lib/api";

export default function PortfolioTab() {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closeQty, setCloseQty] = useState<Record<string, string>>({});
  const [cancelQty, setCancelQty] = useState<Record<string, string>>({});

  const fetchData = async () => {
    try {
      const [portfolioData, positionsData, ordersData] = await Promise.all([
        api.getPortfolio(),
        api.getPositions(),
        api.getOrders()
      ]);
      setPortfolio(portfolioData);
      setPositions(positionsData);
      setOrders(ordersData);
      setError(null);
    } catch (error) {
      console.error("Failed to fetch portfolio data:", error);
      setError("No trading data available yet.");
      setPortfolio(null);
      setPositions([]);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); // Refresh every 3s
    return () => clearInterval(interval);
  }, []);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Text size="2" style={{ color: 'var(--slate-11)' }}>
            Loading...
          </Text>
        </div>
      );
    }

    if (!portfolio) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Text size="2" style={{ color: 'var(--slate-11)' }}>
            No portfolio data
          </Text>
        </div>
      );
    }

    const pnlColor = portfolio.pnl_total >= 0 ? 'var(--green-11)' : 'var(--red-10)';

    return (
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {/* Portfolio Summary */}
        <div className="mb-5 p-3 rounded border" style={{ background: 'var(--slate-4)', borderColor: 'var(--slate-6)' }}>
          <Text size="1" className="mb-1 uppercase tracking-wider block" style={{ color: 'var(--slate-11)' }}>
            Total Portfolio Value
          </Text>
          <Text size="6" weight="bold" className="font-mono block" style={{ color: 'var(--slate-12)' }}>
            ${portfolio.total_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Flex align="center" gap="1" className="mt-2">
            <Text size="2" className="font-mono" style={{ color: pnlColor }}>
              {portfolio.pnl_total >= 0 ? '+' : ''}${portfolio.pnl_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text size="1" style={{ color: 'var(--slate-11)' }}>
              ({portfolio.pnl_percent >= 0 ? '+' : ''}{portfolio.pnl_percent.toFixed(2)}%)
            </Text>
          </Flex>
        </div>

        {/* Open Positions */}
        <Text size="1" className="mb-2 mt-4 uppercase tracking-wider block" style={{ color: 'var(--slate-11)' }}>
          Open Positions
        </Text>
        {positions.length === 0 ? (
          <Text size="1" className="mb-4 block" style={{ color: 'var(--slate-11)' }}>
            No open positions
          </Text>
        ) : (
          <div className="space-y-2 mb-4">
            {positions.map((position) => (
              <div key={position.asset_id} className="p-2.5 border rounded" style={{ background: 'var(--slate-4)', borderColor: 'var(--slate-6)' }}>
                <Flex justify="between" align="center" className="mb-1">
                  <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>{position.symbol}</Text>
                  <Badge size="1" style={{
                    background: position.side.toUpperCase() === 'LONG' ? 'var(--green-4)' : 'var(--red-4)',
                    color: position.side.toUpperCase() === 'LONG' ? 'var(--green-11)' : 'var(--red-10)'
                  }}>
                    {position.side.toUpperCase()}
                  </Badge>
                </Flex>
                <Flex justify="between" className="mb-0.5">
                  <Text size="1" style={{ color: 'var(--slate-11)' }}>Size</Text>
                  <Text size="1" className="font-mono" style={{ color: 'var(--slate-12)' }}>
                    {position.qty.toFixed(6)} {position.symbol.replace('USD', '')}
                  </Text>
                </Flex>
                <Flex justify="between" className="mb-0.5">
                  <Text size="1" style={{ color: 'var(--slate-11)' }}>Entry</Text>
                  <Text size="1" className="font-mono" style={{ color: 'var(--slate-12)' }}>
                    ${position.avg_entry_price.toLocaleString()}
                  </Text>
                </Flex>
                <Flex justify="between" className="mb-2">
                  <Text size="1" style={{ color: 'var(--slate-11)' }}>P&L</Text>
                  <Text size="1" weight="bold" className="font-mono" style={{ color: (position.live_pnl ?? position.unrealized_pl) >= 0 ? 'var(--green-11)' : 'var(--red-10)' }}>
                    {(position.live_pnl ?? position.unrealized_pl) >= 0 ? '+' : ''}${(position.live_pnl ?? position.unrealized_pl).toFixed(2)}
                  </Text>
                </Flex>
                <Flex gap="2" className="mt-2">
                  <input
                    type="number"
                    placeholder={`Max: ${position.qty.toFixed(6)}`}
                    value={closeQty[position.asset_id] || ''}
                    onChange={(e) => setCloseQty(prev => ({ ...prev, [position.asset_id]: e.target.value }))}
                    className="flex-1 px-2 py-1 rounded border text-xs font-mono"
                    style={{
                      background: 'var(--slate-3)',
                      borderColor: 'var(--slate-6)',
                      color: 'var(--slate-12)',
                      outline: 'none'
                    }}
                    step="0.000001"
                    min="0"
                    max={position.qty}
                  />
                  <Button
                    size="1"
                    className="cursor-pointer"
                    style={{ background: 'var(--red-9)', color: 'white' }}
                    onClick={async () => {
                      try {
                        const qty = closeQty[position.asset_id] ? parseFloat(closeQty[position.asset_id]) : undefined;
                        await api.closePosition(position.symbol, qty ? { qty } : {});
                        setCloseQty(prev => ({ ...prev, [position.asset_id]: '' }));
                        fetchData(); // Refresh data
                      } catch (error) {
                        console.error("Failed to close position:", error);
                      }
                    }}
                  >
                    {closeQty[position.asset_id] ? 'Close Partial' : 'Close All'}
                  </Button>
                </Flex>
              </div>
            ))}
          </div>
        )}

        {/* Open Orders */}
        <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
          Open Orders
        </Text>
        {orders.length === 0 ? (
          <Text size="1" className="block mt-1" style={{ color: 'var(--slate-11)' }}>
            No open orders
          </Text>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <div key={order.id} className="p-2.5 border rounded" style={{ background: 'var(--slate-4)', borderColor: 'var(--slate-6)' }}>
                <Flex justify="between" align="center" className="mb-1">
                  <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>{order.ticker}</Text>
                  <Badge size="1" style={{
                    background: order.order_type.includes('BUY') ? 'var(--green-4)' : 'var(--red-4)',
                    color: order.order_type.includes('BUY') ? 'var(--green-11)' : 'var(--red-10)'
                  }}>
                    {order.order_type}
                  </Badge>
                </Flex>
                <Flex justify="between" className="mb-0.5">
                  <Text size="1" style={{ color: 'var(--slate-11)' }}>Size</Text>
                  <Text size="1" className="font-mono" style={{ color: 'var(--slate-12)' }}>
                    {order.amount} {order.ticker.split('/')[0]}
                  </Text>
                </Flex>
                {order.limit_price && (
                  <Flex justify="between" className="mb-0.5">
                    <Text size="1" style={{ color: 'var(--slate-11)' }}>Limit Price</Text>
                    <Text size="1" className="font-mono" style={{ color: 'var(--slate-12)' }}>
                      ${order.limit_price.toLocaleString()}
                    </Text>
                  </Flex>
                )}
                <Flex justify="between" className="mb-2">
                  <Text size="1" style={{ color: 'var(--slate-11)' }}>Placed</Text>
                  <Text size="1" style={{ color: 'var(--slate-11)' }}>{order.placed_ago || 'Just now'}</Text>
                </Flex>
                <Button
                  size="1"
                  className="w-full cursor-pointer"
                  style={{ background: 'var(--red-9)', color: 'white' }}
                  onClick={async () => {
                    try {
                      await api.cancelOrder(order.id);
                      fetchData(); // Refresh data
                    } catch (error) {
                      console.error("Failed to cancel order:", error);
                    }
                  }}
                >
                  Cancel Order
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
        <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>
          Portfolio
        </Text>
      </div>
      {renderContent()}
    </div>
  );
}
