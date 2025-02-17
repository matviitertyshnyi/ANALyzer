import { RawDataPoint, AnalysisResult } from '../interfaces/DataTypes.js';
import { RiskAdjuster } from '../services/RiskAdjuster.js';

interface PriceAnalysis {
  close: number;
  bodySize: number;
  range: number;
  bb?: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
  };
}

interface MomentumAnalysis {
  rsi: number;
  macd: {
    line: number;
    signal: number;
    histogram: number;
  };
  stoch: {
    k: number;
    d: number;
  };
}

interface TrendAnalysis {
  ema9: number;
  ema21: number;
  sma20: number;
  adx: number;
  trendStrength: number;
}

interface VolatilityAnalysis {
  atr: number;
  bbWidth: number;
  historicalVolatility: number;
}

interface VolumeAnalysis {
  volume: number;
  vwap: number;
  obv: number;
  volumeTrend: number;
}

export class TechnicalAnalyzer {
  private riskAdjuster: RiskAdjuster;
  private quietMode: boolean;

  constructor(private readonly data: RawDataPoint[], quietMode: boolean = false) {
    this.riskAdjuster = new RiskAdjuster();
    this.quietMode = quietMode;
  }

  private log(...args: any[]): void {
    if (!this.quietMode) {
      console.log(...args);
    }
  }

  analyzeCandle(index: number): AnalysisResult {
    try {
      const candle = this.data[index];
      const lookback = this.data.slice(Math.max(0, index - 100), index + 1);
      
      const analysis = {
        price: this.analyzePriceAction(candle, lookback),
        momentum: this.analyzeMomentum(lookback),
        trend: this.analyzeTrends(lookback),
        volatility: this.analyzeVolatility(lookback),
        volume: this.analyzeVolume(lookback)
      };

      // Enhanced analysis logging
      this.log('\n🔍 Technical Analysis Summary');
      this.log('───────────────────────────');
      this.log('Price Action:', {
        price: `$${analysis.price.close.toFixed(2)}`,
        bodySize: `${(analysis.price.bodySize / analysis.price.close * 100).toFixed(2)}%`,
        bbPosition: this.getBollingerPosition(analysis.price)
      });
      
      this.log('Momentum Signals:', {
        rsi: `${analysis.momentum.rsi.toFixed(1)} (${this.getRSISignal(analysis.momentum.rsi)})`,
        macd: `${analysis.momentum.macd.histogram.toFixed(3)} (${this.getMACDSignal(analysis.momentum.macd)})`,
        stoch: `K:${analysis.momentum.stoch.k.toFixed(1)} D:${analysis.momentum.stoch.d.toFixed(1)}`
      });

      this.log('Trend Analysis:', {
        direction: analysis.trend.trendStrength > 0.5 ? '⬈ UPTREND' : '⬊ DOWNTREND',
        strength: `${(analysis.trend.trendStrength * 100).toFixed(1)}%`,
        adx: `${analysis.trend.adx.toFixed(1)} (${this.getTrendStrength(analysis.trend.adx)})`
      });

      this.log('Volume Profile:', {
        trend: `${analysis.volume.volumeTrend.toFixed(2)}x avg`,
        vwap: `$${analysis.volume.vwap.toFixed(2)}`,
        activity: this.getVolumeActivity(analysis.volume)
      });

      return analysis;
    } catch (error) {
      console.error('❌ Analysis error:', error);
      throw error;
    }
  }

  private getBollingerPosition(price: PriceAnalysis): string {
    if (!price.bb) return 'N/A';
    const pos = (price.close - price.bb.lower) / (price.bb.upper - price.bb.lower);
    if (pos > 0.8) return 'OVERBOUGHT ▲';
    if (pos < 0.2) return 'OVERSOLD ▼';
    return 'NEUTRAL →';
  }

  private getRSISignal(rsi: number): string {
    if (rsi > 70) return 'OVERBOUGHT 🔴';
    if (rsi < 30) return 'OVERSOLD 🟢';
    return 'NEUTRAL ⚪';
  }

  private getMACDSignal(macd: { histogram: number }): string {
    if (macd.histogram > 0.2) return 'STRONG BUY ↑↑';
    if (macd.histogram > 0) return 'BUY ↑';
    if (macd.histogram < -0.2) return 'STRONG SELL ↓↓';
    if (macd.histogram < 0) return 'SELL ↓';
    return 'NEUTRAL →';
  }

