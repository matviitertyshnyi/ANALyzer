"use client";

import React, { useState, useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";

interface FloatingTIWindowProps {
  technicalIndicators: string[];
  data: { time: UTCTimestamp; value: number }[];
  mainChartRef: React.RefObject<IChartApi>;
}

export default function FloatingTIWindow({ technicalIndicators, data, mainChartRef }: FloatingTIWindowProps) {
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setDragging(true);
    setOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (dragging) {
      setPosition({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, offset]);

  useEffect(() => {
    if (chartContainerRef.current) {
      const newChart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 200,
        layout: {
          backgroundColor: "#151522",
          textColor: "#e2e8f0",
        },
        grid: {
          vertLines: { color: "#2d3748" },
          horzLines: { color: "#2d3748" },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
      });
      const newSeries = newChart.addLineSeries({
        color: "#1976D2",
        lineWidth: 2,
      });
      newSeries.setData(data);
      chartRef.current = newChart;
      seriesRef.current = newSeries;

      if (mainChartRef.current) {
        const mainTimeScale = mainChartRef.current.timeScale();
        const tiTimeScale = newChart.timeScale();

        mainTimeScale.subscribeVisibleTimeRangeChange(() => {
          const mainVisibleRange = mainTimeScale.getVisibleLogicalRange();
          if (mainVisibleRange) {
            tiTimeScale.setVisibleLogicalRange(mainVisibleRange);
          }
        });
      }

      return () => newChart.remove();
    }
  }, [data, mainChartRef]);

  return (
    <div
      className="absolute bg-gray-800 p-4 rounded shadow-lg border border-gray-600 text-white"
      style={{
        left: position.x,
        top: position.y,
        cursor: dragging ? "grabbing" : "grab",
        zIndex: 1000,
      }}
    >
      <div onMouseDown={handleMouseDown} className="font-bold mb-2 select-none">
        Technical Indicators
      </div>
      <div ref={chartContainerRef} style={{ width: 300, height: 200 }} />
    </div>
  );
}
