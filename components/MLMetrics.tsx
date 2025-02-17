import React, { useEffect, useState } from 'react';
import axios from 'axios';

export const MLMetrics = () => {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await axios.get('/api/ml/metrics');
        setMetrics(response.data);
      } catch (error) {
        console.error('Failed to fetch ML metrics:', error);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard
        title="PnL"
        value={metrics?.pnl ? `${metrics.pnl.toFixed(2)} USDT` : '0.00 USDT'}
        isPositive={metrics?.pnl > 0}
      />
      <MetricCard
        title="Win Rate"
        value={metrics?.winRate ? `${(metrics.winRate * 100).toFixed(2)}%` : '0%'}
        isPositive={metrics?.winRate > 0.5}
      />
      <MetricCard
        title="Accuracy"
        value={metrics?.accuracy ? `${(metrics.accuracy * 100).toFixed(2)}%` : '0%'}
        isPositive={metrics?.accuracy > 0.5}
      />
      <MetricCard
        title="Total Trades"
        value={metrics?.totalTrades?.toString() || '0'}
      />
      <MetricCard
        title="Sharpe Ratio"
        value={metrics?.sharpeRatio?.toFixed(2) || '0.00'}
        isPositive={metrics?.sharpeRatio > 0}
      />
      <MetricCard
        title="Max Drawdown"
        value={metrics?.maxDrawdown ? `${(metrics.maxDrawdown * 100).toFixed(2)}%` : '0%'}
        isPositive={false}
      />
    </div>
  );
};

const MetricCard = ({ title, value, isPositive = undefined }) => (
  <div className="bg-[#1B1B29] p-4 rounded-lg">
    <h3 className="text-gray-400 text-sm mb-2">{title}</h3>
    <p className={`text-xl font-bold ${
      isPositive === undefined ? 'text-white' :
      isPositive ? 'text-green-400' : 'text-red-400'
    }`}>
      {value}
    </p>
  </div>
);
