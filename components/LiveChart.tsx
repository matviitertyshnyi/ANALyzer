// anal_front/components/LiveChart.tsx
"use client";

import { useState } from "react";
import BinanceChart from "./BinanceChart";
import TimeframeSelector from "./TimeframeSelector";
import CoinSelector from "./CoinSelector";
import TISelectorModal from "./TISelectorModal";
import DraggableTIWindow from "./FloatingTIWindow";  // Corrected import path

interface LiveChartProps {
  selectedCoin: string;
  currentPrice: number;
  onCoinChange: (coin: string) => void;
}

export default function LiveChart({ selectedCoin, currentPrice, onCoinChange }: LiveChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState("1d");
  const [technicalIndicators, setTechnicalIndicators] = useState<string[]>([]);
  const [showTIModal, setShowTIModal] = useState<boolean>(false);

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

  const handleTimeframeChange = (tf: string) => {
    if (tf === "ti") {
      setShowTIModal(true);
      return;
    }
    
    // Only change timeframe if it's a valid interval
    if (intervalMapping[tf]) {
      setSelectedTimeframe(tf);
    }
  };

  // Add handler for removing indicators
  const handleRemoveIndicator = (indicatorToRemove: string) => {
    setTechnicalIndicators(prev => prev.filter(ind => ind !== indicatorToRemove));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chart section - use flex-1 to take remaining space */}
      <div className="flex-1 min-h-0 relative">
        {/* Coin selector overlay */}
        <div className="absolute top-2 left-2 z-10 flex items-center space-x-2 bg-[#151522] p-2 rounded">
          <CoinSelector selectedCoin={selectedCoin} onCoinChange={onCoinChange} />
          <div className="text-xl font-semibold">{currentPrice.toFixed(2)} USDC</div>
        </div>

        {/* Chart content */}
        <div className="h-full">
          <BinanceChart
            selectedCoin={selectedCoin}
            interval={selectedTimeframe}
            technicalIndicators={technicalIndicators}
            onRemoveIndicator={handleRemoveIndicator}
          />
        </div>
      </div>

      {/* Timeframe selector - fixed height */}
      <div className="h-12 bg-[#151522] border-t border-gray-700">
        <TimeframeSelector
          selectedTimeframe={selectedTimeframe}
          onTimeframeChange={handleTimeframeChange}
        />
      </div>

      {showTIModal && (
        <TISelectorModal
          onConfirm={(selected) => {
            setTechnicalIndicators(selected);
            setShowTIModal(false);
            setSelectedTimeframe("1d");
          }}
          onCancel={() => {
            setShowTIModal(false);
            setSelectedTimeframe("1d");
          }}
          initialSelected={technicalIndicators} // Pass current indicators
        />
      )}
    </div>
  );
}