  private getTrendStrength(adx: number): string {
    if (adx > 50) return 'VERY STRONG';
    if (adx > 25) return 'STRONG';
    if (adx > 20) return 'MODERATE';
    return 'WEAK';
  }

  private getVolumeActivity(volume: VolumeAnalysis): string {
    const ratio = volume.volumeTrend;
    if (ratio > 2) return 'VERY HIGH 📈';
    if (ratio > 1.5) return 'HIGH ↑';
    if (ratio < 0.5) return 'LOW ↓';
    return 'NORMAL →';
  }

  private analyzePriceAction(candle: RawDataPoint, lookback: RawDataPoint[]): PriceAnalysis {
    const bb = this.calculateBollingerBands(lookback);
    
    return {
      close: candle.close,
      bodySize: Math.abs(candle.close - candle.open),
      range: candle.high - candle.low,
      bb
    };
  }

  private analyzeMomentum(data: RawDataPoint[]): MomentumAnalysis {
    const closes = data.map(d => d.close);
    
    return {
      rsi: this.calculateRSI(closes),
      macd: this.calculateMACD(closes),
      stoch: this.calculateStochastic(data)
    };
  }

  private analyzeTrends(data: RawDataPoint[]): TrendAnalysis {
    try {
      if (!data || data.length < 14) {
        console.warn('Insufficient data for trend analysis:', data?.length);
        return {
          ema9: 0,
          ema21: 0,
          sma20: 0,
          adx: 0,
          trendStrength: 0
        };
      }

      const closes = data.map(d => d.close);
      const highs = data.map(d => d.high);
      const lows = data.map(d => d.low);

      // Debug log
      this.log('Trend Analysis Data:', {
        candles: data.length,
        closePrices: closes.length,
        highPrices: highs.length,
        lowPrices: lows.length
      });
      
      return {
        ema9: this.calculateEMA(closes, 9),
        ema21: this.calculateEMA(closes, 21),
        sma20: this.calculateSMA(closes, 20),
        adx: this.calculateADX(data),
        trendStrength: this.calculateTrendStrength(closes, highs, lows)
      };
    } catch (error) {
      console.error('Trend analysis error:', error);
      return {
        ema9: 0,
        ema21: 0,
        sma20: 0,
        adx: 0,
        trendStrength: 0
      };
    }
  }

  private calculateTrendStrength(closes: number[], highs: number[], lows: number[]): number {
    try {
      // Input validation
      if (!Array.isArray(closes) || !Array.isArray(highs) || !Array.isArray(lows)) {
        console.error('Invalid input arrays:', { closes, highs, lows });
        return 0;
      }

      if (closes.length < 2 || highs.length < 2 || lows.length < 2) {
        console.warn('Insufficient data points:', {
          closes: closes.length,
          highs: highs.length,
          lows: lows.length
        });
        return 0;
      }

      const period = Math.min(14, closes.length - 1);
      
      // Ensure arrays are aligned
      const slicedCloses = closes.slice(-period - 1);
      const slicedHighs = highs.slice(-period - 1);
      const slicedLows = lows.slice(-period - 1);

      // Calculate trend components
      const plusDM = slicedHighs.slice(1).map((high, i) => Math.max(high - slicedHighs[i], 0));
      const minusDM = slicedLows.slice(1).map((low, i) => Math.max(slicedLows[i] - low, 0));
      
      // Calculate ATR
      const trueRanges = slicedCloses.slice(1).map((close, i) => {
        const high = slicedHighs[i + 1];
        const low = slicedLows[i + 1];
        const prevClose = slicedCloses[i];
        
        return Math.max(
          high - low,
          Math.abs(high - prevClose),
          Math.abs(low - prevClose)
        );
      });
      
      const atr = this.calculateEMA(trueRanges, period);
      if (atr === 0) return 0;

      const plusDI = (plusDM.reduce((a, b) => a + b, 0) / period) / atr;
      const minusDI = (minusDM.reduce((a, b) => a + b, 0) / period) / atr;
      
      const denominator = plusDI + minusDI;
      if (denominator === 0) return 0;
      
      const strength = Math.abs(plusDI - minusDI) / denominator;

      // Debug log
      this.log('Trend Strength Calculation:', {
        period,
        atr: atr.toFixed(4),
        plusDI: plusDI.toFixed(4),
        minusDI: minusDI.toFixed(4),
        strength: strength.toFixed(4)
      });

      return strength;

    } catch (error) {
      console.error('Trend strength calculation error:', error);
      return 0;
    }
  }

