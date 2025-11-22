"use client";

import { Flex, Text, Badge } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { api, type RiskMonitorData } from "@/app/lib/api";

export default function RiskMonitorTab() {
  const [data, setData] = useState<RiskMonitorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const riskData = await api.getRiskMonitor();
        setData(riskData);
      } catch (error) {
        console.error("Failed to fetch risk monitor data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000); // Refresh every 2s
    return () => clearInterval(interval);
  }, []);

  const renderContent = () => {
    if (loading || !data) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Text size="2" style={{ color: 'var(--slate-11)' }}>
            {loading ? "Loading..." : "No data available"}
          </Text>
        </div>
      );
    }

    const riskColor = data.risk_level.level === "High" ? 'var(--red-10)' :
                       data.risk_level.level === "Medium" ? 'var(--yellow-10)' :
                       'var(--green-11)';

    const riskBgColor = data.risk_level.level === "High" ? 'var(--red-4)' :
                         data.risk_level.level === "Medium" ? 'var(--yellow-4)' :
                         'var(--green-4)';

    return (
      <>
        <div className="px-3 py-4 border-b" style={{ borderColor: 'var(--slate-6)' }}>
          <Text size="1" className="mb-3 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
            Risk Level
          </Text>
          <Flex align="baseline" gap="2" className="mb-2">
            <Text size="8" weight="bold" className="font-mono leading-none" style={{ color: riskColor }}>
              {data.risk_level.score}
            </Text>
            <Text size="2" style={{ color: 'var(--slate-11)' }}>/ 100</Text>
          </Flex>
          <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'var(--slate-6)' }}>
            <div
              className="h-full transition-all"
              style={{ width: `${data.risk_level.score}%`, background: riskColor }}
            ></div>
          </div>
          <div className="mb-2">
            <Badge size="1" style={{ background: riskBgColor, color: riskColor }}>
              {data.risk_level.level}
            </Badge>
          </div>
          <Text size="1" className="leading-relaxed" style={{ color: 'var(--slate-11)' }}>
            {data.risk_level.summary || "No summary available"}
          </Text>
        </div>

        <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
          <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
            Market Overview
          </Text>
          <div className="space-y-2">
            <Flex justify="between">
              <Text size="1" style={{ color: 'var(--slate-11)' }}>24h Volume</Text>
              <Text size="1" weight="bold" className="font-mono" style={{ color: 'var(--slate-12)' }}>
                {data.market_overview.volume_24h}
              </Text>
            </Flex>
            <Flex justify="between">
              <Text size="1" style={{ color: 'var(--slate-11)' }}>24h Range</Text>
              <Text size="1" className="font-mono" style={{ color: 'var(--slate-12)' }}>
                ${(data.market_overview.price_range_24h.low / 1000).toFixed(1)}k - ${(data.market_overview.price_range_24h.high / 1000).toFixed(1)}k
              </Text>
            </Flex>
          </div>
        </div>

        <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
          <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
            Technical
          </Text>
          <div className="space-y-2">
            <Flex justify="between">
              <Text size="1" style={{ color: 'var(--slate-11)' }}>RSI (14)</Text>
              <Text size="1" className="font-mono" style={{ color: data.technical.rsi > 70 ? 'var(--red-10)' : data.technical.rsi < 30 ? 'var(--green-11)' : 'var(--slate-12)' }}>
                {data.technical.rsi > 0 ? data.technical.rsi.toFixed(1) : '--'}
              </Text>
            </Flex>
            <Flex justify="between">
              <Text size="1" style={{ color: 'var(--slate-11)' }}>MACD</Text>
              <Text size="1" className="font-mono" style={{ color: data.technical.macd >= 0 ? 'var(--green-11)' : 'var(--red-10)' }}>
                {data.technical.macd !== 0 ? (data.technical.macd > 0 ? '+' : '') + data.technical.macd.toFixed(0) : '--'}
              </Text>
            </Flex>
          </div>
        </div>

        <div className="px-3 py-3 flex-1">
          <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
            Watchlist
          </Text>
          {data.watchlist.length === 0 ? (
            <Text size="1" className="block mt-1" style={{ color: 'var(--slate-11)' }}>
              No watchlist data
            </Text>
          ) : (
            <div className="space-y-1.5">
              {data.watchlist.map((item, idx) => (
                <Flex
                  key={item.ticker}
                  justify="between"
                  className={idx < data.watchlist.length - 1 ? "py-1.5 border-b" : "py-1.5"}
                  style={{ borderColor: 'var(--slate-6)' }}
                >
                  <Text size="1" style={{ color: 'var(--slate-12)' }}>{item.ticker}</Text>
                  <Text
                    size="1"
                    className="font-mono"
                    style={{ color: item.change.startsWith('+') ? 'var(--green-11)' : 'var(--red-10)' }}
                  >
                    {item.change}
                  </Text>
                </Flex>
              ))}
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
        <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>
          Risk Monitor
        </Text>
      </div>
      {renderContent()}
    </div>
  );
}
