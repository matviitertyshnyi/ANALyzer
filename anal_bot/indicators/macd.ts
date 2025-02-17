import { MarketData } from '../types';

export function calculateMACD(
  data: MarketData[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  const closes = data.map(d => d.close);
  
  // Calculate EMAs
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);
  
  // Calculate MACD line
  const macdLine = fastEMA.map((fast, i) => fast - slowEMA[i]);
  
  // Calculate Signal line
  const signalLine = calculateEMA(macdLine, signalPeriod);
  
  // Calculate histogram
  const histogram = macdLine.map((macd, i) => macd - signalLine[i]);

  return {
    macd: macdLine,
    signal: signalLine,
    histogram
  };
}

function calculateEMA(data: number[], period: number): number[] {
  const multiplier = 2 / (period + 1);
  const ema = [data[0]];
  
  for (let i = 1; i < data.length; i++) {
    ema.push((data[i] - ema[i-1]) * multiplier + ema[i-1]);
  }
  
  return ema;
}
