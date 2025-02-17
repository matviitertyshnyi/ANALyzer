import { MarketData } from '../types';

export class DataProcessor {
  private meanValues: { [key: string]: number } = {};
  private stdValues: { [key: string]: number } = {};

  public normalize(data: MarketData[]): MarketData[] {
    const features: (keyof MarketData)[] = ['open', 'high', 'low', 'close', 'volume'];
    features.forEach(feature => {
      const values = data.map(d => d[feature]).filter((v): v is number => v !== undefined);
      this.meanValues[feature] = this.calculateMean(values);
      this.stdValues[feature] = this.calculateStd(values);
    });

    return data.map(candle => ({
      ...candle,
      open: this.zScore(candle.open, 'open'),
      high: this.zScore(candle.high, 'high'),
      low: this.zScore(candle.low, 'low'),
      close: this.zScore(candle.close, 'close'),
      volume: this.zScore(candle.volume, 'volume')
    }));
  }

  public extractFeatures(data: MarketData[]): number[][] {
    return data.map(candle => [
      candle.close,
      (candle.high - candle.low) / candle.low, // Volatility
      (candle.close - candle.open) / candle.open, // Body size
      candle.volume,
      this.calculateRSI(data, 14),
      this.calculateBBPosition(data, 20),
      this.calculateMACD(data)[0],
      this.calculateVolumeTrend(data, 20)
    ]);
  }

  // Helper methods for technical indicators...
  private calculateRSI(data: MarketData[], period: number): number {
    const gains = [];
    const losses = [];
    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      if (change > 0) {
        gains.push(change);
        losses.push(0);
      } else {
        gains.push(0);
        losses.push(Math.abs(change));
      }
    }
    const avgGain = this.calculateMean(gains.slice(0, period));
    const avgLoss = this.calculateMean(losses.slice(0, period));
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateBBPosition(data: MarketData[], period: number): number {
    const closes = data.map(d => d.close);
    const mean = this.calculateMean(closes.slice(-period));
    const std = this.calculateStd(closes.slice(-period));
    const lastClose = closes[closes.length - 1];
    return (lastClose - mean) / (2 * std);
  }

  private calculateMACD(data: MarketData[]): [number, number] {
    const shortEMA = this.calculateEMA(data.map(d => d.close), 12);
    const longEMA = this.calculateEMA(data.map(d => d.close), 26);
    const macd = shortEMA - longEMA;
    const signal = this.calculateEMA([macd], 9);
    return [macd, signal];
  }

  private calculateVolumeTrend(data: MarketData[], period: number): number {
    const volumes = data.map(d => d.volume);
    const meanVolume = this.calculateMean(volumes.slice(-period));
    const lastVolume = volumes[volumes.length - 1];
    return lastVolume / meanVolume;
  }

  private calculateEMA(values: number[], period: number): number {
    const k = 2 / (period + 1);
    return values.reduce((prev, curr) => k * curr + (1 - k) * prev);
  }

  private zScore(value: number, feature: keyof MarketData): number {
    return (value - this.meanValues[feature]) / this.stdValues[feature];
  }

  private calculateMean(values: number[]): number {
    return values.reduce((a, b) => a + b) / values.length;
  }

  private calculateStd(values: number[]): number {
    const mean = this.calculateMean(values);
    return Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
  }
}
