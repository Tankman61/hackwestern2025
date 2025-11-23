"use client";

import RiskMonitorTab from "./tabs/RiskMonitorTab";
import TradingTab from "./tabs/TradingTab";
import PortfolioTab from "./tabs/PortfolioTab";
import HistoryTab from "./tabs/HistoryTab";

interface TradingPanelProps {
  activeTradingTab: "risk" | "trade" | "portfolio" | "history";
  tradeType: "long" | "short";
  setTradeType: (type: "long" | "short") => void;
  positionSize: string;
  setPositionSize: (value: string) => void;
  currentPrice: string;
  stopLoss: string;
  setStopLoss: (value: string) => void;
  takeProfit: string;
  setTakeProfit: (value: string) => void;
  riskLevel: "low" | "medium" | "high";
  riskScore: number;
}

export default function TradingPanel({
  activeTradingTab,
  tradeType,
  setTradeType,
  positionSize,
  setPositionSize,
  currentPrice,
  stopLoss,
  setStopLoss,
  takeProfit,
  setTakeProfit,
  riskLevel,
  riskScore
}: TradingPanelProps) {
  return (
    <div className="flex flex-col border-r overflow-hidden" style={{
      background: 'var(--slate-3)',
      borderColor: 'var(--slate-6)',
      height: '100%',
      minHeight: 0,
      position: 'relative',
      zIndex: 10,
      width: '17.5rem'
    }}>
      {activeTradingTab === "risk" && <RiskMonitorTab />}
      {activeTradingTab === "trade" && (
        <TradingTab
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
      {activeTradingTab === "portfolio" && <PortfolioTab />}
      {activeTradingTab === "history" && <HistoryTab />}
    </div>
  );
}
