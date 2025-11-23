"use client";

import { useState, useEffect } from "react";
import { Card, Flex, Heading, Text, Button, Badge, Box, TextField, ScrollArea, TextArea, DropdownMenu } from "@radix-ui/themes";
import { motion, AnimatePresence } from "framer-motion";
import { BarChartIcon, DashboardIcon, ActivityLogIcon, ExclamationTriangleIcon, GearIcon, ChevronDownIcon } from "@radix-ui/react-icons";
import SideMenu from "./components/SideMenu";
import CryptoPortfolio from "./components/portfolios/CryptoPortfolio";
import StocksPortfolio from "./components/portfolios/StocksPortfolio";
import OptionsPortfolio from "./components/portfolios/OptionsPortfolio";
import ETFsPortfolio from "./components/portfolios/ETFsPortfolio";
import CryptoHoldings from "./components/holdings/CryptoHoldings";
import StocksHoldings from "./components/holdings/StocksHoldings";
import OptionsHoldings from "./components/holdings/OptionsHoldings";
import ETFsHoldings from "./components/holdings/ETFsHoldings";

type PortfolioView = "crypto" | "stocks" | "options" | "etfs" | null;
type HoldingsView = "crypto-holdings" | "stocks-holdings" | "options-holdings" | "etfs-holdings" | null;

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

type SentimentPost = {
  time: string;
  author: string;
  snippet: string;
  sentiment: "bullish" | "bearish";
  subreddit?: string;
};

type SubredditEntry = {
  stats: { bullish: number; bearish: number; score: number; volume: string };
  posts: SentimentPost[];
};

const individualSubredditData: Record<Exclude<SubredditOption, "All">, SubredditEntry> = {
  "r/Polymarket": {
    stats: { bullish: 64, bearish: 36, score: 32, volume: "1.1k" },
    posts: [
      { time: "3m ago", author: "u/polymarketnerd", snippet: "Election odds flipped after overnight whale order. Keep an eye on BTC tails.", sentiment: "bullish" },
      { time: "7m ago", author: "u/degenalpha", snippet: "Liquidity thin beyond $100k strike. Expect volatility spikes.", sentiment: "bearish" },
      { time: "15m ago", author: "u/spreadsheetbot", snippet: "New contract on ETH ETF approval priced at 58% with fresh bids.", sentiment: "bullish" },
    ],
  },
  "r/PredictionMarket": {
    stats: { bullish: 58, bearish: 42, score: 18, volume: "900" },
    posts: [
      { time: "1m ago", author: "u/marketmaker42", snippet: "Calm before CPI print. Odds are pricing soft landing already.", sentiment: "bearish" },
      { time: "9m ago", author: "u/alphaoracle", snippet: "Big surge on macro basket. Watching for follow-through if dollar cools.", sentiment: "bullish" },
      { time: "18m ago", author: "u/datalake", snippet: "PredictionBook consensus now above 65 for BTC > 110k.", sentiment: "bullish" },
    ],
  },
  "r/wallstreetbets": {
    stats: { bullish: 72, bearish: 28, score: 44, volume: "2.4k" },
    posts: [
      { time: "2m ago", author: "u/cryptowhale", snippet: "BTC breaking out. This is not a drill. Load up now before...", sentiment: "bullish" },
      { time: "5m ago", author: "u/tradingpro", snippet: "Volume looking weak. Expecting pullback to 95k support...", sentiment: "bearish" },
      { time: "12m ago", author: "u/moonboy", snippet: "100k by Christmas. Diamond hands only. HODL the line!", sentiment: "bullish" },
    ],
  },
  "r/pennystocks": {
    stats: { bullish: 49, bearish: 51, score: -6, volume: "1.7k" },
    posts: [
      { time: "4m ago", author: "u/microcapmamba", snippet: "Moving some profits into BTC pairs while liquidity is high.", sentiment: "bullish" },
      { time: "10m ago", author: "u/bagholderdan", snippet: "Rotating out of risky alts until BTC chills.", sentiment: "bearish" },
      { time: "22m ago", author: "u/scalpszn", snippet: "Watching microcap miners if BTC holds 98.5k.", sentiment: "bullish" },
    ],
  },
  "r/cryptocurrency": {
    stats: { bullish: 66, bearish: 34, score: 28, volume: "5.9k" },
    posts: [
      { time: "3m ago", author: "u/glassnodewiz", snippet: "Exchange reserves at 4-year lows. Supply shock incoming?", sentiment: "bullish" },
      { time: "8m ago", author: "u/regwatcher", snippet: "Rumors of stricter leverage rules in EU desks.", sentiment: "bearish" },
      { time: "17m ago", author: "u/ethbull", snippet: "ETH/BTC looks primed for reversal; derivatives funding cooling.", sentiment: "bullish" },
    ],
  },
  "r/daytrading": {
    stats: { bullish: 54, bearish: 46, score: 12, volume: "3.1k" },
    posts: [
      { time: "1m ago", author: "u/tape_reader", snippet: "Scalping BTC microstructure, bids refreshing every 250 ticks.", sentiment: "bullish" },
      { time: "6m ago", author: "u/orderflowjoe", snippet: "Seeing trapped longs above 99k. Watching for flush.", sentiment: "bearish" },
      { time: "16m ago", author: "u/l2wizard", snippet: "Delta flipping green on Binance perps, could squeeze shorts.", sentiment: "bullish" },
    ],
  },
};

const parseVolume = (volume: string) => {
  const normalized = volume.trim().toLowerCase();
  if (normalized.endsWith("m")) return parseFloat(normalized) * 1_000_000;
  if (normalized.endsWith("k")) return parseFloat(normalized) * 1_000;
  return parseFloat(normalized) || 0;
};