  private analyzeVolatility(data: RawDataPoint[]): VolatilityAnalysis {
    return {
      atr: this.calculateATR(data),
      bbWidth: this.calculateBollingerBandWidth(data),
      historicalVolatility: this.calculateHistoricalVolatility(data.map(d => d.close))
    };
  }

  private analyzeVolume(data: RawDataPoint[]): VolumeAnalysis {
    const volumes = data.map(d => d.volume);
    const closes = data.map(d => d.close);
    
    return {
      volume: data[data.length - 1].volume,
      vwap: this.calculateVWAP(data),
      obv: this.calculateOBV(closes, volumes),
      volumeTrend: this.analyzeVolumeTrend(volumes)
    };
  }

  private calculateBollingerBands(data: RawDataPoint[]) {
    const period = 20;
    const stdDevMultiplier = 2;
    const closes = data.map(d => d.close);
    
    const sma = this.calculateSMA(closes, period);
    const squaredDiffs = closes.map(price => Math.pow(price - sma, 2));
    const stdDev = Math.sqrt(squaredDiffs.reduce((sum, diff) => sum + diff, 0) / period);
    
    return {
      middle: sma,
      upper: sma + (stdDev * stdDevMultiplier),
      lower: sma - (stdDev * stdDevMultiplier),
      bandwidth: (2 * stdDev) / sma
    };
  }

