import React, { useState } from 'react';
import { SimpleMACDStrategy } from '../anal_bot/strategies/SimpleMACDStrategy';
import { MLStrategy } from '../anal_bot/strategies/MLStrategy';
import { EnhancedStrategy } from '../anal_bot/strategies/EnhancedStrategy';
import { MonteCarloSimulator } from '../anal_bot/backtesting/MonteCarloSimulator';
import { fetchHistoricalData } from '../lib/services/binance';
import { apiClient } from '../lib/api/client';
import Layout from '../components/Layout';  // Import default export

interface BacktestConfig {
  timeframe: '1h' | '4h' | '1d';
  days: number;
  leverage: number;
  stopLoss: number;
  takeProfit: number;
  riskPerTrade: number;
}

export default function BacktestPage() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedStrategy, setSelectedStrategy] = useState('MACD');
  const [results, setResults] = useState<any>(null);
  const [config, setConfig] = useState<BacktestConfig>({
    timeframe: '4h',
    days: 30,
    leverage: 5,
    stopLoss: 1,
    takeProfit: 2,
    riskPerTrade: 10
  });

  const runBacktest = async () => {
    setLoading(true);
    setProgress(0);
    try {
      const results = await apiClient.backtest(selectedStrategy, config);
      setResults(results);
    } catch (error) {
      console.error('Backtest failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col gap-4 p-4">
        <div className="bg-[#151522] p-4 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold mb-4">Strategy Backtesting</h1>
          <div className="bg-[#2C2C3F] rounded-lg p-6 shadow-xl border border-[#323248]">
            <h1 className="text-3xl font-bold mb-6 text-white">Strategy Backtesting</h1>
            
            {loading && (
              <div className="mb-6">
                <div className="h-2 bg-[#1B1B29] rounded-full">
                  <div 
                    className="h-full bg-[#3699FF] rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-center mt-2 text-[#92929F]">
                  Testing Strategy: {progress}% Complete
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Configuration Panel */}
              <div className="bg-[#1B1B29] rounded-lg p-6 border border-[#323248]">
                <h2 className="text-xl font-semibold mb-6 text-white">Configuration</h2>
              
                <div className="space-y-4">
                  <div>
                    <label className="block mb-2">Strategy</label>
                    <select
                      value={selectedStrategy}
                      onChange={(e) => setSelectedStrategy(e.target.value)}
                      className="w-full bg-[#1E1E2D] p-2 rounded"
                    >
                      <option value="MACD">MACD Strategy</option>
                      <option value="ML">Machine Learning Strategy</option>
                      <option value="ENHANCED">Enhanced Strategy</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-2">Timeframe</label>
                    <select
                      value={config.timeframe}
                      onChange={(e) => setConfig(prev => ({ ...prev, timeframe: e.target.value as any }))}
                      className="w-full bg-[#1E1E2D] p-2 rounded"
                    >
                      <option value="1h">1 Hour</option>
                      <option value="4h">4 Hours</option>
                      <option value="1d">1 Day</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-2">Days of Historical Data</label>
                    <input
                      type="number"
                      value={config.days}
                      onChange={(e) => setConfig(prev => ({ ...prev, days: parseInt(e.target.value) }))}
                      className="w-full bg-[#1E1E2D] p-2 rounded"
                    />
                  </div>

                  <div>
                    <label className="block mb-2">Leverage</label>
                    <input
                      type="number"
                      value={config.leverage}
                      onChange={(e) => setConfig(prev => ({ ...prev, leverage: parseInt(e.target.value) }))}
                      className="w-full bg-[#1E1E2D] p-2 rounded"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-2">Stop Loss %</label>
                      <input
                        type="number"
                        value={config.stopLoss}
                        onChange={(e) => setConfig(prev => ({ ...prev, stopLoss: parseFloat(e.target.value) }))}
                        className="w-full bg-[#1E1E2D] p-2 rounded"
                      />
                    </div>
                    <div>
                      <label className="block mb-2">Take Profit %</label>
                      <input
                        type="number"
                        value={config.takeProfit}
                        onChange={(e) => setConfig(prev => ({ ...prev, takeProfit: parseFloat(e.target.value) }))}
                        className="w-full bg-[#1E1E2D] p-2 rounded"
                      />
                    </div>
                  </div>

                  <button
                    onClick={runBacktest}
                    disabled={loading}
                    className="w-full bg-[#3699FF] hover:bg-[#3699FF]/80 py-3 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
                  >
                    {loading ? `Testing... ${progress}%` : 'Run Backtest'}
                  </button>
                </div>
              </div>

              {/* Results Panel */}
              <div className="bg-[#1B1B29] rounded-lg p-6 border border-[#323248]">
                <h2 className="text-xl font-semibold mb-6 text-white">Results</h2>
              
                {results ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <MetricCard 
                        label="Win Rate" 
                        value={`${results.winRate.toFixed(2)}%`}
                        good={results.winRate > 50}
                      />
                      <MetricCard 
                        label="Expected Return" 
                        value={`${results.expectedReturn.toFixed(2)}%`}
                        good={results.expectedReturn > 0}
                      />
                      <MetricCard 
                        label="Max Drawdown" 
                        value={`${results.maxDrawdown.toFixed(2)}%`}
                        good={results.maxDrawdown < 20}
                        invert
                      />
                      <MetricCard 
                        label="Sharpe Ratio" 
                        value={results.riskMetrics.sharpeRatio.toFixed(2)}
                        good={results.riskMetrics.sharpeRatio > 1}
                      />
                      <MetricCard 
                        label="Total Trades" 
                        value={results.totalTrades}
                        good={results.totalTrades > 10}
                      />
                      <MetricCard 
                        label="Max Consecutive Losses" 
                        value={results.riskMetrics.maxConsecutiveLosses}
                        good={results.riskMetrics.maxConsecutiveLosses < 5}
                        invert
                      />
                    </div>

                    <div className="mt-4">
                      <h3 className="text-lg mb-2">Trade Statistics</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-green-400">
                          Avg. Profit: ${results.avgProfit.toFixed(2)}
                        </div>
                        <div className="text-red-400">
                          Avg. Loss: ${results.avgLoss.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-[#92929F]">
                    Run a backtest to see results
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

const MetricCard = ({ label, value, good, invert = false }: { 
  label: string; 
  value: string | number; 
  good: boolean;
  invert?: boolean;
}) => (
  <div className="bg-[#2C2C3F] rounded-lg p-4 border border-[#323248]">
    <div className="text-[#92929F] text-sm mb-1">{label}</div>
    <div className={`text-lg font-semibold ${
      invert
        ? (good ? 'text-[#0BB783]' : 'text-[#F64E60]')
        : (good ? 'text-[#0BB783]' : 'text-[#F64E60]')
    }`}>
      {value}
    </div>
  </div>
);

function createStrategy(type: string, config: BacktestConfig) {
  const baseConfig = {
    symbol: 'BTCUSDT',
    interval: config.timeframe,
    maxLeverage: config.leverage,
    stopLoss: config.stopLoss,
    takeProfit: config.takeProfit,
    riskPerTrade: config.riskPerTrade
  };

  switch (type) {
    case 'ML':
      return new MLStrategy({
        ...baseConfig,
        mlConfig: {
          windowSize: 60,
          confidenceThreshold: 0.6,
          trainingInterval: 24 * 60 * 60 * 1000
        }
      });
    case 'ENHANCED':
      return new EnhancedStrategy(baseConfig);
    default:
      return new SimpleMACDStrategy(baseConfig);
  }
}
