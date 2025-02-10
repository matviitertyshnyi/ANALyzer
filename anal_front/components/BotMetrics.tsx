import { StrategyMetrics } from '../lib/bot/types';

interface BotMetricsProps {
  metrics: StrategyMetrics;
  symbol: string;
}

export default function BotMetrics({ metrics, symbol }: BotMetricsProps) {
  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Bot Performance ({symbol})</h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>Total Trades: {metrics.totalTrades}</div>
        <div>Win Rate: {(metrics.winRate * 100).toFixed(2)}%</div>
        <div>Winning Trades: {metrics.winningTrades}</div>
        <div>Losing Trades: {metrics.losingTrades}</div>
        <div>Total Profit: {metrics.totalProfit.toFixed(2)} USDC</div>
        <div>Avg ROI: {metrics.averageROI.toFixed(2)}%</div>
      </div>
    </div>
  );
}
