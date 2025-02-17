'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import LiveChart from "@/components/LiveChart";
import OrderEntry from "@/components/OrderEntry";
import PositionsTable from "@/components/PositionsTable";
import RecentTrades from "@/components/RecentTrades";
import BalanceAdjuster from "@/components/BalanceAdjuster";
import BotMetrics from "@/components/BotMetrics";
import Header from "@/components/Header";
import Layout from "@/components/Layout";
import { Position } from "@/app/types";

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

  const handleClosePosition = async (positionId: string) => {
    try {
      const response = await fetch(`/api/positions/${positionId}/close`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        // Remove position from active positions
        const closedPosition = positions.find(p => p.id === positionId);
        if (closedPosition) {
          // Update position with exit data
          const updatedPosition = {
            ...closedPosition,
            exitPrice: data.exitPrice,
            profit: data.profit
          };
          
          // Update UI states
          setPositions(prev => prev.filter(p => p.id !== positionId));
          setClosedTrades(prev => [...prev, updatedPosition]);
          setBalance(prev => prev + closedPosition.initialMargin + data.profit);
          
          // Send notification
          await notifyPositionClosed(updatedPosition, data.profit);
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

  // Update positions fetch effect
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const response = await fetch('/api/positions');
        const data = await response.json();
        console.log('Fetched positions:', data);
        
        if (Array.isArray(data)) {
          setPositions(data.map(p => ({
            ...p,
            timestamp: new Date(p.timestamp)
          })));
        } else {
          console.error('Invalid positions data:', data);
        }
      } catch (error) {
        console.error('Failed to fetch positions:', error);
      }
    };

    fetchPositions();
    const interval = setInterval(fetchPositions, 5000);
    return () => clearInterval(interval);
  }, []);

  // Add balance fetch effect
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const response = await fetch('/api/balance');
        const data = await response.json();
        setBalance(data.balance);
      } catch (error) {
        console.error('Failed to fetch balance:', error);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 5000);
    return () => clearInterval(interval);
  }, []);

  // Update toggleBot to handle errors and force state refresh
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
      console.log('Toggle response:', data);
      
      if (data.success) {
        // Immediately update UI state
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

    // Check immediately on mount
    checkBotState();

    // Then check every 10 seconds
    const interval = setInterval(checkBotState, 10000);
    return () => clearInterval(interval);
  }, [botActive]);

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
    <Layout>
      <div className="min-h-screen bg-[#21212]">
        <Header />
        <main className="flex flex-col gap-4 p-4">
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
            {/* ...rest of your JSX from dashboard.tsx... */}
          </div>
        </main>
      </div>
    </Layout>
  );
}
