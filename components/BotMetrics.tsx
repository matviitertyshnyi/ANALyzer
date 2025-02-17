import React from 'react';
import { TradeMetrics } from '../anal_bot/types';
// Remove Line import as we'll use simpler metrics display for now

interface BotMetricsProps {
  metrics: TradeMetrics;
  symbol: string;
}

export default function BotMetrics({ metrics, symbol }: BotMetricsProps) {
  return (
    <div className="bg-[#1E1E2D] p-4 rounded-lg">
      <h3 className="text-xl font-bold mb-4">Bot Performance</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#2C2C3F] p-3 rounded">
          <p className="text-gray-400 text-sm">Win Rate</p>
          <p className={`text-lg font-medium ${metrics.winRate >= 50 ? 'text-green-500' : 'text-red-500'}`}>
            {metrics.winRate.toFixed(1)}%
          </p>
        </div>
        <div className="bg-[#2C2C3F] p-3 rounded">
          <p className="text-gray-400 text-sm">Profit Factor</p>
          <p className={`text-lg font-medium ${metrics.profitFactor >= 1.5 ? 'text-green-500' : 'text-yellow-500'}`}>
            {metrics.profitFactor.toFixed(2)}
          </p>
        </div>
        <div className="bg-[#2C2C3F] p-3 rounded">
          <p className="text-gray-400 text-sm">Total Trades</p>
          <p className="text-lg font-medium text-blue-500">{metrics.totalTrades}</p>
        </div>
        <div className="bg-[#2C2C3F] p-3 rounded">
          <p className="text-gray-400 text-sm">Avg Profit</p>
          <p className="text-lg font-medium text-green-500">${metrics.avgProfit.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}
