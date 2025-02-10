"use client";

interface TimeframeSelectorProps {
  selectedTimeframe: string;
  onTimeframeChange: (timeframe: string) => void;
}

export default function TimeframeSelector({
  selectedTimeframe,
  onTimeframeChange,
}: TimeframeSelectorProps) {
  const timeframes = [
    "1m",
    "5m",
    "15m",
    "1h",
    "4h",
    "1d",
    "1w",
    "1M",
    "3M",
    "1y",
    "all",
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {timeframes.map((tf) => (
        <button
          key={tf}
          onClick={() => onTimeframeChange(tf)}
          className={`px-2 py-1 rounded border border-gray-600 bg-transparent ${
            selectedTimeframe === tf ? "text-white" : "text-gray-400"
          } hover:text-white hover:border-white`}
        >
          {tf}
        </button>
      ))}
      <button
        onClick={() => onTimeframeChange("ti")}
        className="px-2 py-1 rounded border border-gray-600 bg-transparent text-gray-400 hover:text-white hover:border-white"
      >
        TI
      </button>
    </div>
  );
}