"use client";

import { ExclamationTriangleIcon, BarChartIcon, DashboardIcon, ActivityLogIcon } from "@radix-ui/react-icons";

interface IconSidebarProps {
  activeTradingTab: "risk" | "trade" | "portfolio" | "history";
  riskLevel: "low" | "medium" | "high";
  tradingPanelOpen: boolean;
  onTabChange: (tab: "risk" | "trade" | "portfolio" | "history") => void;
}

export default function IconSidebar({ activeTradingTab, riskLevel, tradingPanelOpen, onTabChange }: IconSidebarProps) {
  return (
    <div className="flex flex-col border-l" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
      <div className="flex flex-col items-center py-4 gap-4 px-2">
        {/* Risk Icon */}
        <button
          onClick={() => onTabChange("risk")}
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
          {riskLevel === "high" && (
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border"
                 style={{ background: 'var(--red-9)', borderColor: 'var(--slate-2)' }}></div>
          )}
        </button>

        {/* Trade Icon */}
        <button
          onClick={() => onTabChange("trade")}
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
          onClick={() => onTabChange("portfolio")}
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
          onClick={() => onTabChange("history")}
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
  );
}