  private calculateATR(data: RawDataPoint[]): number {
    const period = 14;
    const trueRanges = data.map((candle, i) => {
      if (i === 0) return candle.high - candle.low;
      const prevClose = data[i-1].close;
      return Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - prevClose),
        Math.abs(candle.low - prevClose)
      );
    });
    return this.calculateEMA(trueRanges, period);
  }

  private calculateRSI(prices: number[]): number {
    const period = 14;
    const changes = prices.slice(1).map((price, i) => price - prices[i]);
    const gains = changes.map(c => c > 0 ? c : 0);
    const losses = changes.map(c => c < 0 ? -c : 0);
    
    const avgGain = gains.slice(-period).reduce((sum, g) => sum + g, 0) / period;
    const avgLoss = losses.slice(-period).reduce((sum, l) => sum + l, 0) / period;
    
    return avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
  }

  private calculateMACD(prices: number[]): { line: number; signal: number; histogram: number } {
    try {
      if (!prices || prices.length < 26) {
        return { line: 0, signal: 0, histogram: 0 };
      }

      // Calculate base EMAs
      const ema12 = this.calculateEMA(prices, 12);
      const ema26 = this.calculateEMA(prices, 26);

      // Raw MACD line
      const rawMacdLine = ema12 - ema26;

      // Calculate historical MACD values for normalization and signal line
      const macdHistory = [];
      for (let i = Math.max(0, prices.length - 50); i < prices.length; i++) {
        const slice = prices.slice(0, i + 1);
        const shortEMA = this.calculateEMA(slice, 12);
        const longEMA = this.calculateEMA(slice, 26);
        macdHistory.push(shortEMA - longEMA);
      }

      // Calculate min/max for normalization
      const maxMACD = Math.max(...macdHistory);
      const minMACD = Math.min(...macdHistory);
      const macdRange = maxMACD - minMACD;

      // Normalize MACD line to [-1, 1] range for confidence
      const normalizedMacdLine = macdRange !== 0 ? 
        (2 * ((rawMacdLine - minMACD) / macdRange) - 1) : 0;

      // Calculate signal line and histogram
      const normalizedHistory = macdHistory.map(m => 
        macdRange !== 0 ? (2 * ((m - minMACD) / macdRange) - 1) : 0
      );
      const signalLine = this.calculateEMA(normalizedHistory, 9);
      const histogram = normalizedMacdLine - signalLine;

      // Enhanced MACD logging
      this.log('\n📊 MACD Analysis');
      this.log('────────────────');
      this.log({
        signal: `${normalizedMacdLine > 0 ? '🟢 BULLISH' : '🔴 BEARISH'}`,
        strength: `${(Math.abs(normalizedMacdLine) * 100).toFixed(1)}%`,
        trend: this.getMACDTrend(normalizedMacdLine, signalLine),
        divergence: this.checkDivergence(prices, macdHistory)
      });

      return {
        line: normalizedMacdLine,    // Range: -1 to 1 (strong sell to strong buy)
        signal: signalLine,          // Range: -1 to 1 (trend confirmation)
        histogram: histogram         // Range: -2 to 2 (momentum strength)
      };

    } catch (error) {
      console.error('❌ MACD calculation error:', error);
      return { line: 0, signal: 0, histogram: 0 };
    }
  }

  private getMACDTrend(macd: number, signal: number): string {
    if (macd > signal && macd > 0) return 'STRONG UPTREND ↑↑';
    if (macd > signal) return 'WEAK UPTREND ↗';
    if (macd < signal && macd < 0) return 'STRONG DOWNTREND ↓↓';
    if (macd < signal) return 'WEAK DOWNTREND ↘';
    return 'NEUTRAL →';
  }

  private checkDivergence(prices: number[], macdHistory: number[]): string {
    // Simple divergence check
    const priceChange = (prices[prices.length - 1] - prices[prices.length - 5]) / prices[prices.length - 5];
    const macdChange = macdHistory[macdHistory.length - 1] - macdHistory[macdHistory.length - 5];
    
    if (priceChange > 0 && macdChange < 0) return 'BEARISH DIVERGENCE ⚠️';
    if (priceChange < 0 && macdChange > 0) return 'BULLISH DIVERGENCE 💫';
    return 'NO DIVERGENCE';
  }

  private calculateBasicEMA(prices: number[], period: number): number {
    if (!prices.length || prices.length < period) {
      return 0;
    }

    // First value is SMA
    let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
    
    // Calculate multiplier
    const multiplier = 2 / (period + 1);

    // Calculate EMA
    for (let i = period; i < prices.length; i++) {
      if (typeof prices[i] !== 'number' || isNaN(prices[i])) {
        console.error('Invalid price:', prices[i]);
        continue;
      }
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  private calculateSimpleEMA(prices: number[], period: number): number {
    if (!prices.length) return 0;
    if (prices.length === 1) return prices[0];
    if (prices.length < period) return prices[prices.length - 1];

    // Start with SMA
    const sma = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
    if (prices.length === period) return sma;

    // Calculate multiplier once
    const multiplier = 2 / (period + 1);

    // Calculate EMA
    let ema = sma;
    for (let i = period; i < prices.length; i++) {
      const price = prices[i];
      if (typeof price !== 'number' || isNaN(price)) {
        console.error('Invalid price in EMA calculation:', price);
        continue;
      }
      ema = (price * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  private calculateEMAHistory(prices: number[], period: number): number[] {
    const emaValues: number[] = [];
    const multiplier = 2 / (period + 1);

    // Initialize EMA with SMA
    let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
    emaValues.push(ema);

    // Calculate EMA for each price point
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
      emaValues.push(ema);
    }

    return emaValues;
  }

  private calculateEMA(prices: number[], period: number): number {
    const multiplier = 2 / (period + 1);
    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  private calculateNormalizedEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    if (prices.length === 1) return prices[0];

    // Use SMA for initial value
    const smaRange = Math.min(prices.length, period);
    let ema = prices.slice(0, smaRange).reduce((a, b) => a + b) / smaRange;
    
    // Standard EMA calculation with proper smoothing
    const alpha = 2 / (period + 1);
    for (let i = smaRange; i < prices.length; i++) {
      ema = (prices[i] * alpha) + (ema * (1 - alpha));
    }

    return ema;
  }

  private calculateEMASequence(prices: number[], period: number): number[] {
    // Start with SMA as first EMA value
    const sma = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
    const emaValues = [sma];
    const multiplier = 2 / (period + 1);

    // Calculate EMA sequence using proper formula
    for (let i = period; i < prices.length; i++) {
      const currentPrice = prices[i];
      const previousEMA = emaValues[emaValues.length - 1];
      const currentEMA = (currentPrice * multiplier) + (previousEMA * (1 - multiplier));
      emaValues.push(currentEMA);
    }

    return emaValues;
  }

  private calculateStochastic(data: RawDataPoint[]): { k: number; d: number } {
    const period = 14;
    const window = data.slice(-period);
    
    const currentClose = data[data.length - 1].close;
    const lowestLow = Math.min(...window.map(c => c.low));
    const highestHigh = Math.max(...window.map(c => c.high));
    
    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    const d = this.calculateSMA([k], 3);
    
    return { k, d };
  }

  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  private calculateADX(data: RawDataPoint[]): number {
    const period = 14;
    const smoothingPeriod = 14;
    const trueRanges: number[] = [];
    const plusDMs: number[] = [];
    const minusDMs: number[] = [];
    
    // Calculate DM and TR for each period
    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevHigh = data[i-1].high;
      const prevLow = data[i-1].low;
      
      // True Range
      const tr = Math.max(
        high - low,
        Math.abs(high - data[i-1].close),
        Math.abs(low - data[i-1].close)
      );
      trueRanges.push(tr);
      
      // Directional Movement
      const upMove = high - prevHigh;
      const downMove = prevLow - low;
      
      if (upMove > downMove && upMove > 0) {
        plusDMs.push(upMove);
        minusDMs.push(0);
      } else if (downMove > upMove && downMove > 0) {
        plusDMs.push(0);
        minusDMs.push(downMove);
      } else {
        plusDMs.push(0);
        minusDMs.push(0);
      }
    }
    
    // Smooth the indicators
    const atr = this.calculateEMA(trueRanges, period);
    const plusDI = (this.calculateEMA(plusDMs, period) / atr) * 100;
    const minusDI = (this.calculateEMA(minusDMs, period) / atr) * 100;
    
    // Calculate DX
    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
    
    // Final ADX is smoothed DX
    return this.calculateEMA([dx], smoothingPeriod);
  }

  private calculateBollingerBandWidth(data: RawDataPoint[]): number {
    const bb = this.calculateBollingerBands(data);
    return (bb.upper - bb.lower) / bb.middle;
  }

  private calculateHistoricalVolatility(prices: number[]): number {
    const returns = prices.slice(1).map((price, i) => 
      Math.log(price / prices[i])
    );
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => 
      sum + Math.pow(r - mean, 2), 0
    ) / returns.length;
    
    return Math.sqrt(variance * 252); // Annualized
  }

  private calculateVWAP(data: RawDataPoint[]): number {
    let totalVolume = 0;
    let totalPriceVolume = 0;
    
    data.forEach(candle => {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      totalPriceVolume += typicalPrice * candle.volume;
      totalVolume += candle.volume;
    });
    
    return totalVolume === 0 ? 0 : totalPriceVolume / totalVolume;
  }

  private calculateOBV(closes: number[], volumes: number[]): number {
    let obv = 0;
    
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i-1]) {
        obv += volumes[i];
      } else if (closes[i] < closes[i-1]) {
        obv -= volumes[i];
      }
    }
    
    return obv;
  }

  private analyzeVolumeTrend(volumes: number[]): number {
    const shortEMA = this.calculateEMA(volumes, 5);
    const longEMA = this.calculateEMA(volumes, 20);
    return shortEMA / longEMA;
  }

  private calculateConfidenceScore(analysis: any): { confidence: number; direction: 'LONG' | 'SHORT' | 'NEUTRAL' } {
    // Get base confidence from existing calculations
    const baseConfidence = this.calculateBaseConfidence(analysis);

    // Get current market conditions
    const conditions = {
      volatility: analysis.volatility.historicalVolatility,
      trend: analysis.trend.trendStrength,
      volume: analysis.volume.volumeTrend,
      liquidity: this.calculateLiquidity(this.data.slice(-20))
    };

    // Apply risk adjustment
    const adjustedConfidence = this.riskAdjuster.adjustRisk(
      baseConfidence.confidence,
      conditions,
      this.data.slice(-50)
    );

    return {
      confidence: adjustedConfidence,
      direction: baseConfidence.direction
    };
  }

  private calculateLiquidity(recentCandles: RawDataPoint[]): number {
    const avgVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0) / recentCandles.length;
    const spreadEstimate = recentCandles.reduce((sum, c) => 
      sum + (c.high - c.low) / c.close, 0
    ) / recentCandles.length;

    return 1 / (1 + spreadEstimate * 100) * Math.min(1, avgVolume / 1000);
  }

  private calculateBaseConfidence(analysis: {
    price: PriceAnalysis;
    momentum: MomentumAnalysis;
    trend: TrendAnalysis;
    volatility: VolatilityAnalysis;
    volume: VolumeAnalysis;
  }): { confidence: number; direction: 'LONG' | 'SHORT' | 'NEUTRAL' } {
    // 1. Trend Component (30%)
    const trendScore = this.getTrendConfidence({
      ema9: analysis.trend.ema9,
      ema21: analysis.trend.ema21,
      adx: analysis.trend.adx,
      trendStrength: analysis.trend.trendStrength
    });

    // 2. Momentum Component (30%)
    const momentumScore = this.getMomentumConfidence({
      rsi: analysis.momentum.rsi,
      macd: analysis.momentum.macd,
      stoch: analysis.momentum.stoch
    });

    // 3. Volume Component (20%)
    const volumeScore = this.getVolumeConfidence({
      volumeTrend: analysis.volume.volumeTrend,
      obv: analysis.volume.obv,
      vwap: analysis.volume.vwap
    });

    // 4. Volatility Component (20%)
    const volatilityScore = this.getVolatilityConfidence({
      atr: analysis.volatility.atr,
      bbWidth: analysis.volatility.bbWidth,
      historicalVolatility: analysis.volatility.historicalVolatility
    });

    // Calculate weighted average
    const confidence = (
      (trendScore.value * 0.30) +
      (momentumScore.value * 0.30) +
      (volumeScore.value * 0.20) +
      (volatilityScore.value * 0.20)
    );

    // Determine direction based on component scores
    const direction = this.determineDirection(trendScore, momentumScore);

    // Log component scores
    this.log('Confidence Components:', {
      trend: (trendScore.value * 100).toFixed(2) + '%',
      momentum: (momentumScore.value * 100).toFixed(2) + '%',
      volume: (volumeScore.value * 100).toFixed(2) + '%',
      volatility: (volatilityScore.value * 100).toFixed(2) + '%',
      final: (confidence * 100).toFixed(2) + '%',
      direction
    });

    return { confidence, direction };
  }

  private getTrendConfidence(trend: { ema9: number; ema21: number; adx: number; trendStrength: number }) {
    const emaAlignment = trend.ema9 > trend.ema21 ? 1 : -1;
    const trendStrength = Math.min(trend.trendStrength, 1);
    const adxStrength = trend.adx / 100;

    const value = (trendStrength + adxStrength) / 2;
    const direction = emaAlignment > 0 ? 'LONG' : 'SHORT';

    return { value, direction };
  }

  private getMomentumConfidence(momentum: { rsi: number; macd: any; stoch: any }) {
    // RSI component (0-1)
    const rsiScore = Math.abs((momentum.rsi - 50) / 50);
    const rsiDirection = momentum.rsi > 50 ? 'LONG' : 'SHORT';

    // MACD component (-1 to 1)
    const macdScore = Math.abs(momentum.macd.histogram);
    const macdDirection = momentum.macd.histogram > 0 ? 'LONG' : 'SHORT';

    // Stochastic component
    const stochScore = Math.abs((momentum.stoch.k - 50) / 50);
    const stochDirection = momentum.stoch.k > momentum.stoch.d ? 'LONG' : 'SHORT';

    // Combined score
    const value = (rsiScore + macdScore + stochScore) / 3;
    const direction = this.getMajorityDirection([
      { dir: rsiDirection, weight: 0.3 },
      { dir: macdDirection, weight: 0.4 },
      { dir: stochDirection, weight: 0.3 }
    ]);

    return { value, direction };
  }

  private getVolumeConfidence(volume: { volumeTrend: number; obv: number; vwap: number }) {
    const volumeTrendStrength = Math.min(Math.abs(volume.volumeTrend - 1), 1);
    const direction = volume.volumeTrend > 1 ? 'LONG' : 'SHORT';
    
    return { value: volumeTrendStrength, direction };
  }

  private getVolatilityConfidence(volatility: { atr: number; bbWidth: number; historicalVolatility: number }) {
    // Convert volatility metrics to confidence dampener
    const volConfidence = Math.max(0, 1 - (volatility.historicalVolatility * 10));
    return { value: volConfidence, direction: 'NEUTRAL' };
  }

  private getMajorityDirection(signals: { dir: 'LONG' | 'SHORT' | 'NEUTRAL'; weight: number }[]): 'LONG' | 'SHORT' | 'NEUTRAL' {
    const longWeight = signals.reduce((sum, s) => sum + (s.dir === 'LONG' ? s.weight : 0), 0);
    const shortWeight = signals.reduce((sum, s) => sum + (s.dir === 'SHORT' ? s.weight : 0), 0);
    
    if (Math.abs(longWeight - shortWeight) < 0.2) return 'NEUTRAL';
    return longWeight > shortWeight ? 'LONG' : 'SHORT';
  }

  private determineDirection(
    trendScore: { direction: string },
    momentumScore: { direction: string }
  ): 'LONG' | 'SHORT' | 'NEUTRAL' {
    if (trendScore.direction === momentumScore.direction) {
      return trendScore.direction as 'LONG' | 'SHORT';
    }
    return 'NEUTRAL';
  }
}
