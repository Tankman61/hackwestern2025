"use client";

import { useState, useEffect } from "react";
import TopBar from "./components/TopBar";
import ChartArea from "./components/ChartArea";
import AgentProfileCard from "./components/AgentProfileCard";
import PolymarketPanel from "./components/PolymarketPanel";
import SocialSentimentPanel from "./components/SocialSentimentPanel";
import TradingPanel from "./components/TradingPanel";
import IconSidebar from "./components/IconSidebar";
import AgentChatModal from "./components/AgentChatModal";

export default function Home() {
  const [agentExpanded, setAgentExpanded] = useState(false);
  const [sentimentExpanded, setSentimentExpanded] = useState(false);
  const [tradingPanelOpen, setTradingPanelOpen] = useState(true); // Always open by default
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

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const polymarkets = [
    { question: "Bitcoin > $100k by Dec 31", probability: 68, change: "+12%", volume: "2.4M" },
    { question: "BTC to hit $120k in 2025", probability: 42, change: "+8%", volume: "1.8M" },
    { question: "Bitcoin ETF approval", probability: 89, change: "-2%", volume: "5.1M" },
    { question: "BTC above $90k EOY", probability: 76, change: "+5%", volume: "3.2M" },
  ];

  const redditPosts = [
    { time: "2m ago", author: "u/cryptowhale", snippet: "BTC breaking out. This is not a drill. Load up now before...", sentiment: "bullish" },
    { time: "5m ago", author: "u/tradingpro", snippet: "Volume looking weak. Expecting pullback to 95k support...", sentiment: "bearish" },
    { time: "12m ago", author: "u/moonboy", snippet: "100k by Christmas. Diamond hands only. HODL the line!", sentiment: "bullish" },
  ];

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
      <TopBar currentPrice={currentPrice} currentTime={currentTime} />

      <div className="grid h-[calc(100vh-3rem)] gap-0" style={{
        gridTemplateColumns: tradingPanelOpen ? '1fr 280px 40px' : '1fr 40px'
      }}>
        {/* LEFT COLUMN: Chart + Data Feeds */}
        <div className="flex flex-col">
          {/* Main Chart Area */}
          <ChartArea />

          {/* Bottom Data Panels */}
          <div className="h-64 border-t border-r grid grid-cols-[200px_1fr_1fr] gap-0" style={{ borderColor: 'var(--slate-6)' }}>
            <AgentProfileCard onClick={() => setAgentExpanded(!agentExpanded)} />
            <PolymarketPanel markets={polymarkets} />
            <SocialSentimentPanel 
              posts={redditPosts} 
              expanded={sentimentExpanded} 
              onClick={() => setSentimentExpanded(!sentimentExpanded)} 
            />
          </div>
        </div>

        {/* TRADING PANEL */}
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
          />
        )}

        {/* ICON SIDEBAR */}
        <IconSidebar
          activeTradingTab={activeTradingTab}
          riskLevel={riskLevel}
          tradingPanelOpen={tradingPanelOpen}
          onTabChange={(tab) => {
            setActiveTradingTab(tab);
            setTradingPanelOpen(true);
          }}
        />
      </div>

      {/* AI Agent Chatbot Modal */}
      <AgentChatModal
        isOpen={agentExpanded}
        onClose={() => setAgentExpanded(false)}
        messages={messages}
        messageInput={messageInput}
        setMessageInput={setMessageInput}
        onSendMessage={handleSendMessage}
      />
    </main>
  );
}

      <div className="grid h-[calc(100vh-3rem)] gap-0" style={{
        gridTemplateColumns: tradingPanelOpen ? '1fr 280px 40px' : '1fr 40px'
      }}>
        {/* LEFT COLUMN: Chart + Data Feeds */}
        <div className="flex flex-col">
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
          <div className="h-64 border-t border-r grid grid-cols-[200px_1fr_1fr] gap-0" style={{ borderColor: 'var(--slate-6)' }}>
            {/* VTuber Profile Card - SQUARE */}
            <div
              className="border-r p-4 cursor-pointer"
              style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}
              onClick={() => setAgentExpanded(!agentExpanded)}
            >
              <div className="relative w-full h-full flex items-center justify-center">
                <div className="w-full aspect-square rounded-lg flex items-center justify-center text-6xl border-2 shadow-lg relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--red-9), var(--red-10))', borderColor: 'var(--red-7)' }}>
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, transparent, rgba(139, 92, 246, 0.2))' }}></div>
                  <span className="relative z-10">🎯</span>
                  <div className="absolute bottom-3 right-3 w-4 h-4 rounded-full border-2" style={{ background: 'var(--green-9)', borderColor: 'var(--slate-2)' }}></div>
                </div>
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
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {polymarkets.map((market, idx) => (
                  <div
                    key={idx}
                    className="p-2 border rounded transition-colors"
                    style={{ background: 'var(--slate-3)', borderColor: 'var(--slate-6)' }}
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
                  </div>
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
                <Text size="1" style={{ color: 'var(--slate-11)' }}>r/wallstreetbets</Text>
              </Flex>

              {!sentimentExpanded ? (
                <div className="flex-1 flex flex-col justify-center">
                  <Flex direction="column" gap="3">
                    <div>
                      <Text size="1" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Bullish/Bearish Ratio</Text>
                      <Flex align="baseline" gap="2">
                        <Text size="5" weight="bold" className="font-mono" style={{ color: 'var(--green-11)' }}>72</Text>
                        <Text size="2" style={{ color: 'var(--slate-11)' }}>/</Text>
                        <Text size="5" weight="bold" className="font-mono" style={{ color: 'var(--red-10)' }}>28</Text>
                      </Flex>
                    </div>
                    <div>
                      <Text size="1" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Sentiment Score</Text>
                      <Text size="4" weight="bold" className="font-mono" style={{ color: 'var(--green-11)' }}>+44</Text>
                    </div>
                    <Text size="1" style={{ color: 'var(--slate-11)' }}>
                      Click to view recent posts →
                    </Text>
                  </Flex>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {redditPosts.map((post, idx) => (
                    <div
                      key={idx}
                      className="p-2 border rounded"
                      style={{ background: 'var(--slate-3)', borderColor: 'var(--slate-6)' }}
                    >
                      <Flex justify="between" className="mb-1">
                        <Text size="1" weight="medium" style={{ color: 'var(--blue-11)' }}>{post.author}</Text>
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TRADING PANEL - Always shows icons on right, expands left */}
        {tradingPanelOpen && (
          <div className="flex flex-col border-r" style={{ background: 'var(--slate-3)', borderColor: 'var(--slate-6)' }}>
            {/* Tab Content Based on Active Tab */}
            {activeTradingTab === "risk" && (
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
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
              <>
              {/* Header */}
              <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>
                  Trading
                </Text>
              </div>

              {/* Trade Type */}
              <div className="p-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                  Type
                </Text>
                <Flex gap="2">
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
              <div className="p-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                <Flex justify="between" align="center" className="mb-2">
                  <Text size="1" className="uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                    Size
                  </Text>
                  <Text size="1" className="font-mono" style={{ color: 'var(--slate-9)' }} title="AI suggests 0.25 based on risk level">
                    AI: 0.25
                  </Text>
                </Flex>
                <input
                  type="text"
                  value={positionSize}
                  onChange={(e) => setPositionSize(e.target.value)}
                  className="w-full px-3 py-2 rounded border font-mono outline-none"
                  style={{
                    background: 'var(--slate-3)',
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
              <div className="p-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                  Entry
                </Text>
                <input
                  type="text"
                  value={currentPrice}
                  readOnly
                  className="w-full px-3 py-2 rounded border font-mono"
                  style={{
                    background: 'var(--slate-3)',
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
              <div className="p-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                <Flex justify="between" align="center" className="mb-2">
                  <Text size="1" className="uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                    Stop Loss
                  </Text>
                  <button
                    onClick={() => setStopLoss("97,200")}
                    className="text-xs px-2 py-0.5 rounded transition-colors"
                    style={{ background: 'var(--slate-4)', color: 'var(--slate-11)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--slate-5)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--slate-4)'}
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
                    background: 'var(--slate-3)',
                    borderColor: 'var(--slate-7)',
                    color: 'var(--slate-12)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--red-8)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--slate-7)'}
                />
              </div>

              {/* Take Profit */}
              <div className="p-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                <Flex justify="between" align="center" className="mb-2">
                  <Text size="1" className="uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                    Take Profit
                  </Text>
                  <button
                    onClick={() => setTakeProfit("100,500")}
                    className="text-xs px-2 py-0.5 rounded transition-colors"
                    style={{ background: 'var(--slate-4)', color: 'var(--slate-11)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--slate-5)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--slate-4)'}
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
                    background: 'var(--slate-3)',
                    borderColor: 'var(--slate-7)',
                    color: 'var(--slate-12)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--green-8)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--slate-7)'}
                />
              </div>

              {/* Execute Button */}
              <div className="p-3 mt-auto">
                <Button
                  size="3"
                  className="w-full font-bold cursor-pointer"
                  style={{
                    background: tradeType === "long" ? 'var(--green-9)' : 'var(--red-9)',
                    color: 'white'
                  }}
                >
                  {tradeType === "long" ? "Open Long Position" : "Open Short Position"}
                </Button>
                <Flex justify="center" align="center" gap="1" className="mt-2">
                  <div className="w-1 h-1 rounded-full" style={{ background: 'var(--red-9)' }}></div>
                  <Text size="1" style={{ color: 'var(--slate-11)' }}>
                    Risk: High (73/100)
                  </Text>
                </Flex>
              </div>
              </>
              )}

              {/* Portfolio Tab */}
              {activeTradingTab === "portfolio" && (
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                    <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>
                      Portfolio
                    </Text>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
                  {/* Portfolio Summary */}
                  <div className="mb-4 p-3 rounded border" style={{ background: 'var(--slate-3)', borderColor: 'var(--slate-6)' }}>
                    <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                      Total Portfolio Value
                    </Text>
                    <Text size="6" weight="bold" className="font-mono" style={{ color: 'var(--slate-12)' }}>
                      $142,847.23
                    </Text>
                    <Flex align="center" gap="1" className="mt-1">
                      <Text size="2" className="font-mono" style={{ color: 'var(--green-11)' }}>
                        +$8,492.15
                      </Text>
                      <Text size="1" style={{ color: 'var(--slate-11)' }}>
                        (6.32%)
                      </Text>
                    </Flex>
                  </div>

                  {/* Open Positions */}
                  <Text size="1" className="mb-2 uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
                    Open Positions
                  </Text>
                  <div className="space-y-2">
                    <div className="p-2.5 border rounded" style={{ background: 'var(--slate-3)', borderColor: 'var(--slate-6)' }}>
                      <Flex justify="between" align="center" className="mb-1">
                        <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>BTC/USD</Text>
                        <Badge size="1" style={{ background: 'var(--green-4)', color: 'var(--green-11)' }}>LONG</Badge>
                      </Flex>
                      <Flex justify="between" className="mb-0.5">
                        <Text size="1" style={{ color: 'var(--slate-11)' }}>Size</Text>
                        <Text size="1" className="font-mono" style={{ color: 'var(--slate-12)' }}>0.5 BTC</Text>
                      </Flex>
                      <Flex justify="between" className="mb-0.5">
                        <Text size="1" style={{ color: 'var(--slate-11)' }}>Entry</Text>
                        <Text size="1" className="font-mono" style={{ color: 'var(--slate-12)' }}>$96,250</Text>
                      </Flex>
                      <Flex justify="between">
                        <Text size="1" style={{ color: 'var(--slate-11)' }}>P&L</Text>
                        <Text size="1" weight="bold" className="font-mono" style={{ color: 'var(--green-11)' }}>+$1,246.15</Text>
                      </Flex>
                    </div>

                    <div className="p-2.5 border rounded" style={{ background: 'var(--slate-3)', borderColor: 'var(--slate-6)' }}>
                      <Flex justify="between" align="center" className="mb-1">
                        <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>ETH/USD</Text>
                        <Badge size="1" style={{ background: 'var(--red-4)', color: 'var(--red-10)' }}>SHORT</Badge>
                      </Flex>
                      <Flex justify="between" className="mb-0.5">
                        <Text size="1" style={{ color: 'var(--slate-11)' }}>Size</Text>
                        <Text size="1" className="font-mono" style={{ color: 'var(--slate-12)' }}>2.0 ETH</Text>
                      </Flex>
                      <Flex justify="between" className="mb-0.5">
                        <Text size="1" style={{ color: 'var(--slate-11)' }}>Entry</Text>
                        <Text size="1" className="font-mono" style={{ color: 'var(--slate-12)' }}>$3,842</Text>
                      </Flex>
                      <Flex justify="between">
                        <Text size="1" style={{ color: 'var(--slate-11)' }}>P&L</Text>
                        <Text size="1" weight="bold" className="font-mono" style={{ color: 'var(--red-10)' }}>-$184.50</Text>
                      </Flex>
                    </div>
                  </div>
                  </div>
                </div>
              )}

              {/* History Tab */}
              {activeTradingTab === "history" && (
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--slate-6)' }}>
                    <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>
                      Trade History
                    </Text>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
                  <div className="space-y-2">
                    <div className="p-2.5 border-l-2 rounded" style={{ background: 'var(--slate-3)', borderColor: 'var(--green-9)' }}>
                      <Flex justify="between" align="center" className="mb-1">
                        <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>BTC/USD LONG</Text>
                        <Text size="1" weight="bold" className="font-mono" style={{ color: 'var(--green-11)' }}>+$2,847</Text>
                      </Flex>
                      <Flex justify="between" className="mb-0.5">
                        <Text size="1" style={{ color: 'var(--slate-11)' }}>Entry: $94,200</Text>
                        <Text size="1" style={{ color: 'var(--slate-11)' }}>Exit: $98,900</Text>
                      </Flex>
                      <Text size="1" style={{ color: 'var(--slate-11)' }}>2 hours ago • 0.6 BTC</Text>
                    </div>

                    <div className="p-2.5 border-l-2 rounded" style={{ background: 'var(--slate-3)', borderColor: 'var(--red-9)' }}>
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

                    <div className="p-2.5 border-l-2 rounded" style={{ background: 'var(--slate-3)', borderColor: 'var(--green-9)' }}>
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

                    <div className="p-2.5 border-l-2 rounded" style={{ background: 'var(--slate-3)', borderColor: 'var(--green-9)' }}>
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
        <div className="flex flex-col border-l" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
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
                background: activeTradingTab === "trade" && tradingPanelOpen ? 'var(--slate-4)' : 'var(--slate-3)',
                color: 'var(--slate-11)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--slate-4)';
                e.currentTarget.style.color = 'var(--slate-12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = activeTradingTab === "trade" && tradingPanelOpen ? 'var(--slate-4)' : 'var(--slate-3)';
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
                background: activeTradingTab === "portfolio" && tradingPanelOpen ? 'var(--slate-4)' : 'var(--slate-3)',
                color: 'var(--slate-11)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--slate-4)';
                e.currentTarget.style.color = 'var(--slate-12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = activeTradingTab === "portfolio" && tradingPanelOpen ? 'var(--slate-4)' : 'var(--slate-3)';
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
                background: activeTradingTab === "history" && tradingPanelOpen ? 'var(--slate-4)' : 'var(--slate-3)',
                color: 'var(--slate-11)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--slate-4)';
                e.currentTarget.style.color = 'var(--slate-12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = activeTradingTab === "history" && tradingPanelOpen ? 'var(--slate-4)' : 'var(--slate-3)';
                e.currentTarget.style.color = 'var(--slate-11)';
              }}
              title="History"
            >
              <ActivityLogIcon width="18" height="18" />
            </button>
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
                          background: 'var(--slate-3)',
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
    </main>
  );
}
