import { MarketData } from '../types';

export function calculateRSI(data: number[], period: number = 14): number[] {
  const deltas = data.slice(1).map((price, i) => price - data[i]);
  const gains = deltas.map(d => d > 0 ? d : 0);
  const losses = deltas.map(d => d < 0 ? -d : 0);

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period;

  const rsi = [100 - (100 / (1 + avgGain / avgLoss))];

  for (let i = period; i < data.length - 1; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    rsi.push(100 - (100 / (1 + avgGain / avgLoss)));
  }

  return rsi;
}
