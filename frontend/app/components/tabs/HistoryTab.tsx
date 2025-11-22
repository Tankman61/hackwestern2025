"use client";

import { Flex, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { api, type TradeHistory } from "@/app/lib/api";

export default function HistoryTab() {
  const [history, setHistory] = useState<TradeHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const historyData = await api.getHistory();
        setHistory(historyData);
      } catch (error) {
        console.error("Failed to fetch history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Text size="2" style={{ color: 'var(--slate-11)' }}>Loading...</Text>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {history.length === 0 ? (
          <Text size="1" className="block mt-1" style={{ color: 'var(--slate-11)' }}>
            No trade history
          </Text>
        ) : (
          <div className="space-y-2">
            {history.map((trade) => (
              <div
                key={trade.id}
                className="p-2.5 border-l-2 rounded"
                style={{
                  background: 'var(--slate-3)',
                  borderColor: trade.pnl >= 0 ? 'var(--green-9)' : 'var(--red-9)'
                }}
              >
                <Flex justify="between" align="center" className="mb-1">
                  <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>
                    {trade.ticker} {trade.side}
                  </Text>
                  <Text
                    size="1"
                    weight="bold"
                    className="font-mono"
                    style={{ color: trade.pnl >= 0 ? 'var(--green-11)' : 'var(--red-10)' }}
                  >
                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                  </Text>
                </Flex>
                <Flex justify="between" className="mb-0.5">
                  <Text size="1" style={{ color: 'var(--slate-11)' }}>
                    Entry: ${trade.entry_price.toLocaleString()}
                  </Text>
                  <Text size="1" style={{ color: 'var(--slate-11)' }}>
                    Exit: ${trade.exit_price.toLocaleString()}
                  </Text>
                </Flex>
                <Text size="1" style={{ color: 'var(--slate-11)' }}>
                  {trade.time_ago || 'Recently'} • {trade.amount} {trade.ticker.split('/')[0]}
                </Text>
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
          Trade History
        </Text>
      </div>
      {renderContent()}
    </div>
  );
}
