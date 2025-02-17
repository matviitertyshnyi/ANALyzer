import React, { useState, useEffect } from 'react';
import { SimpleMACDStrategy as SimpleMACD } from '../anal_bot/strategies/SimpleMACDStrategy';
import { MLStrategy } from '../anal_bot/strategies/MLStrategy';
import { EnhancedStrategy } from '../anal_bot/strategies/EnhancedStrategy';
import { fetchHistoricalData } from '../lib/services/binance';
import { MonteCarloSimulator } from '../anal_bot/backtesting/MonteCarloSimulator';

interface StrategyMetrics {
  name: string;
  winRate: number;
  expectedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  status: 'idle' | 'testing' | 'ready';
  isActive: boolean;
}

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<StrategyMetrics[]>([
    { name: 'MACD', winRate: 0, expectedReturn: 0, maxDrawdown: 0, sharpeRatio: 0, totalTrades: 0, status: 'idle', isActive: false },
    { name: 'ML', winRate: 0, expectedReturn: 0, maxDrawdown: 0, sharpeRatio: 0, totalTrades: 0, status: 'idle', isActive: false },
    { name: 'Enhanced', winRate: 0, expectedReturn: 0, maxDrawdown: 0, sharpeRatio: 0, totalTrades: 0, status: 'idle', isActive: false }
  ]);

  const [selectedTimeframe, setSelectedTimeframe] = useState('4h');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchCurrentStrategy();
  }, []);

  const fetchCurrentStrategy = async () => {
    const response = await fetch('/api/bot/state');
    const { strategy } = await response.json();
    setStrategies(prev => prev.map(s => ({
      ...s,
      isActive: s.name === strategy
    })));
  };

  const testStrategy = async (name: string) => {
    setStrategies(prev => prev.map(s => 
      s.name === name ? { ...s, status: 'testing' } : s
    ));

    try {
      const data = await fetchHistoricalData('BTCUSDT', selectedTimeframe, 30);
      const simulator = new MonteCarloSimulator();
      const strategy = createStrategy(name);

      const results = await simulator.simulateStrategy(strategy, data, 10);

      setStrategies(prev => prev.map(s => 
        s.name === name ? {
          ...s,
          winRate: results.winRate,
          expectedReturn: results.expectedReturn,
          maxDrawdown: results.maxDrawdown,
          sharpeRatio: results.riskMetrics.sharpeRatio,
          totalTrades: results.totalTrades,
          status: 'ready'
        } : s
      ));
    } catch (error) {
      console.error(`Failed to test ${name}:`, error);
    }
  };

  const activateStrategy = async (name: string) => {
    try {
      const response = await fetch('/api/bot/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: name })
      });

      if (response.ok) {
        setStrategies(prev => prev.map(s => ({
          ...s,
          isActive: s.name === name
        })));
      }
    } catch (error) {
      console.error('Failed to activate strategy:', error);
    }
  };

  return (
    <div className="p-6 bg-[#1E1E2D]">
      <h1 className="text-2xl font-bold mb-6">Strategy Comparison</h1>

      <div className="mb-6 flex gap-4">
        <select 
          value={selectedTimeframe}
          onChange={(e) => setSelectedTimeframe(e.target.value)}
          className="bg-[#2C2C3F] p-2 rounded"
        >
          <option value="1h">1 Hour</option>
          <option value="4h">4 Hours</option>
          <option value="1d">1 Day</option>
        </select>

        <button
          onClick={() => strategies.forEach(s => testStrategy(s.name))}
          disabled={testing}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
        >
          Test All Strategies
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {strategies.map(strategy => (
          <div key={strategy.name} className="bg-[#2C2C3F] p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{strategy.name}</h3>
              <span className={`px-2 py-1 rounded text-sm ${
                strategy.isActive ? 'bg-green-600' : 'bg-gray-600'
              }`}>
                {strategy.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            {strategy.status === 'testing' ? (
              <div className="text-center py-4">Testing...</div>
            ) : strategy.status === 'ready' ? (
              <div className="space-y-2">
                <MetricRow label="Win Rate" value={`${strategy.winRate.toFixed(2)}%`} />
                <MetricRow label="Expected Return" value={`${strategy.expectedReturn.toFixed(2)}%`} />
                <MetricRow label="Max Drawdown" value={`${strategy.maxDrawdown.toFixed(2)}%`} />
                <MetricRow label="Sharpe Ratio" value={strategy.sharpeRatio.toFixed(2)} />
                <MetricRow label="Total Trades" value={strategy.totalTrades} />
              </div>
            ) : (
              <div className="text-center py-4">Not tested</div>
            )}

            <div className="mt-4 space-x-2">
              <button
                onClick={() => testStrategy(strategy.name)}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded"
              >
                Test
              </button>
              <button
                onClick={() => activateStrategy(strategy.name)}
                disabled={strategy.isActive}
                className={`px-3 py-1 rounded ${
                  strategy.isActive 
                    ? 'bg-gray-600' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                Activate
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const MetricRow = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between">
    <span className="text-gray-400">{label}</span>
    <span>{value}</span>
  </div>
);

function createStrategy(name: string) {
  const config = {
    symbol: 'BTCUSDT',
    interval: '4h',
    maxLeverage: 5,
    stopLoss: 1,
    takeProfit: 2,
    riskPerTrade: 10
  };

  switch (name) {
    case 'MACD':
      return new SimpleMACD(config);
    case 'ML':
      return new MLStrategy({
        ...config,
        mlConfig: {
          windowSize: 60,
          confidenceThreshold: 0.6,
          trainingInterval: 24 * 60 * 60 * 1000
        }
      });
    case 'Enhanced':
      return new EnhancedStrategy(config);
    default:
      return new SimpleMACD(config);
  }
}
