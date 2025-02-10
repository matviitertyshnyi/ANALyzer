"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import TechnicalIndicatorChart from "./TechnicalIndicatorChart";

interface Kline {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface BinanceChartProps {
  selectedCoin: string;
  interval?: string; // e.g. "1m", "5m", "15m", "1h", "4h", "1d", etc.
  technicalIndicators?: string[];
  onRemoveIndicator: (indicator: string) => void;
}

export default function BinanceChart({ selectedCoin, interval = "1d", technicalIndicators, onRemoveIndicator }: BinanceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [data, setData] = useState<Kline[]>([]);
  const [fetchError, setFetchError] = useState<string>("");
  const [tiData, setTiData] = useState<{ [key: string]: { time: UTCTimestamp; value: number }[] }>({});

  interface BinanceKlineResponse {
    time: number;
    open: string;
    high: string;
    low: string;
    close: string;
  }

  const intervalMapping: Record<string, string> = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1h": "1h",
    "4h": "4h",
    "1d": "1d",
    "1w": "1w",
  };

  const candleLimit = 1000;

  const fetchKlines = useCallback(
    async (endTime?: number) => {
      try {
        if (interval === "ti") {
          return []; // Prevent fetching data when timeframe is "ti"
        }
        const binanceInterval = intervalMapping[interval] || interval;
        let url = `https://api.binance.com/api/v3/klines?symbol=${selectedCoin}&interval=${binanceInterval}&limit=${candleLimit}`;
        if (endTime) url += `&endTime=${endTime}`;
        const response = await fetch(url);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.msg || "Error fetching data");
        }
        const rawData = await response.json();
        const klines: Kline[] = rawData.map((k: any) => ({
          time: Math.floor(k[0] / 1000) as UTCTimestamp,
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
        }));
        return klines;
      } catch (err: any) {
        console.error("Error fetching kline data:", err);
        setFetchError(err.message || "Unknown error");
        return [];
      }
    },
    [selectedCoin, interval, intervalMapping]
  );

  const fitChartContent = () => {
    if (chartRef.current && candlestickSeriesRef.current && data.length > 0) {
      // Save the current viewport state
      const timeScale = chartRef.current.timeScale();
      const visibleRange = timeScale.getVisibleLogicalRange();
      
      // Update data
      candlestickSeriesRef.current.setData(data);
      
      // If we had a previous range, try to restore it, otherwise fit content
      if (visibleRange !== null) {
        timeScale.setVisibleLogicalRange(visibleRange);
      } else {
        timeScale.fitContent();
      }
    }
  };

  const initializeChart = () => {
    if (!chartContainerRef.current) return null;
    
    try {
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 800,
        layout: {
          background: { color: '#151522' },
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
        },
        handleScroll: true,
        handleScale: true,
      });

      return chart;
    } catch (error) {
      console.error("Failed to initialize chart:", error);
      return null;
    }
  };

  // Initialize the chart
  useEffect(() => {
    const initChart = () => {
      if (!chartContainerRef.current) return;
      
      // Create new chart instance
      if (!chartRef.current) {
        const chart = initializeChart();
        if (!chart) return;
        
        chartRef.current = chart;
        
        const series = chart.addCandlestickSeries({
          upColor: '#4ade80',
          downColor: '#f87171',
          borderUpColor: '#4ade80',
          borderDownColor: '#f87171',
          wickUpColor: '#4ade80',
          wickDownColor: '#f87171',
        });
        
        candlestickSeriesRef.current = series;
      }

      // Update dimensions
      const containerWidth = chartContainerRef.current.clientWidth;
      const indicatorCount = technicalIndicators?.length || 0;
      const newHeight = Math.max(400, 800 - (indicatorCount * 150));

      chartRef.current.applyOptions({
        width: containerWidth,
        height: newHeight,
      });

      // Update data if available
      if (data.length > 0 && candlestickSeriesRef.current) {
        candlestickSeriesRef.current.setData(data);
        chartRef.current.timeScale().fitContent();
      }
    };

    initChart();

    // Add resize observer
    const observer = new ResizeObserver(() => {
      if (chartContainerRef.current?.clientWidth > 0) {
        initChart();
      }
    });

    if (chartContainerRef.current) {
      observer.observe(chartContainerRef.current);
    }

    return () => observer.disconnect();
  }, [technicalIndicators?.length, data]);

  // Fetch and update data
  useEffect(() => {
    (async () => {
      if (interval === "ti") return; // Skip fetching if interval is "ti"
      
      const klines = await fetchKlines();
      if (klines.length) {
        setData(klines);
        fitChartContent();
      }
    })();
  }, [selectedCoin, interval, fetchKlines]);

  useEffect(() => {
    if (data.length > 0) {
      fitChartContent();
    }
  }, [data, fitChartContent]);

  // Update technical indicators when technicalIndicators changes
  useEffect(() => {
    if (data.length === 0) return;

    const newTiData: { [key: string]: { time: UTCTimestamp; value: number }[] } = {};

    // Calculate indicators
    technicalIndicators?.forEach(indicator => {
      switch (indicator) {
        case "sma": {
          const smaPeriod = 14;
          const smaData = data
            .map((candle, index) => {
              if (index < smaPeriod - 1) return null;
              const sum = data
                .slice(index - smaPeriod + 1, index + 1)
                .reduce((acc, cur) => acc + cur.close, 0);
              return { time: candle.time, value: sum / smaPeriod };
            })
            .filter((x): x is { time: UTCTimestamp; value: number } => x !== null);
          newTiData["sma"] = smaData;
          break;
        }
        case "ema": {
          const emaPeriod = 14;
          const multiplier = 2 / (emaPeriod + 1);
          const emaData = data.reduce<{ time: UTCTimestamp; value: number }[]>((acc, candle, i) => {
            if (i === 0) {
              acc.push({ time: candle.time, value: candle.close });
            } else {
              const prevEma = acc[i - 1].value;
              acc.push({
                time: candle.time,
                value: (candle.close - prevEma) * multiplier + prevEma
              });
            }
            return acc;
          }, []);
          newTiData["ema"] = emaData;
          break;
        }
        case "bb": {
          const bbPeriod = 20;
          const bbData = data.slice(bbPeriod - 1).map((candle, i) => {
            const slice = data.slice(i, i + bbPeriod);
            const sum = slice.reduce((s, c) => s + c.close, 0);
            const basis = sum / bbPeriod;
            
            return {
              time: candle.time,
              value: basis
            };
          });
          newTiData["bb"] = bbData;
        }
      }
    });

    setTiData(newTiData);
  }, [technicalIndicators, data]);

  useEffect(() => {
    const binanceInterval = intervalMapping[interval] || interval;
    const symbolLower = selectedCoin.toLowerCase();
    const wsUrl = `wss://stream.binance.com:9443/ws/${symbolLower}@kline_${binanceInterval}`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const k = message.k;
        const kline: Kline = {
          time: Math.floor(k.t / 1000) as UTCTimestamp,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
        };
        setData((prevData) => {
          if (prevData.length === 0) return prevData;
          if (k.x) {
            const newData = [...prevData, kline];
            candlestickSeriesRef.current?.update(kline);
            return newData;
          } else {
            const newData = [...prevData.slice(0, -1), kline];
            candlestickSeriesRef.current?.update(kline);
            return newData;
          }
        });
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    };
    ws.onerror = (error) => console.error("Kline WebSocket error:", error);
    return () => ws.close();
  }, [selectedCoin, interval]);

  return (
    <div className="flex flex-col h-full">
      {/* Main chart container */}
      <div className="flex-1 min-h-0 bg-[#151522]">
        <div ref={chartContainerRef} className="w-full h-full" />
        {fetchError && (
          <div className="absolute top-4 left-4 text-red-400">
            Error: {fetchError}
          </div>
        )}
      </div>
      
      {/* Indicators stack */}
      <div className="space-y-1 mt-1">
        {technicalIndicators?.map((indicator) => (
          <div key={indicator} className={`transition-all duration-200`}>
            <TechnicalIndicatorChart
              indicator={indicator}
              data={tiData[indicator] || []}
              mainChartRef={chartRef}
              onClose={() => onRemoveIndicator(indicator)}
              parentWidth={chartContainerRef.current?.clientWidth}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
