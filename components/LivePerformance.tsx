import React, { useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { Trade } from '../anal_bot/types';

interface LivePerformanceProps {
  trades: Trade[];
  balance: number;
  metrics: {
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
    dailyPnL: number[];
  };
}

export default function LivePerformance({ trades, balance, metrics }: LivePerformanceProps) {
  const chartRef = useRef(null);

  const chartData = {
    labels: metrics.dailyPnL.map((_, i) => `Day ${i + 1}`),
    datasets: [
      {
        label: 'Daily P&L',
        data: metrics.dailyPnL,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }
    ]
  };

  return (
    <div className="bg-[#1E1E2D] p-4 rounded-lg">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <MetricCard
          title="Win Rate"
          value={`${metrics.winRate.toFixed(2)}%`}
          trend={metrics.winRate > 50 ? 'up' : 'down'}
        />
        <MetricCard
          title="Profit Factor"
          value={metrics.profitFactor.toFixed(2)}
          trend={metrics.profitFactor > 1 ? 'up' : 'down'}
        />
        <MetricCard
          title="Sharpe Ratio"
          value={metrics.sharpeRatio.toFixed(2)}
          trend={metrics.sharpeRatio > 1 ? 'up' : 'down'}
        />
        <MetricCard
          title="Max Drawdown"
          value={`${metrics.maxDrawdown.toFixed(2)}%`}
          trend="neutral"
        />
      </div>
      <div className="h-64">
        <Line ref={chartRef} data={chartData} options={{ maintainAspectRatio: false }} />
      </div>
    </div>
  );
}

function MetricCard({ title, value, trend }: { 
  title: string; 
  value: string; 
  trend: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="p-4 bg-[#2C2C3F] rounded-lg">
      <h3 className="text-gray-400 text-sm">{title}</h3>
      <p className={`text-2xl font-bold ${
        trend === 'up' ? 'text-green-500' : 
        trend === 'down' ? 'text-red-500' : 
        'text-blue-500'
      }`}>
        {value}
      </p>
    </div>
  );
}
