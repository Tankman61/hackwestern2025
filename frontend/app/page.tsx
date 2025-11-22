"use client";

import { useState, useEffect } from "react";
import SideMenu from "./components/SideMenu";
import TopBar from "./components/TopBar";
import ChartArea from "./components/ChartArea";
import AgentProfileCard from "./components/AgentProfileCard";
import PolymarketPanel from "./components/PolymarketPanel";
import SocialSentimentPanel from "./components/SocialSentimentPanel";
import TradingPanel from "./components/TradingPanel";
import IconSidebar from "./components/IconSidebar";
import AgentChatModal from "./components/AgentChatModal";

export default function Home() {
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [agentExpanded, setAgentExpanded] = useState(false);
  const [sentimentExpanded, setSentimentExpanded] = useState(false);
  const [tradingPanelOpen, setTradingPanelOpen] = useState(true);
  const [activeTradingTab, setActiveTradingTab] = useState<"risk" | "trade" | "portfolio" | "history">("trade");
  const [riskLevel] = useState<"low" | "medium" | "high">("high");
  const [currentPrice] = useState("98,742.31");
  const [currentTime, setCurrentTime] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [positionSize, setPositionSize] = useState("0.5");
  const [tradeType, setTradeType] = useState<"long" | "short">("long");
  const [stopLoss, setStopLoss] = useState("97,200");
  const [takeProfit, setTakeProfit] = useState("100,500");
  const [messages, setMessages] = useState<Array<{ role: "agent" | "user"; text: string; time: string }>>([
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
      <TopBar currentPrice={currentPrice} currentTime={currentTime} />

      {/* Side Menu */}
      <SideMenu isOpen={sideMenuOpen} onToggle={() => setSideMenuOpen(!sideMenuOpen)} />

      <div 
        className="grid h-[calc(100vh-3rem)] gap-0 transition-all duration-200" 
        style={{
          gridTemplateColumns: tradingPanelOpen ? '1fr 280px 40px' : '1fr 40px',
          marginLeft: sideMenuOpen ? '280px' : '0',
        }}
      >
        {/* LEFT COLUMN: Chart + Data Feeds */}
        <div className="flex flex-col">
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
