"use client";

import { Flex, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { api, type PolymarketMarket } from "@/app/lib/api";

export default function PolymarketPanel() {
  const [markets, setMarkets] = useState<PolymarketMarket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const data = await api.getPolymarket();
        setMarkets(data);
      } catch (error) {
        // toast handled in api layer
        setMarkets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
    const interval = setInterval(fetchMarkets, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="border-r p-3 flex flex-col" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)', width: '100%', height: '16rem' }}>
      <Flex justify="between" align="center" className="mb-2 shrink-0">
        <Text size="1" weight="bold" className="uppercase tracking-wider" style={{ color: 'var(--slate-12)' }}>
          PREDICTION MARKETS
        </Text>
      </Flex>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-4 scrollbar-thin" style={{ minHeight: 0 }}>
        {loading ? (
          <Text size="1" style={{ color: 'var(--slate-11)' }}>Loading...</Text>
        ) : markets.length === 0 ? (
          <Text size="1" style={{ color: 'var(--slate-11)' }}>No markets available</Text>
        ) : (
          markets.map((market, idx) => (
            <a
              key={idx}
              href={market.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-2 border rounded transition-colors"
              style={{ background: 'var(--slate-4)', borderColor: 'var(--slate-6)', textDecoration: 'none' }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--blue-7)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--slate-6)'}
            >
              <Text size="1" className="mb-1 block leading-snug" style={{ color: 'var(--slate-12)' }}>
                {market.question}
              </Text>
              <Flex justify="between" align="center">
                <Flex align="baseline" gap="1">
                  <Text size="4" weight="bold" className="font-mono" style={{ color: market.change.startsWith('+') ? 'var(--green-11)' : 'var(--red-10)' }}>
                    {market.probability}%
                  </Text>
                  {market.change !== '+0%' && (
                    <Text size="1" style={{ color: market.change.startsWith('+') ? 'var(--green-11)' : 'var(--red-10)' }}>
                      {market.change}
                    </Text>
                  )}
                </Flex>
                <Text size="1" style={{ color: 'var(--slate-11)' }}>Vol: {market.volume}</Text>
              </Flex>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
