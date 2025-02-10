"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createChart, IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";

interface TechnicalIndicatorChartProps {
  indicator: string;
  data: { time: UTCTimestamp; value: number }[];
  mainChartRef: React.RefObject<IChartApi>;
  onClose: () => void;
  parentWidth?: number;
}

export default function TechnicalIndicatorChart({ indicator, data, mainChartRef, onClose, parentWidth }: TechnicalIndicatorChartProps) {
  const [minimized, setMinimized] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  // Add function to handle chart resize
  const handleResize = useCallback(() => {
    if (chartRef.current && chartContainerRef.current) {
      chartRef.current.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: minimized ? 0 : 150,
      });
      chartRef.current.timeScale().fitContent();
    }
  }, [minimized]);

  // Update chart when minimized state changes
  useEffect(() => {
    handleResize();
  }, [minimized, handleResize]);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;
    
    // Only create new chart if it doesn't exist
    if (!chartRef.current) {
      const chart = createChart(chartContainerRef.current, {
        width: parentWidth || chartContainerRef.current.clientWidth,
        height: minimized ? 0 : 150,
        layout: {
          background: { type: 'solid', color: '#151522' },
          textColor: '#e2e8f0',
        },
        grid: {
          vertLines: { color: '#2d3748' },
          horzLines: { color: '#2d3748' },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: '#2d3748',
        },
        rightPriceScale: {
          borderColor: '#2d3748',
          autoScale: true,
          entireTextOnly: true,
          minValue: 0,
        },
      });

      chartRef.current = chart;
      
      const series = chart.addLineSeries({
        color: indicator === 'sma' ? '#2962FF' : 
               indicator === 'ema' ? '#FF9800' : '#7B1FA2',
        lineWidth: 2,
      });
      
      seriesRef.current = series;
    }

    // Update data
    if (seriesRef.current) {
      seriesRef.current.setData(data);
      chartRef.current?.timeScale().fitContent();
    }

    // Sync with main chart
    if (mainChartRef.current && chartRef.current) {
      const mainTimeScale = mainChartRef.current.timeScale();
      const tiTimeScale = chartRef.current.timeScale();

      const syncTimeRange = () => {
        const mainVisibleRange = mainTimeScale.getVisibleLogicalRange();
        if (mainVisibleRange) {
          tiTimeScale.setVisibleLogicalRange(mainVisibleRange);
        }
      };

      mainTimeScale.subscribeVisibleTimeRangeChange(syncTimeRange);
      return () => {
        mainTimeScale.unsubscribeVisibleTimeRangeChange(syncTimeRange);
      };
    }
  }, [data, mainChartRef, indicator, parentWidth, minimized]);

  // Add cleanup effect
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  return (
    <div className="bg-gray-800 rounded border border-gray-600 transition-all duration-200">
      {/* Header */}
      <div className="h-8 flex items-center justify-between px-3 bg-gray-700 rounded-t">
        <span className="font-semibold text-sm">{indicator.toUpperCase()}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setMinimized(!minimized)}
            className="px-2 rounded bg-gray-600 hover:bg-gray-500 text-xs"
          >
            {minimized ? "+" : "-"}
          </button>
          <button
            onClick={onClose}
            className="px-2 rounded bg-red-600 hover:bg-red-500 text-xs"
          >
            ×
          </button>
        </div>
      </div>

      {/* Chart container with smooth height transition */}
      <div 
        className={`transition-all duration-200 ease-in-out overflow-hidden`}
        style={{ height: minimized ? '0' : '150px' }}
      >
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
