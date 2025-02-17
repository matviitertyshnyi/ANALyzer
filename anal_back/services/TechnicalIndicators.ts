export class TechnicalIndicators {
  static calculateIndicators(candles: any[]) {
    return candles.map((candle, index) => {
      const window = candles.slice(0, index + 1);
      return {
        ...candle,
        rsi: this.calculateRSI(window),
        ...this.calculateMACD(window),
        ...this.calculateBollingerBands(window),
        atr: this.calculateATR(window),
        obv: this.calculateOBV(window),
        momentum: this.calculateMomentum(window),
        volatility: this.calculateVolatility(window)
      };
    });
  }

  private static calculateRSI(data: any[], period: number = 14): number {
    if (data.length < period + 1) return 50;

    const changes = data.map((value, index) => {
      if (index === 0) return 0;
      return value.close - data[index - 1].close;
    });

    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? -change : 0);

    // Calculate average gain and loss
    const avgGain = gains.slice(-period).reduce((a, b) => a + b) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b) / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private static calculateMACD(data: any[]): { macd: number; signal: number; histogram: number } {
    if (data.length < 26) return { macd: 0, signal: 0, histogram: 0 };

    const closes = data.map(d => d.close);
    const fastEMA = this.calculateEMA(closes, 12);
    const slowEMA = this.calculateEMA(closes, 26);
    const macdLine = fastEMA - slowEMA;
    const signalLine = this.calculateEMA([macdLine], 9);
    const histogram = macdLine - signalLine;

    return { macd: macdLine, signal: signalLine, histogram };
  }

  private static calculateBollingerBands(data: any[], period: number = 20, stdDev: number = 2) {
    if (data.length < period) {
      return { upper: data[data.length - 1].close, middle: data[data.length - 1].close, lower: data[data.length - 1].close };
    }

    const closes = data.map(d => d.close);
    const sma = this.calculateSMA(closes.slice(-period));
    const standardDeviation = this.calculateStandardDeviation(closes.slice(-period));

    return {
      upper: sma + (standardDeviation * stdDev),
      middle: sma,
      lower: sma - (standardDeviation * stdDev)
    };
  }

  private static calculateATR(data: any[], period: number = 14): number {
    if (data.length < 2) return 0;

    const trs = data.slice(1).map((candle, i) => {
      const prev = data[i];
      return Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - prev.close),
        Math.abs(candle.low - prev.close)
      );
    });

    return this.calculateSMA(trs.slice(-period));
  }

  private static calculateOBV(data: any[]): number {
    return data.reduce((obv, candle, i) => {
      if (i === 0) return candle.volume;
      const prevClose = data[i - 1].close;
      if (candle.close > prevClose) return obv + candle.volume;
      if (candle.close < prevClose) return obv - candle.volume;
      return obv;
    }, 0);
  }

  private static calculateMomentum(data: any[], period: number = 10): number {
    if (data.length < period) return 0;
    const currentClose = data[data.length - 1].close;
    const pastClose = data[data.length - period].close;
    return ((currentClose - pastClose) / pastClose) * 100;
  }

  private static calculateVolatility(data: any[], period: number = 20): number {
    if (data.length < period) return 0;

    const returns = data.slice(-period).map((d, i, arr) => {
      if (i === 0) return 0;
      return Math.log(d.close / arr[i - 1].close);
    });

    const mean = returns.reduce((sum, val) => sum + val, 0) / returns.length;
    const variance = returns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / returns.length;
    return Math.sqrt(variance * 252); // Annualized volatility
  }

  private static calculateEMA(data: number[], period: number): number {
    const multiplier = 2 / (period + 1);
    let ema = data[0];
    
    for (let i = 1; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  private static calculateSMA(data: number[]): number {
    return data.reduce((sum, val) => sum + val, 0) / data.length;
  }

  private static calculateStandardDeviation(data: number[]): number {
    const mean = this.calculateSMA(data);
    const squaredDiffs = data.map(val => Math.pow(val - mean, 2));
    return Math.sqrt(this.calculateSMA(squaredDiffs));
  }
}
