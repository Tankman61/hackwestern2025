"use client";

import { useState } from "react";
import { ChevronRightIcon, ChevronDownIcon } from "@radix-ui/react-icons";
import { Text } from "@radix-ui/themes";

type PortfolioView = "crypto" | "stocks" | "options" | "etfs";
type HoldingsView = "crypto-holdings" | "stocks-holdings" | "options-holdings" | "etfs-holdings";

interface SideMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onPortfolioSelect: (portfolio: PortfolioView) => void;
  onHoldingsSelect: (holdings: HoldingsView) => void;
  onHomeSelect?: () => void;
}

export default function SideMenu({ isOpen, onToggle, onPortfolioSelect, onHoldingsSelect, onHomeSelect }: SideMenuProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const menuItems = [
    { id: "crypto", label: "Crypto" },
    { id: "stocks", label: "Stocks" },
    { id: "options", label: "Options" },
    { id: "etfs", label: "ETFs" },
  ];

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <>
      {/* Menu Toggle Button - Always Visible */}
      <button
        onClick={onToggle}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-50 w-10 h-20 flex items-center justify-center transition-all"
        style={{
          background: 'var(--slate-3)',
          border: 'none',
          borderRadius: '8px',
          borderTopLeftRadius: '0',
          borderBottomLeftRadius: '0',
          color: 'var(--slate-11)',
          left: isOpen ? '280px' : '0',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--slate-4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--slate-3)';
        }}
      >
        <ChevronRightIcon
          width="20"
          height="20"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        />
      </button>

      {/* Side Menu */}
      <div
        className="fixed left-0 top-16 bottom-0 z-40 transition-all duration-200 overflow-y-auto"
        style={{
          width: isOpen ? '280px' : '0',
          background: 'var(--slate-2)',
          borderRight: isOpen ? '1px solid var(--slate-6)' : 'none',
        }}
      >
        <div className="p-4 space-y-1">
          {/* Home Button */}
          {onHomeSelect && (
            <button
              onClick={() => {
                onHomeSelect();
                setExpandedSections(new Set());
              }}
              className="w-full flex items-center justify-between px-4 py-3 rounded transition-colors mb-2"
              style={{
                background: 'transparent',
                color: 'var(--slate-12)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--slate-3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Text size="3" weight="medium">
                Home
              </Text>
            </button>
          )}
          
          {menuItems.map((item) => (
            <div key={item.id}>
              {/* Menu Item Button */}
              <button
                onClick={() => toggleSection(item.id)}
                className="w-full flex items-center justify-between px-4 py-3 rounded transition-colors"
                style={{
                  background: expandedSections.has(item.id) ? 'var(--slate-4)' : 'transparent',
                  color: 'var(--slate-12)',
                }}
                onMouseEnter={(e) => {
                  if (!expandedSections.has(item.id)) {
                    e.currentTarget.style.background = 'var(--slate-3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!expandedSections.has(item.id)) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <Text size="3" weight="medium">
                  {item.label}
                </Text>
                {expandedSections.has(item.id) ? (
                  <ChevronDownIcon width="18" height="18" />
                ) : (
                  <ChevronRightIcon width="18" height="18" />
                )}
              </button>

              {/* Dropdown Content */}
              {expandedSections.has(item.id) && (
                <div
                  className="ml-4 mt-1 mb-2 pl-4 border-l space-y-1"
                  style={{ borderColor: 'var(--slate-6)' }}
                >
                  <button
                    className="px-4 py-2 rounded transition-colors w-full text-left"
                    style={{ color: 'var(--slate-11)' }}
                    onClick={() => onPortfolioSelect(item.id as PortfolioView)}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--slate-4)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <Text size="2">Portfolio</Text>
                  </button>
                  <button
                    className="px-4 py-2 rounded transition-colors w-full text-left"
                    style={{ color: 'var(--slate-11)' }}
                    onClick={() => onHoldingsSelect(`${item.id}-holdings` as HoldingsView)}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--slate-4)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <Text size="2">Individual Holdings</Text>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
