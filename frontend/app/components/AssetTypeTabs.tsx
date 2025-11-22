"use client";

import { Tabs } from "@radix-ui/themes";

interface AssetTypeTabsProps {
  activeTab: "crypto" | "stocks" | "options" | "etfs";
  onTabChange: (tab: "crypto" | "stocks" | "options" | "etfs") => void;
}

export default function AssetTypeTabs({ activeTab, onTabChange }: AssetTypeTabsProps) {
  return (
    <Tabs.Root value={activeTab} onValueChange={(value) => onTabChange(value as "crypto" | "stocks" | "options" | "etfs")}>
      <Tabs.List>
        <Tabs.Trigger value="crypto">Crypto</Tabs.Trigger>
        <Tabs.Trigger value="stocks">Stocks</Tabs.Trigger>
        <Tabs.Trigger value="options">Options</Tabs.Trigger>
        <Tabs.Trigger value="etfs">ETFs</Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>
  );
}
