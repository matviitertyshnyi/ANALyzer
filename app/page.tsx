// anal_front/app/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import LiveChart from "../components/LiveChart";
import OrderEntry from "../components/OrderEntry";
import PositionsTable from "../components/PositionsTable";
import RecentTrades from "../components/RecentTrades";
import BalanceAdjuster from "../components/BalanceAdjuster";
import { Position } from "./types";
import { TradingBot } from "../lib/bot/TradingBot";
import { SimpleMACDStrategy } from "../lib/bot/strategies/SimpleMACDStrategy";
import BotMetrics from "../components/BotMetrics";
import { notifyNewPosition, notifyPositionClosed } from '../lib/services/telegram';

export default function Home() {
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

  // WebSocket for live ticker updates.
  useEffect(() => {
    const symbolLower = selectedCoin.toLowerCase();
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbolLower}@ticker`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const livePrice = parseFloat(data.c);
      setPricesMapping((prev) => ({ ...prev, [selectedCoin]: livePrice }));
    };
    ws.onerror = (error) => console.error("Ticker WebSocket error:", error);
    return () => ws.close();
  }, [selectedCoin]);

  const currentPrice = pricesMapping[selectedCoin] || 0;
  useEffect(() => {
    setPrevPrice((prev) => (currentPrice !== prev ? currentPrice : prev));
  }, [currentPrice]);

  const handleAddPosition = (position: Position) => {
    if (!currentPrice) {
      alert("Cannot create position: Price data not available");
      return;
    }
    setPositions((prev) => [...prev, position]);
    setBalance((prev) => prev - position.initialMargin);
    notifyNewPosition(position);
  };

  const handleClosePosition = (positionId: string, profit: number, margin: number) => {
    const pos = positions.find((p) => p.id === positionId);
    if (pos) {
      const exitPrice = pricesMapping[pos.coin] || pos.entryPrice;
      const closedTrade: Position = { ...pos, exitPrice, profit };
      setClosedTrades((prev) => {
        if (prev.some((trade) => trade.id === pos.id)) return prev;
        return [...prev, closedTrade];
      });
      notifyPositionClosed(closedTrade, profit);
    }
    setPositions((prev) => prev.filter((p) => p.id !== positionId));
    setBalance((prev) => prev + margin + profit);
  };

  const toggleBot = useCallback(() => {
    if (!currentPrice) {
      alert("Cannot start bot: Price data not available");
      return;
    }

    if (!botRef.current && orderEntryRef.current) {
      console.log("Starting bot with config:", selectedCoin);
      const strategy = new SimpleMACDStrategy({
        symbol: selectedCoin,
        interval: "1m",
        maxLeverage: 10,
        riskPerTrade: 5,
        stopLoss: 2,
        takeProfit: 4
      });

      try {
        botRef.current = new TradingBot(strategy, {
          placeLongOrder: orderEntryRef.current.placeLongOrder,
          placeShortOrder: orderEntryRef.current.placeShortOrder
        });

        botRef.current.start();
        setBotActive(true);
      } catch (error) {
        console.error("Failed to start bot:", error);
        botRef.current = null;
        setBotActive(false);
      }
    } else if (botRef.current) {
      console.log("Stopping bot...");
      if (typeof botRef.current.stop === 'function') {
        botRef.current.stop();
      }
      botRef.current = null;
      setBotActive(false);
    }
  }, [selectedCoin, currentPrice]);

  // Update metrics update interval
  useEffect(() => {
    if (botRef.current && botActive) {
      // Initial metrics update
      const strategy = botRef.current.getStrategy();
      if (strategy) {
        setBotMetrics(strategy.getMetrics());
      }

      const interval = setInterval(() => {
        const strategy = botRef.current?.getStrategy();
        if (strategy) {
          setBotMetrics(strategy.getMetrics());
        }
      }, 5000);

      return () => clearInterval(interval);
    } else {
      setBotMetrics(null);
    }
  }, [botActive]);

  // Clean up bot on unmount
  useEffect(() => {
    return () => {
      if (botRef.current && typeof botRef.current.stop === 'function') {
        botRef.current.stop();
        botRef.current = null;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#21212]">
      <main className="flex flex-col gap-4 p-4">
        {/* Main Chart and Order Entry in a row */}
        <div className="flex gap-4">
          {/* Left side with Chart and Timeframe */}
          <div className="flex-[3] flex flex-col bg-[#151522] rounded-lg overflow-hidden">
            <LiveChart
              selectedCoin={selectedCoin}
              currentPrice={currentPrice}
              onCoinChange={setSelectedCoin}
            />
          </div>

          {/* Order Entry */}
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
            <h2 className="text-2xl font-bold mb-4">Order Entry</h2>
            <OrderEntry
              ref={orderEntryRef}
              selectedCoin={selectedCoin}
              currentPrice={currentPrice}
              balance={balance}
              onSubmit={handleAddPosition}
              disabled={!currentPrice} // Add disabled prop
            />
          </div>
        </div>

        {/* Positions and Trades */}
        <div className="w-full bg-[#151522] p-4 rounded-lg shadow-lg">
          <div className="flex space-x-2 mb-4">
            <button
              onClick={() => setActiveTab("openPositions")}
              className={`px-4 py-2 rounded border border-gray-600 bg-transparent ${
                activeTab === "openPositions" ? "text-white" : "text-gray-400"
              } hover:text-white hover:border-white`}
            >
              Open Positions
            </button>
            <button
              onClick={() => setActiveTab("recentTrades")}
              className={`px-4 py-2 rounded border border-gray-600 bg-transparent ${
                activeTab === "recentTrades" ? "text-white" : "text-gray-400"
              } hover:text-white hover:border-white`}
            >
              Recent Trades
            </button>
            <button
              onClick={() => setActiveTab("openOrders")}
              className={`px-4 py-2 rounded border border-gray-600 bg-transparent ${
                activeTab === "openOrders" ? "text-white" : "text-gray-400"
              } hover:text-white hover:border-white`}
            >
              Open Orders
            </button>
          </div>
          <div>
            {activeTab === "openPositions" && (
              <PositionsTable
                positions={positions}
                pricesMapping={pricesMapping}
                onClose={handleClosePosition}
                balance={balance}  // Pass balance prop
              />
            )}
            {activeTab === "recentTrades" && <RecentTrades closedTrades={closedTrades} />}
            {activeTab === "openOrders" && (
              <div className="text-gray-400">No open orders.</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
