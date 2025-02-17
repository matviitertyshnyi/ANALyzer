import React from 'react';
import { Line } from 'react-chartjs-2';
import { Trade } from '../anal_bot/types';

interface BacktestResultsProps {
  trades: Trade[];
  metrics: {
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    totalTrades: number;
  };
  balanceHistory: number[];
}

export default function BacktestResults({ trades, metrics, balanceHistory }: BacktestResultsProps) {
  const data = {
    labels: balanceHistory.map((_, i) => i),
    datasets: [{
      label: 'Account Balance',
      data: balanceHistory,
      borderColor: 'rgb(75, 192, 192)',
      tension: 0.1
    }]
  };

  return (
    <div className="bg-[#1E1E2D] p-4 rounded-lg">
      <h3 className="text-xl font-bold mb-4">Backtest Results</h3>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-[#2C2C3F] rounded">
          <p className="text-gray-400">Win Rate</p>
          <p className="text-2xl text-green-500">{metrics.winRate.toFixed(2)}%</p>
        </div>
        <div className="p-3 bg-[#2C2C3F] rounded">
          <p className="text-gray-400">Profit Factor</p>
          <p className="text-2xl text-blue-500">{metrics.profitFactor.toFixed(2)}</p>
        </div>
        <div className="p-3 bg-[#2C2C3F] rounded">
          <p className="text-gray-400">Max Drawdown</p>
          <p className="text-2xl text-red-500">{metrics.maxDrawdown.toFixed(2)}%</p>
        </div>
        <div className="p-3 bg-[#2C2C3F] rounded">
          <p className="text-gray-400">Total Trades</p>
          <p className="text-2xl text-white">{metrics.totalTrades}</p>
        </div>
      </div>
      <div className="h-64">
        <Line data={data} options={{ maintainAspectRatio: false }} />
      </div>
    </div>
  );
}
