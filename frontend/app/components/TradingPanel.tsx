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
  setTakeProfit
}: TradingPanelProps) {
  return (
    <div className="flex flex-col border-r" style={{ background: 'var(--slate-3)', borderColor: 'var(--slate-6)' }}>
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
        />
      )}
      {activeTradingTab === "portfolio" && <PortfolioTab />}
      {activeTradingTab === "history" && <HistoryTab />}
    </div>
  );
}
