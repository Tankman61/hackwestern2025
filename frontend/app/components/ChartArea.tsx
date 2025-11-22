"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi } from "lightweight-charts";
import { Text } from "@radix-ui/themes";

export default function ChartArea() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const [chartType, setChartType] = useState("candlestick");

  // Sample data for different chart types
  const candlestickData = [
    { time: "2018-12-22", open: 75.16, high: 82.84, low: 36.16, close: 45.72 },
    { time: "2018-12-23", open: 45.12, high: 53.9, low: 45.12, close: 48.09 },
    { time: "2018-12-24", open: 60.71, high: 60.71, low: 53.39, close: 59.29 },
    { time: "2018-12-25", open: 68.26, high: 68.26, low: 59.04, close: 60.5 },
    { time: "2018-12-26", open: 67.71, high: 105.85, low: 66.67, close: 91.04 },
    { time: "2018-12-27", open: 91.04, high: 121.4, low: 82.7, close: 111.4 },
    { time: "2018-12-28", open: 111.51, high: 142.83, low: 103.34, close: 131.25 },
    { time: "2018-12-29", open: 131.33, high: 151.17, low: 77.68, close: 96.43 },
    { time: "2018-12-30", open: 106.33, high: 110.2, low: 90.39, close: 98.1 },
    { time: "2018-12-31", open: 109.87, high: 114.69, low: 85.66, close: 111.26 },
  ];

  const simpleData = [
    { time: "2018-12-22", value: 45.72 },
    { time: "2018-12-23", value: 48.09 },
    { time: "2018-12-24", value: 59.29 },
    { time: "2018-12-25", value: 60.5 },
    { time: "2018-12-26", value: 91.04 },
    { time: "2018-12-27", value: 111.4 },
    { time: "2018-12-28", value: 131.25 },
    { time: "2018-12-29", value: 96.43 },
    { time: "2018-12-30", value: 98.1 },
    { time: "2018-12-31", value: 111.26 },
  ];

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart with dark theme - using explicit colors that lightweight-charts can parse
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 500,
      layout: {
        background: { color: '#111113' },
        textColor: '#B0B4BA',
      },
      grid: {
        vertLines: { color: '#2B2D31' },
        horzLines: { color: '#2B2D31' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#2B2D31',
      },
      timeScale: {
        borderColor: '#2B2D31',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight || 500,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  // Update chart when type changes
  useEffect(() => {
    if (!chartRef.current) return;

    // Remove existing series
    if (seriesRef.current) {
      chartRef.current.removeSeries(seriesRef.current);
    }

    let newSeries;

    switch (chartType) {
      case "candlestick":
        newSeries = chartRef.current.addCandlestickSeries({
          upColor: "#26a69a",
          downColor: "#ef5350",
          borderVisible: false,
          wickUpColor: "#26a69a",
          wickDownColor: "#ef5350",
        });
        newSeries.setData(candlestickData);
        break;

      case "bar":
        newSeries = chartRef.current.addBarSeries({
          upColor: "#26a69a",
          downColor: "#ef5350",
        });
        newSeries.setData(candlestickData);
        break;

      case "area":
        newSeries = chartRef.current.addAreaSeries({
          lineColor: "#2962FF",
          topColor: "rgba(41, 98, 255, 0.4)",
          bottomColor: "rgba(41, 98, 255, 0.0)",
        });
        newSeries.setData(simpleData);
        break;

      case "line":
        newSeries = chartRef.current.addLineSeries({
          color: "#2962FF",
          lineWidth: 2,
        });
        newSeries.setData(simpleData);
        break;

      case "baseline":
        newSeries = chartRef.current.addBaselineSeries({
          baseValue: { type: "price", price: 80 },
          topLineColor: "rgba(38, 166, 154, 1)",
          topFillColor1: "rgba(38, 166, 154, 0.28)",
          topFillColor2: "rgba(38, 166, 154, 0.05)",
          bottomLineColor: "rgba(239, 83, 80, 1)",
          bottomFillColor1: "rgba(239, 83, 80, 0.05)",
          bottomFillColor2: "rgba(239, 83, 80, 0.28)",
        });
        newSeries.setData(simpleData);
        break;

      case "histogram":
        newSeries = chartRef.current.addHistogramSeries({
          color: "#26a69a",
          priceFormat: {
            type: "volume",
          },
        });
        newSeries.setData(simpleData);
        break;

      default:
        newSeries = chartRef.current.addCandlestickSeries();
        newSeries.setData(candlestickData);
    }

    seriesRef.current = newSeries;
    chartRef.current.timeScale().fitContent();
  }, [chartType, candlestickData, simpleData]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center" style={{ background: 'var(--slate-1)' }}>
      <div className="w-full max-w-6xl mx-auto flex flex-col" style={{ height: '80vh' }}>
        {/* Chart Type Selector */}
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--slate-6)', background: 'var(--slate-2)' }}>
          <div className="flex flex-wrap gap-2 justify-center">
            {["candlestick", "bar", "area", "line", "baseline", "histogram"].map((type) => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
                style={{
                  background: chartType === type ? 'var(--slate-4)' : 'var(--slate-3)',
                  color: chartType === type ? 'var(--slate-12)' : 'var(--slate-11)',
                  border: `1px solid ${chartType === type ? 'var(--slate-7)' : 'var(--slate-6)'}`,
                }}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Container */}
        <div className="flex-1 p-4" style={{ background: 'var(--slate-2)', border: '1px solid var(--slate-6)', borderTop: 'none' }}>
          <div ref={chartContainerRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
}
