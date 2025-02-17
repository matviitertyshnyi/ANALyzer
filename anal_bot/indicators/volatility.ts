import { MarketData } from '../types';

export function calculateATR(data: MarketData[], period: number = 14): number[] {
  const trueRanges: number[] = [];
  const atrs: number[] = [];

  // Calculate True Range
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i-1].close;
    
    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);
    
    trueRanges.push(Math.max(tr1, tr2, tr3));
  }

  // Calculate ATR
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b) / period;
  atrs.push(atr);

  for (let i = period; i < trueRanges.length; i++) {
    atr = ((atr * (period - 1)) + trueRanges[i]) / period;
    atrs.push(atr);
  }

  return atrs;
}

export function calculateVolatilityScore(data: MarketData[]): number {
  const atr = calculateATR(data);
  const lastAtr = atr[atr.length - 1];
  const currentPrice = data[data.length - 1].close;
  
  return (lastAtr / currentPrice) * 100; // Volatility as percentage of price
}
