"use client";

import { useState, useEffect } from "react";
import { Text, Flex, DropdownMenu, Button, ChevronDownIcon, Badge } from "@radix-ui/themes";
import { motion, AnimatePresence } from "framer-motion";
import { BarChartIcon, DashboardIcon, ActivityLogIcon, ExclamationTriangleIcon, GearIcon, ArrowLeftIcon } from "@radix-ui/react-icons";
import SideMenu from "./components/SideMenu";
import CryptoPortfolio from "./components/portfolios/CryptoPortfolio";
import StocksPortfolio from "./components/portfolios/StocksPortfolio";
import OptionsPortfolio from "./components/portfolios/OptionsPortfolio";
import { useAlpacaWebSocket } from "@/hooks/useAlpacaWebSocket";
import type { AlpacaMessage } from "@/lib/websocket";
import ETFsPortfolio from "./components/portfolios/ETFsPortfolio";
import CryptoHoldings from "./components/holdings/CryptoHoldings";
import StocksHoldings from "./components/holdings/StocksHoldings";
import OptionsHoldings from "./components/holdings/OptionsHoldings";
import ETFsHoldings from "./components/holdings/ETFsHoldings";
import PolymarketPanel from "./components/PolymarketPanel";
import TradingPanel from "./components/TradingPanel";
import LiveAlpacaChart from "./components/LiveAlpacaChart";
import CryptoHoldingsDashboard from "./components/CryptoHoldingsDashboard";
import { api, type RedditPost, type SentimentStats } from "@/app/lib/api";

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

