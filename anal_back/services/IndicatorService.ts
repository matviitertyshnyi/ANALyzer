import { technicalIndicators } from 'technicalindicators';

export class IndicatorService {
  static calculateIndicators(candles: any[]): number[][] {
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);

    // Trend indicators
    const sma20 = technicalIndicators.SMA.calculate({period: 20, values: closes});
    const ema9 = technicalIndicators.EMA.calculate({period: 9, values: closes});
    const ema21 = technicalIndicators.EMA.calculate({period: 21, values: closes});

    // Momentum indicators
    const rsi = technicalIndicators.RSI.calculate({period: 14, values: closes});
    const macd = technicalIndicators.MACD.calculate({
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      values: closes
    });

    // Volatility indicators
    const bb = technicalIndicators.BollingerBands.calculate({
      period: 20,
      stdDev: 2,
      values: closes
    });
    const atr = technicalIndicators.ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 14
    });

    // Volume indicators
    const obv = technicalIndicators.OBV.calculate({
      close: closes,
      volume: volumes
    });
    const mfi = technicalIndicators.MFI.calculate({
      high: highs,
      low: lows,
      close: closes,
      volume: volumes,
      period: 14
    });

    // Custom indicators
    const trendStrength = this.calculateTrendStrength(closes, sma20);
    const volumeProfile = this.calculateVolumeProfile(volumes);
    const priceVolCorr = this.calculatePriceVolumeCorrelation(closes, volumes);

    return this.combineIndicators(
      sma20, ema9, ema21, rsi, macd, bb, atr, obv, mfi,
      trendStrength, volumeProfile, priceVolCorr
    );
  }

  private static calculateTrendStrength(closes: number[], sma: number[]): number[] {
    // Calculate trend strength using price action and moving average
    return closes.map((close, i) => {
      if (i < 20) return 0;
      const slope = (sma[i] - sma[i-20]) / sma[i-20];
      const deviation = Math.abs(close - sma[i]) / sma[i];
      return slope * (1 + deviation);
    });
  }

  // ...additional indicator methods...
}
