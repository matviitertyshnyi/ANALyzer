import { useState, useEffect, useRef, useCallback } from "react";
import Layout from "@/components/Layout";
import LiveChart from "@/components/LiveChart";
import OrderEntry from "@/components/OrderEntry";
import PositionsTable from "@/components/PositionsTable";
import RecentTrades from "@/components/RecentTrades";
import BalanceAdjuster from "@/components/BalanceAdjuster";
import BotMetrics from "@/components/BotMetrics";
import { Position } from "@/types";
import { TradingBot } from "@/lib/bot/TradingBot";
import type { StrategyMetrics } from "@/types";

export default function DashboardPage() {
  const [selectedCoin, setSelectedCoin] = useState("BTCUSDT");
  const [positions, setPositions] = useState<Position[]>([]);
  const [closedTrades, setClosedTrades] = useState<Position[]>([]);
  const [balance, setBalance] = useState<number>(1000);
  const [pricesMapping, setPricesMapping] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState("openPositions");
  const [prevPrice, setPrevPrice] = useState<number>(0);
  const orderEntryRef = useRef<{
    placeLongOrder: (amount: number, leverage: number) => void;
    placeShortOrder: (amount: number, leverage: number) => void;
  }>(null);
  const [botActive, setBotActive] = useState(false);
  const botRef = useRef<TradingBot | null>(null);
  const [botMetrics, setBotMetrics] = useState<StrategyMetrics | null>(null);

  const handleAddPosition = (position: Position) => {
    if (!currentPrice) {
      alert("Cannot create position: Price data not available");
      return;
    }
    setPositions((prev) => [...prev, position]);
    setBalance((prev) => prev - position.initialMargin);
  };

  const handleClosePosition = async (positionId: string) => {
    try {
      const response = await fetch(`/api/positions/${positionId}/close`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        const closedPosition = positions.find(p => p.id === positionId);
        if (closedPosition) {
          const updatedPosition = {
            ...closedPosition,
            exitPrice: data.exitPrice,
            profit: data.profit
          };
          
          setPositions(prev => prev.filter(p => p.id !== positionId));
          setClosedTrades(prev => [...prev, updatedPosition]);
          setBalance(prev => prev + closedPosition.initialMargin + data.profit);
        }
      } else {
        console.error('Failed to close position:', data.error);
        alert(data.error || 'Failed to close position');
      }
    } catch (error) {
      console.error('Failed to close position:', error);
      alert('Failed to close position. Check console for details.');
    }
  };

  const toggleBot = useCallback(async () => {
    try {
      const action = botActive ? 'stop' : 'start';
      console.log('Toggling bot:', action);
      
      const response = await fetch('/api/bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      
      const data = await response.json();
      if (data.success) {
        setBotActive(action === 'start');
      } else {
        console.error('Failed to toggle bot:', data.error);
        alert(data.error || 'Failed to toggle bot');
      }
    } catch (error) {
      console.error('Failed to toggle bot:', error);
      alert('Failed to toggle bot. Check console for details.');
    }
  }, [botActive]);

  // Add periodic state check
  useEffect(() => {
    const checkBotState = async () => {
      try {
        const response = await fetch('/api/bot');
        const data = await response.json();
        if (data.isActive !== botActive) {
          setBotActive(data.isActive);
        }
      } catch (error) {
        console.error('Failed to check bot state:', error);
      }
    };

    checkBotState();
    const interval = setInterval(checkBotState, 10000);
    return () => clearInterval(interval);
  }, [botActive]);

  // WebSocket for live ticker updates
  useEffect(() => {
    const symbolLower = selectedCoin.toLowerCase();
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbolLower}@ticker`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const livePrice = parseFloat(data.c);
      setPricesMapping((prev) => ({ ...prev, [selectedCoin]: livePrice }));
    };

    ws.onerror = (error) => console.error("WebSocket error:", error);
    
    return () => ws.close();
  }, [selectedCoin]);

  const currentPrice = pricesMapping[selectedCoin] || 0;

  useEffect(() => {
    setPrevPrice((prev) => (currentPrice !== prev ? currentPrice : prev));
  }, [currentPrice]);

  return (
    <Layout>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex gap-4">
          <div className="flex-[3] flex flex-col bg-[#151522] rounded-lg overflow-hidden">
            <LiveChart
              selectedCoin={selectedCoin}
              currentPrice={currentPrice}
              onCoinChange={setSelectedCoin}
            />
          </div>
          <div className="flex-1 bg-[#151522] p-4 rounded-lg shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <BalanceAdjuster balance={balance} onAdjust={setBalance} />
              <button
                onClick={toggleBot}
                className={`px-4 py-2 rounded ${
                  botActive ? "bg-red-600" : "bg-blue-600"
                }`}
              >
                {botActive ? "Stop Bot" : "Start Bot"}
              </button>
            </div>
            {botMetrics && <BotMetrics metrics={botMetrics} symbol={selectedCoin} />}
            <OrderEntry
              ref={orderEntryRef}
              selectedCoin={selectedCoin}
              currentPrice={currentPrice}
              balance={balance}
              onSubmit={handleAddPosition}
              disabled={!currentPrice}
            />
          </div>
        </div>

        <div className="w-full bg-[#151522] p-4 rounded-lg shadow-lg">
          <div className="flex space-x-2 mb-4">
            <button
              onClick={() => setActiveTab("openPositions")}
              className={`px-4 py-2 rounded ${
                activeTab === "openPositions"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300"
              }`}
            >
              Open Positions
            </button>
            <button
              onClick={() => setActiveTab("recentTrades")}
              className={`px-4 py-2 rounded ${
                activeTab === "recentTrades"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300"
              }`}
            >
              Recent Trades
            </button>
          </div>

          {activeTab === "openPositions" && (
            <PositionsTable
              positions={positions}
              pricesMapping={pricesMapping}
              onClose={handleClosePosition}
              balance={balance}
            />
          )}
          {activeTab === "recentTrades" && <RecentTrades closedTrades={closedTrades} />}
        </div>
      </div>
    </Layout>
  );
}