export default function Home() {
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [agentExpanded, setAgentExpanded] = useState(false);
  const [sentimentExpanded, setSentimentExpanded] = useState(false);
  const [tradingPanelOpen, setTradingPanelOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTradingTab, setActiveTradingTab] = useState<"risk" | "trade" | "portfolio" | "history">("risk");
  const [hoveredIcon, setHoveredIcon] = useState<"risk" | "trade" | "portfolio" | "history" | "settings" | null>(null);
  const [riskLevel, setRiskLevel] = useState<"low" | "medium" | "high">("low");
  const [riskScore, setRiskScore] = useState<number>(0);
  const [currentPrice, setCurrentPrice] = useState("0");
  const [priceChange, setPriceChange] = useState("0");
  const [currentTime, setCurrentTime] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [positionSize, setPositionSize] = useState("");
  const [tradeType, setTradeType] = useState<"long" | "short">("long");
  const [stopLoss, setStopLoss] = useState("97,200");
  const [takeProfit, setTakeProfit] = useState("100,500");
  const [messages, setMessages] = useState([
    { role: "agent", text: "Hey trader! I'm watching BTC/USD for you. Ask me anything about the markets! 💹", time: "14:30:12" },
  ]);
  const [selectedSubreddit, setSelectedSubreddit] = useState<SubredditOption>("All");
  const [subredditDropdownOpen, setSubredditDropdownOpen] = useState(false);
  const [activePortfolio, setActivePortfolio] = useState<PortfolioView>(null);
  const [activeHoldings, setActiveHoldings] = useState<HoldingsView>(null);
  const [homeResetKey, setHomeResetKey] = useState(0);
  const [navbarHolding, setNavbarHolding] = useState<{ symbol: string; name: string } | null>(null);

  // API Data States
  const [redditPosts, setRedditPosts] = useState<RedditPost[]>([]);
  const [sentimentStats, setSentimentStats] = useState<SentimentStats | null>(null);
  const [loadingReddit, setLoadingReddit] = useState(true);
  const [loadingSentiment, setLoadingSentiment] = useState(true);

  // Handle WebSocket messages for live BTC price
  const handlePriceMessage = (message: AlpacaMessage) => {
    if (message.type === "bar" && message.data) {
      const barData = message.data;
      // Check if it's BTC
      const symbol = barData.symbol?.toUpperCase() || "";
      if (symbol.includes("BTC") || symbol === "BTC") {
        const price = barData.close;
        if (price && price > 0) {
          setCurrentPrice(
            price.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          );
        }
      }
    } else if (message.type === "trade" && message.data) {
      const tradeData = message.data;
      // Check if it's BTC
      const symbol = tradeData.symbol?.toUpperCase() || "";
      if (symbol.includes("BTC") || symbol === "BTC") {
        const price = tradeData.price;
        if (price && price > 0) {
          setCurrentPrice(
            price.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          );
        }
      }
    }
  };

  // WebSocket connection for live BTC price updates
  useAlpacaWebSocket({
    symbols: ["BTC"],
    dataType: "crypto",
    onMessage: handlePriceMessage,
    autoConnect: true,
  });

  // Listen for holding selection events from CryptoHoldings component
  useEffect(() => {
    const handleHoldingSelected = (event: CustomEvent<{ symbol: string; name: string } | null>) => {
      setNavbarHolding(event.detail);
    };
    window.addEventListener('holdingSelectedForNavbar', handleHoldingSelected as EventListener);
    return () => {
      window.removeEventListener('holdingSelectedForNavbar', handleHoldingSelected as EventListener);
    };
  }, []);

  // Fetch risk level from risk monitor (price comes from WebSocket)
  useEffect(() => {
    const fetchRisk = async () => {
      try {
        const riskData = await api.getRiskMonitor();
        const score = riskData?.risk_level?.score ?? 0;
        setRiskScore(score);
        if (score < 40) {
          setRiskLevel("low");
        } else if (score < 70) {
          setRiskLevel("medium");
        } else {
          setRiskLevel("high");
        }
      } catch (error) {
        console.error("Failed to fetch risk:", error);
        setRiskLevel("low");
        setRiskScore(0);
      }
    };

    fetchRisk();
    const interval = setInterval(fetchRisk, 5000);
    return () => clearInterval(interval);
  }, []);

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

  // Update time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Reset sentiment panel when subreddit changes
  useEffect(() => {
    setSentimentExpanded(false);
  }, [selectedSubreddit]);

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;

    const newUserMsg = {
      role: "user" as const,
      text: messageInput,
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    setMessages(prev => [...prev, newUserMsg]);
    setMessageInput("");

    setTimeout(() => {
      const agentResponse = {
        role: "agent" as const,
        text: "Let me check the charts for you... 📊",
        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      setMessages(prev => [...prev, agentResponse]);
    }, 500);
  };

  const sentimentScoreLabel = sentimentStats ? (sentimentStats.score > 0 ? `+${sentimentStats.score}` : `${sentimentStats.score}`) : '0';
  const priceChangeColor = parseFloat(priceChange) >= 0 ? 'var(--green-11)' : 'var(--red-10)';
  const priceChangePrefix = parseFloat(priceChange) >= 0 ? '+' : '';

  return (
    <main className="h-screen w-screen overflow-hidden" style={{ background: 'var(--slate-1)' }}>
      {/* Top Bar */}
      <div className="h-16 border-b flex items-center px-4 justify-between" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
        <Flex align="center" gap="3">
          {navbarHolding && (
            <div>
              <Text size="6" weight="bold" style={{ color: 'var(--slate-12)' }}>
                {navbarHolding.symbol}
              </Text>
              <Text size="2" className="block" style={{ color: 'var(--slate-11)' }}>
                {navbarHolding.name}
              </Text>
            </div>
          )}
        </Flex>
        <Flex align="center" gap="3">
          <div className="flex items-center gap-3">
            {navbarHolding && (
              <Button
                variant="soft"
                onClick={() => {
                  const event = new CustomEvent('returnToHoldings');
                  window.dispatchEvent(event);
                }}
                style={{ cursor: 'pointer', marginRight: '1rem' }}
              >
                <ArrowLeftIcon /> Return
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1.5" style={{ minWidth: '140px' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green-9)' }}></div>
            <Text size="2" className="font-mono" style={{ color: 'var(--slate-11)', whiteSpace: 'nowrap' }}>
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
        onHomeSelect={() => {
          setActivePortfolio(null);
          setActiveHoldings(null);
          setSideMenuOpen(false);
          setHomeResetKey(prev => prev + 1); // Trigger reset of holdings dashboard filter
        }}
      />

      <div className="flex h-[calc(100vh-3rem)] gap-0">
        {/* LEFT COLUMN */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Main Content Area - scrollable */}
          <div className="flex-1 border-r overflow-hidden min-h-0" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
            {activePortfolio === null && activeHoldings === null ? (
              <CryptoHoldingsDashboard
                key={homeResetKey}
                resetFilter={homeResetKey > 0}
                onHoldingClick={(holding) => {
                  // Navigate to the appropriate holdings view based on type
                  const holdingsViewMap: Record<string, HoldingsView> = {
                    crypto: "crypto-holdings",
                    stocks: "stocks-holdings",
                    options: "options-holdings",
                    etfs: "etfs-holdings"
                  };
                  const holdingsView = holdingsViewMap[holding.type];
                  if (holdingsView) {
                    setActiveHoldings(holdingsView);
                    // Store the holding to select in the holdings component
                    // We'll need to pass this through props or context
                    setTimeout(() => {
                      // Use a small delay to ensure the component is mounted
                      const event = new CustomEvent('selectHolding', { detail: holding });
                      window.dispatchEvent(event);
                    }, 100);
                  }
                }}
              />
            ) : activePortfolio !== null ? (
              <>
                {activePortfolio === "crypto" && <CryptoPortfolio />}
                {activePortfolio === "stocks" && <StocksPortfolio />}
                {activePortfolio === "options" && <OptionsPortfolio />}
                {activePortfolio === "etfs" && <ETFsPortfolio />}
              </>
            ) : (
              <>
                {activeHoldings === "crypto-holdings" && <CryptoHoldings onReturn={() => setActiveHoldings(null)} />}
                {activeHoldings === "stocks-holdings" && <StocksHoldings />}
                {activeHoldings === "options-holdings" && <OptionsHoldings />}
                {activeHoldings === "etfs-holdings" && <ETFsHoldings />}
              </>
            )}
          </div>

          {/* Bottom Data Panels - REMOVED - taking up too much space */}
          {false && (
            <div className="shrink-0 border-t border-r flex gap-0" style={{ borderColor: 'var(--slate-6)' }}>
                {/* VTuber Profile Card */}
                <div
                  className="shrink-0 border-r cursor-pointer flex items-center justify-center"
                  style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)', width: '16rem', height: '16rem' }}
                  onClick={() => setAgentExpanded(!agentExpanded)}
                >
                  <div className="w-[12.5rem] h-[12.5rem] rounded-lg flex items-center justify-center text-6xl border-2 shadow-lg relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--red-9), var(--red-10))', borderColor: 'var(--red-7)' }}>
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, transparent, rgba(139, 92, 246, 0.2))' }}></div>
                    <span className="relative z-10">🎯</span>
                    <div className="absolute bottom-3 right-3 w-4 h-4 rounded-full border-2" style={{ background: 'var(--green-9)', borderColor: 'var(--slate-2)' }}></div>
                  </div>
                </div>

                {/* Polymarket Panel - Using Component */}
                <div className="flex-1 min-w-0">
                  <PolymarketPanel />
                </div>

                {/* Social Sentiment Panel */}
                <div
                  className="flex-1 p-3 flex flex-col cursor-pointer min-w-0"
                  style={{ background: 'var(--slate-2)', height: '16rem' }}
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
                            <Text size="4" weight="bold" className="font-mono" style={{ color: (sentimentStats.score ?? 0) >= 0 ? 'var(--green-11)' : 'var(--red-10)' }}>{sentimentScoreLabel}</Text>
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
          )}
        </div>

        {/* TRADING PANEL - Using Component */}
        {tradingPanelOpen && (
          <TradingPanel
            activeTradingTab={activeTradingTab}
            tradeType={tradeType}
            setTradeType={setTradeType}
            positionSize={positionSize}
            setPositionSize={setPositionSize}
            currentPrice={currentPrice}
            stopLoss={stopLoss}
            setStopLoss={setStopLoss}
            takeProfit={takeProfit}
            setTakeProfit={setTakeProfit}
            riskLevel={riskLevel}
            riskScore={riskScore}
          />
        )}

        {/* ICON SIDEBAR */}
        <div className="flex flex-col" style={{ background: 'var(--slate-2)' }}>
          <div className="flex flex-col items-center py-4 gap-4 px-2">
            <button
              onClick={() => { setActiveTradingTab("risk"); setTradingPanelOpen(true); }}
              className="w-8 h-8 rounded flex items-center justify-center transition-colors relative"
              style={{
                background: hoveredIcon === "risk"
                  ? (riskLevel === "high" ? 'var(--red-6)' : riskLevel === "medium" ? 'var(--yellow-6)' : 'var(--green-6)')
                  : activeTradingTab === "risk" && tradingPanelOpen
                    ? (riskLevel === "high" ? 'var(--red-5)' : riskLevel === "medium" ? 'var(--yellow-5)' : 'var(--green-5)')
                    : (riskLevel === "high" ? 'var(--red-4)' : riskLevel === "medium" ? 'var(--yellow-4)' : 'var(--green-4)'),
                color: riskLevel === "high" ? 'var(--red-11)' : riskLevel === "medium" ? 'var(--yellow-11)' : 'var(--green-11)'
              }}
              title={`Risk Monitor: ${riskLevel === "high" ? "High" : riskLevel === "medium" ? "Medium" : "Low"} Risk`}
              onMouseEnter={() => setHoveredIcon("risk")}
              onMouseLeave={() => setHoveredIcon(null)}
            >
              <ExclamationTriangleIcon width="18" height="18" />
              {riskLevel === "high" && (
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border"
                  style={{ background: 'var(--red-9)', borderColor: 'var(--slate-2)' }}></div>
              )}
            </button>

            <button
              onClick={() => { setActiveTradingTab("trade"); setTradingPanelOpen(true); }}
              className="w-8 h-8 rounded flex items-center justify-center transition-colors"
              style={{
                background: hoveredIcon === "trade" ? 'var(--slate-4)' : 'transparent',
                color: hoveredIcon === "trade" || activeTradingTab === "trade" ? 'var(--slate-12)' : 'var(--slate-11)'
              }}
              title="Trading"
              onMouseEnter={() => setHoveredIcon("trade")}
              onMouseLeave={() => setHoveredIcon(null)}
            >
              <BarChartIcon width="18" height="18" />
            </button>

            <button
              onClick={() => { setActiveTradingTab("portfolio"); setTradingPanelOpen(true); }}
              className="w-8 h-8 rounded flex items-center justify-center transition-colors"
              style={{
                background: hoveredIcon === "portfolio" ? 'var(--slate-4)' : 'transparent',
                color: hoveredIcon === "portfolio" || activeTradingTab === "portfolio" ? 'var(--slate-12)' : 'var(--slate-11)'
              }}
              title="Portfolio"
              onMouseEnter={() => setHoveredIcon("portfolio")}
              onMouseLeave={() => setHoveredIcon(null)}
            >
              <DashboardIcon width="18" height="18" />
            </button>

            <button
              onClick={() => { setActiveTradingTab("history"); setTradingPanelOpen(true); }}
              className="w-8 h-8 rounded flex items-center justify-center transition-colors"
              style={{
                background: hoveredIcon === "history" ? 'var(--slate-4)' : 'transparent',
                color: hoveredIcon === "history" || activeTradingTab === "history" ? 'var(--slate-12)' : 'var(--slate-11)'
              }}
              title="History"
              onMouseEnter={() => setHoveredIcon("history")}
              onMouseLeave={() => setHoveredIcon(null)}
            >
              <ActivityLogIcon width="18" height="18" />
            </button>

            <div className="mt-auto">
              <button
                onClick={() => setSettingsOpen(true)}
                className="w-8 h-8 rounded flex items-center justify-center transition-colors"
                style={{
                  background: hoveredIcon === "settings" ? 'var(--slate-4)' : 'transparent',
                  color: hoveredIcon === "settings" ? 'var(--slate-12)' : 'var(--slate-11)'
                }}
                title="Settings"
                onMouseEnter={() => setHoveredIcon("settings")}
                onMouseLeave={() => setHoveredIcon(null)}
              >
                <GearIcon width="18" height="18" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Modal */}
      <AnimatePresence>
        {agentExpanded && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50" style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setAgentExpanded(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="fixed inset-0 z-50 flex items-center justify-center p-8" onClick={() => setAgentExpanded(false)}>
              <div className="relative w-full max-w-2xl h-[600px] overflow-hidden rounded-lg shadow-2xl border" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }} onClick={(e) => e.stopPropagation()}>
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
                      <button className="w-8 h-8 flex items-center justify-center rounded-lg" onClick={() => setAgentExpanded(false)}>
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
                      <input type="text" placeholder="Ask me about the markets..." value={messageInput} onChange={(e) => setMessageInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} className="flex-1 px-3 py-2 rounded-lg border outline-none" style={{ background: 'var(--slate-4)', borderColor: 'var(--slate-7)', color: 'var(--slate-12)' }} />
                      <Button onClick={handleSendMessage} style={{ background: 'var(--red-9)', color: 'white', cursor: 'pointer' }}>Send</Button>
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
              onClick={() => setSettingsOpen(false)}
            />
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
                  <div className="p-4 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                    <Flex justify="between" align="center">
                      <Text size="5" weight="bold" style={{ color: 'var(--slate-12)' }}>
                        Settings
                      </Text>
                      <button
                        className="w-8 h-8 flex items-center justify-center rounded-lg"
                        onClick={() => setSettingsOpen(false)}
                      >
                        <Text size="4">✕</Text>
                      </button>
                    </Flex>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
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
                          <input type="range" min="0" max="100" defaultValue="70" className="w-full" style={{ accentColor: 'var(--red-9)' }} />
                          <Flex justify="between" className="mt-2">
                            <Text size="1" style={{ color: 'var(--slate-11)' }}>Low</Text>
                            <Text size="1" style={{ color: 'var(--slate-11)' }}>High</Text>
                          </Flex>
                        </div>
                      </div>
                    </div>
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
                            style={{ background: 'var(--slate-4)', borderColor: 'var(--slate-7)', color: 'var(--slate-12)' }}
                          />
                        </div>
                      </div>
                    </div>
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
                  <div className="p-4 border-t" style={{ borderColor: 'var(--slate-6)' }}>
                    <Flex justify="end" gap="3">
                      <Button onClick={() => setSettingsOpen(false)} style={{ background: 'var(--slate-4)', color: 'var(--slate-12)' }}>
                        Cancel
                      </Button>
                      <Button onClick={() => setSettingsOpen(false)} style={{ background: 'var(--blue-9)', color: 'white' }}>
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
