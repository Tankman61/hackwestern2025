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
        <div className="flex items-center justify-center" style={{ minHeight: '100%', height: '100%' }}>
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

    const hypeColor = data.hype_level.level === "High" ? 'var(--purple-10)' :
                       data.hype_level.level === "Medium" ? 'var(--blue-10)' :
                       'var(--slate-11)';

    const hypeBgColor = data.hype_level.level === "High" ? 'var(--purple-4)' :
                         data.hype_level.level === "Medium" ? 'var(--blue-4)' :
                         'var(--slate-3)';

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

        <div className="px-3 py-4 flex-1" style={{ minHeight: '200px' }}>
          <Text size="1" className="mb-3 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
            Hype Level
          </Text>
          <Flex align="baseline" gap="2" className="mb-2">
            <Text size="8" weight="bold" className="font-mono leading-none" style={{ color: hypeColor }}>
              {data.hype_level.score}
            </Text>
            <Text size="2" style={{ color: 'var(--slate-11)' }}>/ 100</Text>
          </Flex>
          <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'var(--slate-6)' }}>
            <div
              className="h-full transition-all"
              style={{ width: `${data.hype_level.score}%`, background: hypeColor }}
            ></div>
          </div>
          <div className="mb-2">
            <Badge size="1" style={{ background: hypeBgColor, color: hypeColor }}>
              {data.hype_level.level}
            </Badge>
          </div>
          <Text size="1" className="leading-relaxed" style={{ color: 'var(--slate-11)' }}>
            {data.hype_level.summary || "Social sentiment and market enthusiasm"}
          </Text>
        </div>

        <div className="px-3 py-3 border-t" style={{ borderColor: 'var(--slate-6)' }}>
          <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
            Market Overview
          </Text>
          <div className="space-y-2">
            <Flex justify="between">
              <Text size="1" style={{ color: 'var(--slate-11)' }}>24h Range</Text>
              <Text size="1" className="font-mono" style={{ color: 'var(--slate-12)' }}>
                ${(data.market_overview.price_range_24h.low / 1000).toFixed(1)}k - ${(data.market_overview.price_range_24h.high / 1000).toFixed(1)}k
              </Text>
            </Flex>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-3 border-b shrink-0" style={{ borderColor: 'var(--slate-6)' }}>
        <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>
          Risk Monitor
        </Text>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        {renderContent()}
      </div>
    </div>
  );
}