const formatVolume = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${Math.round(value)}`;
};

const aggregateSubredditData = (): SubredditEntry => {
  const entries = Object.entries(individualSubredditData) as [Exclude<SubredditOption, "All">, SubredditEntry][];
  const count = entries.length || 1;
  const avg = (getter: (entry: SubredditEntry) => number) =>
    Math.round(entries.reduce((sum, [, data]) => sum + getter(data), 0) / count);
  const totalVolume = entries.reduce((sum, [, data]) => sum + parseVolume(data.stats.volume), 0);

  const aggregatedPosts = entries
    .flatMap(([subreddit, data]) =>
      data.posts.map((post) => ({
        ...post,
        subreddit,
      }))
    )
    .slice(0, 12);

  return {
    stats: {
      bullish: avg((data) => data.stats.bullish),
      bearish: avg((data) => data.stats.bearish),
      score: avg((data) => data.stats.score),
      volume: formatVolume(totalVolume),
    },
    posts: aggregatedPosts,
  };
};

const subredditData: Record<SubredditOption, SubredditEntry> = {
  All: aggregateSubredditData(),
  ...individualSubredditData,
};

export default function Home() {
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [agentExpanded, setAgentExpanded] = useState(false);
  const [sentimentExpanded, setSentimentExpanded] = useState(false);
  const [tradingPanelOpen, setTradingPanelOpen] = useState(true); // Always open by default
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTradingTab, setActiveTradingTab] = useState<"risk" | "trade" | "portfolio" | "history">("trade");
  const [riskLevel] = useState<"low" | "medium" | "high">("high"); // Demo: high risk
  const [currentPrice] = useState("98,742.31");
  const [currentTime, setCurrentTime] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [positionSize, setPositionSize] = useState("0.5");
  const [tradeType, setTradeType] = useState<"long" | "short">("long");
  const [stopLoss, setStopLoss] = useState("97,200");
  const [takeProfit, setTakeProfit] = useState("100,500");
  const [messages, setMessages] = useState([
    { role: "agent", text: "Hey trader! I'm watching BTC/USD for you. Ask me anything about the markets! 💹", time: "14:30:12" },
    { role: "user", text: "What's the market looking like?", time: "14:30:45" },
    { role: "agent", text: "BTC just broke resistance at $98.5k with crazy volume! Polymarket odds jumped +12% in 5 min - whales are moving. This could be big! 🚀", time: "14:31:01" },
  ]);
  const [selectedSubreddit, setSelectedSubreddit] = useState<SubredditOption>(subredditOptions[0]);
  const [subredditDropdownOpen, setSubredditDropdownOpen] = useState(false);
  const [activePortfolio, setActivePortfolio] = useState<PortfolioView>(null);
  const [activeHoldings, setActiveHoldings] = useState<HoldingsView>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setSentimentExpanded(false);
  }, [selectedSubreddit]);

  const polymarkets = [
    { question: "Bitcoin > $100k by Dec 31", probability: 68, change: "+12%", volume: "2.4M" },
    { question: "BTC to hit $120k in 2025", probability: 42, change: "+8%", volume: "1.8M" },
    { question: "Bitcoin ETF approval", probability: 89, change: "-2%", volume: "5.1M" },
    { question: "BTC above $90k EOY", probability: 76, change: "+5%", volume: "3.2M" },
  ];
  const openOrders = [
    {
      market: "BTC/USD",
      badge: "LIMIT BUY",
      badgeColor: { bg: 'var(--green-4)', text: 'var(--green-11)' },
      rows: [
        { label: "Size", value: "0.3 BTC" },
        { label: "Limit Price", value: "$97,500" },
      ],
      placed: "30 min ago",
    },
    {
      market: "ETH/USD",
      badge: "STOP-LOSS",
      badgeColor: { bg: 'var(--red-4)', text: 'var(--red-10)' },
      rows: [
        { label: "Size", value: "1.5 ETH" },
        { label: "Stop Price", value: "$3,750" },
      ],
      placed: "2 hours ago",
    },
    {
      market: "BTC/USD",
      badge: "LIMIT SELL",
      badgeColor: { bg: 'var(--red-4)', text: 'var(--red-10)' },
      rows: [
        { label: "Size", value: "0.2 BTC" },
        { label: "Limit Price", value: "$100,000" },
      ],
      placed: "1 day ago",
    },
  ];
  const activeSubreddit = subredditData[selectedSubreddit];
  const fallbackSentiment = subredditData["All"].stats;
  const sentimentStats = activeSubreddit?.stats ?? fallbackSentiment;
  const sentimentScoreLabel = sentimentStats.score > 0 ? `+${sentimentStats.score}` : `${sentimentStats.score}`;
  const redditPosts = activeSubreddit?.posts ?? [];
  const currentSubredditLink =
    selectedSubreddit === "All" ? "https://reddit.com/r/all" : `https://reddit.com/${selectedSubreddit}`;

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;

    const newUserMsg = {
      role: "user" as const,
      text: messageInput,
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    setMessages(prev => [...prev, newUserMsg]);
    setMessageInput("");

    // Simulate agent response
    setTimeout(() => {
      const agentResponse = {
        role: "agent" as const,
        text: "Let me check the charts for you... 📊",
        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      setMessages(prev => [...prev, agentResponse]);
    }, 500);
  };

  return (
    <main className="h-screen w-screen overflow-hidden" style={{ background: 'var(--slate-1)' }}>
      {/* Top Bar */}
      <div className="h-12 border-b flex items-center px-4 justify-between" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
        <Flex align="center" gap="4">
          <Text size="4" weight="bold" className="font-mono" style={{ color: 'var(--slate-12)' }}>
            BTC/USD
          </Text>
          <div className="h-4 w-px" style={{ background: 'var(--slate-6)' }}></div>
          <Text size="1" style={{ color: 'var(--slate-11)' }}>
            BITSTAMP
          </Text>
          <Text size="3" weight="bold" className="font-mono ml-4" style={{ color: 'var(--green-11)' }}>
            {currentPrice}
          </Text>
          <Text size="1" style={{ color: 'var(--green-11)' }}>
            +0.92%
          </Text>
        </Flex>
        <Flex align="center" gap="3">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green-9)' }}></div>
            <Text size="1" className="font-mono" style={{ color: 'var(--slate-11)' }}>
              {currentTime || "00:00:00"} UTC
            </Text>
          </div>
        </Flex>
      </div>

      {/* Side Menu */}
      <SideMenu 
        isOpen={sideMenuOpen} 
        onToggle={() => setSideMenuOpen(!sideMenuOpen)}
        onPortfolioSelect={(portfolio) => {
          setActivePortfolio(portfolio);
          setActiveHoldings(null);
          setSideMenuOpen(false);
        }}
        onHoldingsSelect={(holdings) => {
          setActiveHoldings(holdings);
          setActivePortfolio(null);
          setSideMenuOpen(false);
        }}
      />

      <div className="grid h-[calc(100vh-3rem)] gap-0" style={{
        gridTemplateColumns: tradingPanelOpen ? '1fr 280px 40px' : '1fr 40px',
        gridTemplateRows: '1fr'
      }}>
        {/* LEFT COLUMN: Chart/Portfolio/Holdings + Data Feeds */}
        <div className="flex flex-col">
          {activePortfolio === null && activeHoldings === null ? (
            <>
              {/* Main Chart Area */}
              <div className="flex-1 border-r" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
            <div className="flex h-full items-center justify-center flex-col gap-4 p-8">
              <Text size="6" weight="bold" style={{ color: 'var(--slate-11)' }}>
                BTC/USD LIVE CHART
              </Text>
              <Text size="2" style={{ color: 'var(--slate-9)' }}>
                TradingView Widget Integration Point
              </Text>
              <div className="mt-8 flex gap-8">
                <div>
                  <Text size="1" className="mb-1" style={{ color: 'var(--slate-11)' }}>O</Text>
                  <Text size="3" weight="medium" className="font-mono" style={{ color: 'var(--slate-12)' }}>98,234</Text>
                </div>
                <div>
                  <Text size="1" className="mb-1" style={{ color: 'var(--slate-11)' }}>H</Text>
                  <Text size="3" weight="medium" className="font-mono" style={{ color: 'var(--slate-12)' }}>99,234</Text>
                </div>
                <div>
                  <Text size="1" className="mb-1" style={{ color: 'var(--slate-11)' }}>L</Text>
                  <Text size="3" weight="medium" className="font-mono" style={{ color: 'var(--slate-12)' }}>97,840</Text>
                </div>
                <div>
                  <Text size="1" className="mb-1" style={{ color: 'var(--slate-11)' }}>C</Text>
                  <Text size="3" weight="medium" className="font-mono" style={{ color: 'var(--green-11)' }}>98,742</Text>
                </div>
                <div>
                  <Text size="1" className="mb-1" style={{ color: 'var(--slate-11)' }}>CHG</Text>
                  <Text size="3" weight="medium" className="font-mono" style={{ color: 'var(--green-11)' }}>+8.4%</Text>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Data Panels */}
          <div className="h-64 border-t border-r grid grid-cols-[256px_1fr_1fr] gap-0" style={{ borderColor: 'var(--slate-6)' }}>
            {/* VTuber Profile Card - SQUARE SECTION */}
            <div
              className="border-r cursor-pointer flex items-center justify-center"
              style={{ background: 'transparent', borderColor: 'transparent', width: '256px', height: '256px' }}
              onClick={() => setAgentExpanded(!agentExpanded)}
            >
              <div className="w-[200px] h-[200px] rounded-lg flex items-center justify-center text-6xl border-2 shadow-lg relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--red-9), var(--red-10))', borderColor: 'var(--red-7)' }}>
                <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, transparent, rgba(139, 92, 246, 0.2))' }}></div>
                <span className="relative z-10">🎯</span>
                <div className="absolute bottom-3 right-3 w-4 h-4 rounded-full border-2" style={{ background: 'var(--green-9)', borderColor: 'var(--slate-2)' }}></div>
              </div>
            </div>

            {/* Polymarket Panel - Scrollable */}
            <div className="border-r p-3 flex flex-col" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
              <Flex justify="between" align="center" className="mb-2">
                <Text size="1" weight="bold" className="uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                  Prediction Markets
                </Text>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--blue-9)' }}></div>
                  <Text size="1" weight="medium" style={{ color: 'var(--blue-11)' }}>POLYMARKET</Text>
                </div>
              </Flex>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin" style={{ maxHeight: '200px' }}>
                {polymarkets.map((market, idx) => (
                  <a
                    key={idx}
                    href="https://polymarket.com/event/what-price-will-bitcoin-hit-in-november-2025"
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
                        <Text size="1" style={{ color: market.change.startsWith('+') ? 'var(--green-11)' : 'var(--red-10)' }}>
                          {market.change}
                        </Text>
                      </Flex>
                      <Text size="1" style={{ color: 'var(--slate-11)' }}>Vol: {market.volume}</Text>
                    </Flex>
                  </a>
                ))}
              </div>
            </div>

            {/* Social Sentiment Panel - Clickable */}
            <div
              className="p-3 flex flex-col cursor-pointer"
              style={{ background: 'var(--slate-2)' }}
              onClick={() => setSentimentExpanded(!sentimentExpanded)}
            >
              <Flex justify="between" align="center" className="mb-2">
                <Text size="1" weight="bold" className="uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                  Social Sentiment
                </Text>
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
                  <Flex direction="column" gap="2" className="mt-2">
                    <div>
                      <Text size="1" className="block" style={{ color: 'var(--slate-11)', marginBottom: '0.15rem' }}>Bullish/Bearish Ratio</Text>
                      <Flex align="baseline" gap="1">
                        <Text size="5" weight="bold" className="font-mono" style={{ color: 'var(--green-11)' }}>{sentimentStats.bullish}</Text>
                        <Text size="2" style={{ color: 'var(--slate-11)' }}>/</Text>
                        <Text size="5" weight="bold" className="font-mono" style={{ color: 'var(--red-10)' }}>{sentimentStats.bearish}</Text>
                      </Flex>
                    </div>
                    <div>
                      <Text size="1" className="block" style={{ color: 'var(--slate-11)', marginBottom: '0.15rem' }}>Sentiment Score</Text>
                      <Text size="4" weight="bold" className="font-mono" style={{ color: sentimentStats.score >= 0 ? 'var(--green-11)' : 'var(--red-10)' }}>{sentimentScoreLabel}</Text>
                    </div>
                    <div>
                      <Text size="1" className="block" style={{ color: 'var(--slate-11)', marginBottom: '0.15rem' }}>Post Volume (24h)</Text>
                      <Text size="4" weight="bold" className="font-mono" style={{ color: 'var(--slate-12)' }}>{sentimentStats.volume}</Text>
                    </div>
                  </Flex>
                </div>
              ) : (
                <div
                  className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin"
                  style={{ maxHeight: '200px', marginTop: sentimentExpanded ? 0 : '0.5rem' }}
                >
                  {redditPosts.map((post, idx) => (
                    <a
                      key={idx}
                      href={post.subreddit ? `https://reddit.com/${post.subreddit}` : currentSubredditLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-2 border rounded"
                      style={{ background: 'var(--slate-4)', borderColor: 'var(--slate-6)', textDecoration: 'none' }}
                    >
                      <Flex justify="between" className="mb-1">
                        <div>
                          <Text size="1" weight="medium" style={{ color: 'var(--blue-11)' }}>{post.author}</Text>
                          {post.subreddit && (
                            <Text size="1" className="block" style={{ color: 'var(--slate-10)' }}>{post.subreddit}</Text>
                          )}
                        </div>
                        <Text size="1" style={{ color: 'var(--slate-11)' }}>{post.time}</Text>
                      </Flex>
                      <Text size="1" className="leading-relaxed" style={{ color: 'var(--slate-12)' }}>
                        {post.snippet}
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
                  ))}
                </div>
              )}
            </div>
          </div>
            </>
          ) : activePortfolio !== null ? (
            <>
              {activePortfolio === "crypto" && <CryptoPortfolio />}
              {activePortfolio === "stocks" && <StocksPortfolio />}
              {activePortfolio === "options" && <OptionsPortfolio />}
              {activePortfolio === "etfs" && <ETFsPortfolio />}
            </>
          ) : (
            <>
              {activeHoldings === "crypto-holdings" && <CryptoHoldings />}
              {activeHoldings === "stocks-holdings" && <StocksHoldings />}
              {activeHoldings === "options-holdings" && <OptionsHoldings />}
              {activeHoldings === "etfs-holdings" && <ETFsHoldings />}
            </>
          )}
        </div>

        {/* TRADING PANEL - Always shows icons on right, expands left */}
        {tradingPanelOpen && (
          <div className="relative flex flex-col h-full border-r" style={{ background: 'rgb(0,0,0,0)', borderColor: 'rgb(0,0,0,0)' }}>
            {/* Tab Content Based on Active Tab */}
            {activeTradingTab === "risk" && (
              <div className="absolute inset-0 flex flex-col">
                {/* Header */}
                <div className="flex-shrink-0 px-3 py-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                  <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>
                    Risk Monitor
                  </Text>
                </div>

                {/* Risk Level */}
                <div className="px-3 py-4 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                  <Text size="1" className="mb-3 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                    Risk Level
                  </Text>
                  <Flex align="baseline" gap="2" className="mb-2">
                    <Text size="8" weight="bold" className="font-mono leading-none" style={{ color: 'var(--red-10)' }}>
                      73
                    </Text>
                    <Text size="2" style={{ color: 'var(--slate-11)' }}>/ 100</Text>
                  </Flex>
                  <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'var(--slate-6)' }}>
                    <div className="h-full w-[73%]" style={{ background: 'var(--red-9)' }}></div>
                  </div>
                  <div className="mb-2">
                    <Badge size="1" style={{ background: 'var(--red-4)', color: 'var(--red-11)', borderColor: 'var(--red-8)' }}>
                      High
                    </Badge>
                  </div>
                  <Text size="1" className="leading-relaxed" style={{ color: 'var(--slate-11)' }}>
                    Major divergence detected. Prediction markets showing conflicting signals with current price action.
                  </Text>
                </div>

                {/* Key Market Data */}
                <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                  <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                    Market Overview
                  </Text>
                  <div className="space-y-2">
                    <Flex justify="between">
                      <Text size="1" style={{ color: 'var(--slate-11)' }}>24h Volume</Text>
                      <Text size="1" weight="bold" className="font-mono" style={{ color: 'var(--slate-12)' }}>$42.1B</Text>
                    </Flex>
                    <Flex justify="between">
                      <Text size="1" style={{ color: 'var(--slate-11)' }}>24h Range</Text>
                      <Text size="1" className="font-mono" style={{ color: 'var(--slate-12)' }}>$97.8k - $99.2k</Text>
                    </Flex>
                  </div>
                </div>

                {/* Technical Indicators */}
                <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                  <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                    Technical
                  </Text>
                  <div className="space-y-2">
                    <Flex justify="between">
                      <Text size="1" style={{ color: 'var(--slate-11)' }}>RSI (14)</Text>
                      <Text size="1" className="font-mono" style={{ color: 'var(--red-10)' }}>67.8</Text>
                    </Flex>
                    <Flex justify="between">
                      <Text size="1" style={{ color: 'var(--slate-11)' }}>MACD</Text>
                      <Text size="1" className="font-mono" style={{ color: 'var(--green-11)' }}>+245</Text>
                    </Flex>
                  </div>
                </div>

                {/* Watchlist */}
                <div className="px-3 py-3 flex-1">
                  <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                    Watchlist
                  </Text>
                  <div className="space-y-1.5">
                    <Flex justify="between" className="py-1.5 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                      <Text size="1" style={{ color: 'var(--slate-12)' }}>ETH/USD</Text>
                      <Text size="1" className="font-mono" style={{ color: 'var(--green-11)' }}>+2.4%</Text>
                    </Flex>
                    <Flex justify="between" className="py-1.5 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                      <Text size="1" style={{ color: 'var(--slate-12)' }}>SOL/USD</Text>
                      <Text size="1" className="font-mono" style={{ color: 'var(--red-10)' }}>-1.2%</Text>
                    </Flex>
                    <Flex justify="between" className="py-1.5 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                      <Text size="1" style={{ color: 'var(--slate-12)' }}>AVAX/USD</Text>
                      <Text size="1" className="font-mono" style={{ color: 'var(--green-11)' }}>+5.8%</Text>
                    </Flex>
                    <Flex justify="between" className="py-1.5">
                      <Text size="1" style={{ color: 'var(--slate-12)' }}>MATIC/USD</Text>
                      <Text size="1" className="font-mono" style={{ color: 'var(--red-10)' }}>-0.8%</Text>
                    </Flex>
                  </div>
                </div>
              </div>
            )}

            {activeTradingTab === "trade" && (
              <div className="absolute inset-0 flex flex-col">
              {/* Header */}
              <div className="flex-shrink-0 px-3 py-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>
                  Trading
                </Text>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {/* Trade Type */}
              <div>
                <Text size="1" className="mb-3 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                  Type
                </Text>
                <Flex gap="3">
                  <button
                    onClick={() => setTradeType("long")}
                    className="flex-1 py-2 rounded font-medium transition-all"
                    style={{
                      background: tradeType === "long" ? 'var(--green-9)' : 'var(--slate-4)',
                      color: tradeType === "long" ? 'white' : 'var(--slate-11)',
                      border: tradeType === "long" ? 'none' : '1px solid var(--slate-6)'
                    }}
                  >
                    Long
                  </button>
                  <button
                    onClick={() => setTradeType("short")}
                    className="flex-1 py-2 rounded font-medium transition-all"
                    style={{
                      background: tradeType === "short" ? 'var(--red-9)' : 'var(--slate-4)',
                      color: tradeType === "short" ? 'white' : 'var(--slate-11)',
                      border: tradeType === "short" ? 'none' : '1px solid var(--slate-6)'
                    }}
                  >
                    Short
                  </button>
                </Flex>
              </div>

              {/* Position Size */}
              <div>
                <Flex justify="between" align="center" className="mb-2">
                  <Text size="1" className="uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                    Size
                  </Text>
                  <span className="px-2 py-0.5 rounded text-xs font-mono" style={{ background: 'var(--violet-4)', color: 'var(--violet-11)' }} title="AI suggests 0.25 based on risk level">
                    AI: 0.25
                  </span>
                </Flex>
                <input
                  type="text"
                  value={positionSize}
                  onChange={(e) => setPositionSize(e.target.value)}
                  className="w-full px-3 py-2 rounded border font-mono outline-none"
                  style={{
                    background: 'var(--slate-4)',
                    borderColor: 'var(--slate-7)',
                    color: 'var(--slate-12)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--blue-8)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--slate-7)'}
                />
                <Text size="1" style={{ color: 'var(--slate-11)' }} className="mt-1">
                  BTC
                </Text>
              </div>

              {/* Entry Price */}
              <div>
                <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                  Entry
                </Text>
                <input
                  type="text"
                  value={currentPrice}
                  readOnly
                  className="w-full px-3 py-2 rounded border font-mono"
                  style={{
                    background: 'var(--slate-4)',
                    borderColor: 'var(--slate-6)',
                    color: 'var(--slate-12)',
                    cursor: 'not-allowed'
                  }}
                />
                <Text size="1" style={{ color: 'var(--slate-11)' }} className="mt-1">
                  Market price
                </Text>
              </div>

              {/* Stop Loss */}
              <div>
                <Flex justify="between" align="center" className="mb-2">
                  <Text size="1" className="uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                    Stop Loss
                  </Text>
                  <button
                    onClick={() => setStopLoss("97,200")}
                    className="text-xs px-2 py-0.5 rounded transition-colors font-mono"
                    style={{ background: 'var(--violet-4)', color: 'var(--violet-11)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--violet-5)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--violet-4)'}
                    title="Use AI suggestion"
                  >
                    AI: 97.2k
                  </button>
                </Flex>
                <input
                  type="text"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="w-full px-3 py-2 rounded border font-mono outline-none"
                  style={{
                    background: 'var(--slate-4)',
                    borderColor: 'var(--slate-7)',
                    color: 'var(--slate-12)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--red-8)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--slate-7)'}
                />
              </div>

              {/* Take Profit */}
              <div>
                <Flex justify="between" align="center" className="mb-2">
                  <Text size="1" className="uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                    Take Profit
                  </Text>
                  <button
                    onClick={() => setTakeProfit("100,500")}
                    className="text-xs px-2 py-0.5 rounded transition-colors font-mono"
                    style={{ background: 'var(--violet-4)', color: 'var(--violet-11)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--violet-5)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--violet-4)'}
                    title="Use AI suggestion"
                  >
                    AI: 100.5k
                  </button>
                </Flex>
                <input
                  type="text"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  className="w-full px-3 py-2 rounded border font-mono outline-none"
                  style={{
                    background: 'var(--slate-4)',
                    borderColor: 'var(--slate-7)',
                    color: 'var(--slate-12)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--green-8)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--slate-7)'}
                />
              </div>

              {/* Execute Button */}
              <div className="mt-auto pt-4">
                <Button
                  size="3"
                  className="w-full font-bold cursor-pointer flex items-center justify-center"
                  style={{
                    background: tradeType === "long" ? 'var(--green-9)' : 'var(--red-9)',
                    color: 'white'
                  }}
                >
                  {tradeType === "long" ? "Open Long Position" : "Open Short Position"}
                </Button>
                <Flex justify="center" align="center" gap="1" className="mt-4">
                  <div className="w-1 h-1 rounded-full" style={{ background: 'var(--red-9)' }}></div>
                  <Text size="1" style={{ color: 'var(--slate-11)' }}>
                    Risk: High (73/100)
                  </Text>
                </Flex>
              </div>
              </div>
              </div>
            )}

              {/* Portfolio Tab */}
              {activeTradingTab === "portfolio" && (
                <div className="absolute inset-0 flex flex-col">
                  {/* Header */}
                  <div className="flex-shrink-0 px-3 py-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                    <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>
                      Portfolio
                    </Text>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
                  {/* Portfolio Summary */}
                  <div className="mb-4 p-4 rounded border" style={{ background: 'var(--slate-4)', borderColor: 'var(--slate-6)' }}>
                    <Text size="1" className="mb-4 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                      Total Portfolio Value
                    </Text>
                    <Text size="6" weight="bold" className="font-mono block mb-3" style={{ color: 'var(--slate-12)' }}>
                      $142,847.23
                    </Text>
                    <Flex align="center" gap="2">
                      <Text size="2" className="font-mono" style={{ color: 'var(--green-11)' }}>
                        +$8,492.15
                      </Text>
                      <Text size="2" style={{ color: 'var(--slate-11)' }}>
                        (6.32%)
                      </Text>
                    </Flex>
                  </div>

                  {/* Open Positions */}
                  <Text size="1" className="mb-3 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                    Open Positions
                  </Text>
                  <div className="space-y-3">
                    {[
                      {
                        market: "BTC/USD",
                        direction: "LONG",
                        badgeColor: { bg: 'var(--green-4)', text: 'var(--green-11)' },
                        fields: [
                          { label: "Size", value: "0.5 BTC" },
                          { label: "Entry", value: "$96,250" },
                          { label: "P&L", value: "+$1,246.15", color: 'var(--green-11)' },
                        ],
                      },
                      {
                        market: "ETH/USD",
                        direction: "SHORT",
                        badgeColor: { bg: 'var(--red-4)', text: 'var(--red-10)' },
                        fields: [
                          { label: "Size", value: "2.0 ETH" },
                          { label: "Entry", value: "$3,842" },
                          { label: "P&L", value: "-$184.50", color: 'var(--red-10)' },
                        ],
                      },
                    ].map((position) => (
                      <div key={position.market} className="p-3 border rounded space-y-2" style={{ background: 'var(--slate-4)', borderColor: 'var(--slate-6)' }}>
                        <Flex justify="between" align="center">
                          <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>{position.market}</Text>
                          <Badge size="1" style={{ background: position.badgeColor.bg, color: position.badgeColor.text }}>{position.direction}</Badge>
                        </Flex>
                        {position.fields.map((field) => (
                          <Flex key={field.label} justify="between" align="center">
                            <Text size="1" style={{ color: 'var(--slate-11)' }}>{field.label}</Text>
                            <Text size="1" className="font-mono" style={{ color: field.color || 'var(--slate-12)' }}>
                              {field.value}
                            </Text>
                          </Flex>
                        ))}
                        <Flex gap="2">
                          <Button
                            size="1"
                            className="flex-1 cursor-pointer"
                            style={{ background: 'var(--slate-5)', color: 'var(--slate-12)' }}
                          >
                            Adjust Size
                          </Button>
                          <Button
                            size="1"
                            className="flex-1 cursor-pointer"
                            style={{ background: 'var(--red-9)', color: 'white' }}
                          >
                            Close Position
                          </Button>
                        </Flex>
                      </div>
                    ))}
                  </div>
                  <Text size="1" className="mt-6 mb-3 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                    Open Orders
                  </Text>
                  <div className="space-y-3">
                    {openOrders.map((order, idx) => (
                      <div key={idx} className="p-3 border rounded" style={{ background: 'var(--slate-4)', borderColor: 'var(--slate-6)' }}>
                        <Flex justify="between" align="center" className="mb-2">
                          <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>{order.market}</Text>
                          <Badge size="1" style={{ background: order.badgeColor.bg, color: order.badgeColor.text }}>{order.badge}</Badge>
                        </Flex>
                        {order.rows.map((row) => (
                          <Flex key={row.label} justify="between" className="mb-1">
                            <Text size="1" style={{ color: 'var(--slate-11)' }}>{row.label}</Text>
                            <Text size="1" className="font-mono" style={{ color: 'var(--slate-12)' }}>{row.value}</Text>
                          </Flex>
                        ))}
                        <Flex justify="between" className="mb-2">
                          <Text size="1" style={{ color: 'var(--slate-11)' }}>Placed</Text>
                          <Text size="1" style={{ color: 'var(--slate-11)' }}>{order.placed}</Text>
                        </Flex>
                        <Button size="1" className="w-full cursor-pointer" style={{ background: 'var(--red-9)', color: 'white' }}>
                          Cancel Order
                        </Button>
                      </div>
                    ))}
                  </div>
                  </div>
                </div>
              )}


              {/* History Tab */}
              {activeTradingTab === "history" && (
                <div className="absolute inset-0 flex flex-col">
                  {/* Header */}
                  <div className="flex-shrink-0 px-3 py-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                    <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>
                      Trade History
                    </Text>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
                  <div className="space-y-3">
                    <div className="p-3 border rounded" style={{ background: 'var(--slate-4)', borderColor: 'var(--slate-6)' }}>
                      <Flex justify="between" align="center" className="mb-2">
                        <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>BTC/USD LONG</Text>
                        <Text size="2" weight="bold" className="font-mono" style={{ color: 'var(--green-11)' }}>+$2,847</Text>
                      </Flex>
                      <Flex justify="between" className="mb-1">
                        <Text size="1" style={{ color: 'var(--slate-11)' }}>Entry: $94,200</Text>
                        <Text size="1" style={{ color: 'var(--slate-11)' }}>Exit: $98,900</Text>
                      </Flex>
                      <Text size="1" style={{ color: 'var(--slate-11)' }}>2 hours ago • 0.6 BTC</Text>
                    </div>

                    <div className="p-3 border rounded" style={{ background: 'var(--slate-4)', borderColor: 'var(--slate-6)' }}>
                      <Flex justify="between" align="center" className="mb-1">
                        <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>SOL/USD SHORT</Text>
                        <Text size="1" weight="bold" className="font-mono" style={{ color: 'var(--red-10)' }}>-$420</Text>
                      </Flex>
                      <Flex justify="between" className="mb-0.5">
                        <Text size="1" style={{ color: 'var(--slate-11)' }}>Entry: $142</Text>
                        <Text size="1" style={{ color: 'var(--slate-11)' }}>Exit: $156</Text>
                      </Flex>
                      <Text size="1" style={{ color: 'var(--slate-11)' }}>5 hours ago • 30 SOL</Text>
                    </div>

                    <div className="p-3 border rounded" style={{ background: 'var(--slate-4)', borderColor: 'var(--slate-6)' }}>
                      <Flex justify="between" align="center" className="mb-1">
                        <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>ETH/USD LONG</Text>
                        <Text size="1" weight="bold" className="font-mono" style={{ color: 'var(--green-11)' }}>+$1,240</Text>
                      </Flex>
                      <Flex justify="between" className="mb-0.5">
                        <Text size="1" style={{ color: 'var(--slate-11)' }}>Entry: $3,680</Text>
                        <Text size="1" style={{ color: 'var(--slate-11)' }}>Exit: $3,920</Text>
                      </Flex>
                      <Text size="1" style={{ color: 'var(--slate-11)' }}>1 day ago • 5.2 ETH</Text>
                    </div>

                    <div className="p-3 border rounded" style={{ background: 'var(--slate-4)', borderColor: 'var(--slate-6)' }}>
                      <Flex justify="between" align="center" className="mb-1">
                        <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>BTC/USD LONG</Text>
                        <Text size="1" weight="bold" className="font-mono" style={{ color: 'var(--green-11)' }}>+$892</Text>
                      </Flex>
                      <Flex justify="between" className="mb-0.5">
                        <Text size="1" style={{ color: 'var(--slate-11)' }}>Entry: $92,100</Text>
                        <Text size="1" style={{ color: 'var(--slate-11)' }}>Exit: $93,384</Text>
                      </Flex>
                      <Text size="1" style={{ color: 'var(--slate-11)' }}>2 days ago • 0.7 BTC</Text>
                    </div>
                  </div>
                  </div>
                </div>
              )}
          </div>
        )}

        {/* ICON SIDEBAR - Always Visible */}
        <div className="flex flex-col" style={{ background: 'var(--slate-2)' }}>
          <div className="flex flex-col items-center py-4 gap-4 px-2">
            {/* Risk Icon - Dynamic based on risk level */}
            <button
              onClick={() => {
                setActiveTradingTab("risk");
                setTradingPanelOpen(true);
              }}
              className="w-8 h-8 rounded flex items-center justify-center transition-colors relative"
              style={{
                background: activeTradingTab === "risk" && tradingPanelOpen
                  ? (riskLevel === "high" ? 'var(--red-5)' : riskLevel === "medium" ? 'var(--yellow-5)' : 'var(--green-5)')
                  : (riskLevel === "high" ? 'var(--red-4)' : riskLevel === "medium" ? 'var(--yellow-4)' : 'var(--green-4)'),
                color: riskLevel === "high" ? 'var(--red-11)' : riskLevel === "medium" ? 'var(--yellow-11)' : 'var(--green-11)'
              }}
              onMouseEnter={(e) => {
                if (!(activeTradingTab === "risk" && tradingPanelOpen)) {
                  e.currentTarget.style.background = riskLevel === "high" ? 'var(--red-5)' : riskLevel === "medium" ? 'var(--yellow-5)' : 'var(--green-5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!(activeTradingTab === "risk" && tradingPanelOpen)) {
                  e.currentTarget.style.background = riskLevel === "high" ? 'var(--red-4)' : riskLevel === "medium" ? 'var(--yellow-4)' : 'var(--green-4)';
                }
              }}
              title={`Risk Monitor: ${riskLevel === "high" ? "High" : riskLevel === "medium" ? "Medium" : "Low"} Risk`}
            >
              <ExclamationTriangleIcon width="18" height="18" />
              {/* Only show notification dot when risk is high */}
              {riskLevel === "high" && (
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border"
                     style={{ background: 'var(--red-9)', borderColor: 'var(--slate-2)' }}></div>
              )}
            </button>

            {/* Trade Icon */}
            <button
              onClick={() => {
                setActiveTradingTab("trade");
                setTradingPanelOpen(true);
              }}
              className="w-8 h-8 rounded flex items-center justify-center transition-colors"
              style={{
                background: 'transparent',
                color: 'var(--slate-11)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--slate-4)';
                e.currentTarget.style.color = 'var(--slate-12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--slate-11)';
              }}
              title="Trading"
            >
              <BarChartIcon width="18" height="18" />
            </button>

            {/* Portfolio Icon */}
            <button
              onClick={() => {
                setActiveTradingTab("portfolio");
                setTradingPanelOpen(true);
              }}
              className="w-8 h-8 rounded flex items-center justify-center transition-colors"
              style={{
                background: 'transparent',
                color: 'var(--slate-11)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--slate-4)';
                e.currentTarget.style.color = 'var(--slate-12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--slate-11)';
              }}
              title="Portfolio"
            >
              <DashboardIcon width="18" height="18" />
            </button>

            {/* History Icon */}
            <button
              onClick={() => {
                setActiveTradingTab("history");
                setTradingPanelOpen(true);
              }}
              className="w-8 h-8 rounded flex items-center justify-center transition-colors"
              style={{
                background: 'transparent',
                color: 'var(--slate-11)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--slate-4)';
                e.currentTarget.style.color = 'var(--slate-12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--slate-11)';
              }}
              title="History"
            >
              <ActivityLogIcon width="18" height="18" />
            </button>

            {/* Settings Icon */}
            <div className="mt-auto">
              <button
                onClick={() => setSettingsOpen(true)}
                className="w-8 h-8 rounded flex items-center justify-center transition-colors"
                style={{
                  background: 'transparent',
                  color: 'var(--slate-11)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--slate-4)';
                  e.currentTarget.style.color = 'var(--slate-12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--slate-11)';
                }}
                title="Settings"
              >
                <GearIcon width="18" height="18" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Agent Chatbot Modal */}
      <AnimatePresence>
        {agentExpanded && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => setAgentExpanded(false)}
            />

            {/* Modal */}
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
                {/* Gradient Overlay */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.03), transparent, rgba(139, 92, 246, 0.03))' }}></div>

                <div className="relative h-full flex flex-col">
                  {/* Header */}
                  <div className="p-4 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                    <Flex justify="between" align="center">
                      <Flex align="center" gap="3">
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl border-2 shadow-lg relative" style={{ background: 'linear-gradient(135deg, var(--red-9), var(--red-10))', borderColor: 'var(--red-7)' }}>
                          <div className="absolute inset-0 rounded-lg" style={{ background: 'linear-gradient(135deg, transparent, rgba(139, 92, 246, 0.2))' }}></div>
                          <span className="relative z-10">🎯</span>
                        </div>
                        <div>
                          <Text size="4" weight="bold" className="tracking-tight" style={{ color: 'var(--slate-12)' }}>
                            Agent Divergence
                          </Text>
                          <Flex align="center" gap="1">
                            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--green-9)' }}></div>
                            <Text size="1" weight="medium" style={{ color: 'var(--green-11)' }}>
                              Online & Monitoring
                            </Text>
                          </Flex>
                        </div>
                      </Flex>
                      <button
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                        style={{ color: 'var(--slate-11)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--slate-4)';
                          e.currentTarget.style.color = 'var(--slate-12)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--slate-11)';
                        }}
                        onClick={() => setAgentExpanded(false)}
                      >
                        <Text size="4">✕</Text>
                      </button>
                    </Flex>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                    {messages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] ${msg.role === 'agent' ? 'order-2' : ''}`}>
                          <Flex gap="2" className={msg.role === 'user' ? 'flex-row-reverse' : ''}>
                            {msg.role === 'agent' && (
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg flex-shrink-0" style={{ background: 'linear-gradient(135deg, var(--red-9), var(--red-10))' }}>
                                🎯
                              </div>
                            )}
                            <div className="flex flex-col gap-1">
                              <div
                                className="px-4 py-2 rounded-lg"
                                style={{
                                  background: msg.role === 'agent' ? 'var(--slate-3)' : 'var(--red-9)',
                                  color: msg.role === 'agent' ? 'var(--slate-12)' : 'white'
                                }}
                              >
                                <Text size="2">{msg.text}</Text>
                              </div>
                              <Text size="1" className={msg.role === 'user' ? 'text-right' : ''} style={{ color: 'var(--slate-11)' }}>
                                {msg.time}
                              </Text>
                            </div>
                          </Flex>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t" style={{ borderColor: 'var(--slate-6)' }}>
                    <Flex gap="2">
                      <input
                        type="text"
                        placeholder="Ask me about the markets..."
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        className="flex-1 px-3 py-2 rounded-lg border outline-none transition-colors"
                        style={{
                          background: 'var(--slate-4)',
                          borderColor: 'var(--slate-7)',
                          color: 'var(--slate-12)'
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--red-8)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--slate-7)'}
                      />
                      <Button
                        onClick={handleSendMessage}
                        style={{ background: 'var(--red-9)', color: 'white', cursor: 'pointer' }}
                      >
                        Send
                      </Button>
                    </Flex>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' }}
              onClick={() => setSettingsOpen(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-8"
              onClick={() => setSettingsOpen(false)}
            >
              <div
                className="relative w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-lg shadow-2xl border"
                style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="h-full flex flex-col">
                  {/* Header */}
                  <div className="p-4 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                    <Flex justify="between" align="center">
                      <Text size="5" weight="bold" style={{ color: 'var(--slate-12)' }}>
                        Settings
                      </Text>
                      <button
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                        style={{ color: 'var(--slate-11)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--slate-4)';
                          e.currentTarget.style.color = 'var(--slate-12)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--slate-11)';
                        }}
                        onClick={() => setSettingsOpen(false)}
                      >
                        <Text size="4">✕</Text>
                      </button>
                    </Flex>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    <div className="space-y-6">
                      {/* AI Agent Configuration */}
                      <div>
                        <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--slate-12)' }}>
                          AI Agent Configuration
                        </Text>
                        <div className="space-y-4">
                          <div className="p-4 rounded border" style={{ background: 'var(--slate-3)', borderColor: 'var(--slate-6)' }}>
                            <Flex justify="between" align="center" className="mb-2">
                              <div>
                                <Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>Enable Voice Alerts</Text>
                                <Text size="1" style={{ color: 'var(--slate-11)' }}>Agent will speak when anomalies are detected</Text>
                              </div>
                              <input type="checkbox" defaultChecked className="w-5 h-5" />
                            </Flex>
                          </div>

                          <div className="p-4 rounded border" style={{ background: 'var(--slate-3)', borderColor: 'var(--slate-6)' }}>
                            <Flex justify="between" align="center" className="mb-2">
                              <div>
                                <Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>Auto-Interrupt Trading</Text>
                                <Text size="1" style={{ color: 'var(--slate-11)' }}>Block trades when risk level is critical</Text>
                              </div>
                              <input type="checkbox" className="w-5 h-5" />
                            </Flex>
                          </div>

                          <div className="p-4 rounded border" style={{ background: 'var(--slate-3)', borderColor: 'var(--slate-6)' }}>
                            <Text size="2" weight="medium" className="mb-2 block" style={{ color: 'var(--slate-12)' }}>Risk Threshold</Text>
                            <Text size="1" className="mb-3 block" style={{ color: 'var(--slate-11)' }}>Alert when risk level exceeds</Text>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              defaultValue="70"
                              className="w-full"
                              style={{ accentColor: 'var(--red-9)' }}
                            />
                            <Flex justify="between" className="mt-2">
                              <Text size="1" style={{ color: 'var(--slate-11)' }}>Low</Text>
                              <Text size="1" style={{ color: 'var(--slate-11)' }}>High</Text>
                            </Flex>
                          </div>
                        </div>
                      </div>

                      {/* Trading Preferences */}
                      <div>
                        <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--slate-12)' }}>
                          Trading Preferences
                        </Text>
                        <div className="space-y-4">
                          <div className="p-4 rounded border" style={{ background: 'var(--slate-3)', borderColor: 'var(--slate-6)' }}>
                            <Flex justify="between" align="center" className="mb-2">
                              <div>
                                <Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>Confirm Before Execute</Text>
                                <Text size="1" style={{ color: 'var(--slate-11)' }}>Require confirmation for all trades</Text>
                              </div>
                              <input type="checkbox" defaultChecked className="w-5 h-5" />
                            </Flex>
                          </div>

                          <div className="p-4 rounded border" style={{ background: 'var(--slate-3)', borderColor: 'var(--slate-6)' }}>
                            <Text size="2" weight="medium" className="mb-2 block" style={{ color: 'var(--slate-12)' }}>Default Position Size</Text>
                            <input
                              type="text"
                              defaultValue="0.5"
                              className="w-full px-3 py-2 rounded border font-mono"
                              style={{
                                background: 'var(--slate-4)',
                                borderColor: 'var(--slate-7)',
                                color: 'var(--slate-12)'
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Data Sources */}
                      <div>
                        <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--slate-12)' }}>
                          Data Sources
                        </Text>
                        <div className="space-y-4">
                          <div className="p-4 rounded border" style={{ background: 'var(--slate-3)', borderColor: 'var(--slate-6)' }}>
                            <Flex justify="between" align="center">
                              <div>
                                <Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>Polymarket Integration</Text>
                                <Text size="1" style={{ color: 'var(--green-11)' }}>Connected</Text>
                              </div>
                              <Badge style={{ background: 'var(--green-4)', color: 'var(--green-11)' }}>Active</Badge>
                            </Flex>
                          </div>

                          <div className="p-4 rounded border" style={{ background: 'var(--slate-3)', borderColor: 'var(--slate-6)' }}>
                            <Flex justify="between" align="center">
                              <div>
                                <Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>Reddit Sentiment</Text>
                                <Text size="1" style={{ color: 'var(--green-11)' }}>Connected</Text>
                              </div>
                              <Badge style={{ background: 'var(--green-4)', color: 'var(--green-11)' }}>Active</Badge>
                            </Flex>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-4 border-t" style={{ borderColor: 'var(--slate-6)' }}>
                    <Flex justify="end" gap="3">
                      <Button
                        onClick={() => setSettingsOpen(false)}
                        style={{ background: 'var(--slate-4)', color: 'var(--slate-12)', cursor: 'pointer' }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => setSettingsOpen(false)}
                        style={{ background: 'var(--blue-9)', color: 'white', cursor: 'pointer' }}
                      >
                        Save Changes
                      </Button>
                    </Flex>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
