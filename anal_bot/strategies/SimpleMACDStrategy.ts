import { BaseStrategy } from './BaseStrategy';
import { MarketData } from '../types';

export class SimpleMACDStrategy extends BaseStrategy {
  private calculateEMA(data: number[], period: number): number[] {
    const multiplier = 2 / (period + 1);
    const ema = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
      ema.push((data[i] - ema[i-1]) * multiplier + ema[i-1]);
    }
    return ema;
  }

  private calculateMACD(data: MarketData[]): { macd: number[]; signal: number[] } {
    const closes = data.map(d => d.close);
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    
    const macdLine = ema12.map((v, i) => v - ema26[i]);
    const signalLine = this.calculateEMA(macdLine, 9);
    
    return { macd: macdLine, signal: signalLine };
  }

  protected analyze(data: MarketData[]): 'buy' | 'sell' | 'hold' {
    if (data.length < 26) return 'hold';

    const { macd, signal } = this.calculateMACD(data);
    const last = macd.length - 1;
    const prev = last - 1;

    // MACD crossover strategy
    if (macd[prev] < signal[prev] && macd[last] > signal[last]) {
      return 'buy';
    }
    if (macd[prev] > signal[prev] && macd[last] < signal[last]) {
      return 'sell';
    }
    
    return 'hold';
  }
}
