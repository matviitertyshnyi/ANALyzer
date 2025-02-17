import { ML_CONFIG } from '../config/mlConfig.js';
import { RawDataPoint } from '../interfaces/DataTypes.js';

interface MarketConditions {
  volatility: number;
  trend: number;
  volume: number;
  liquidity: number;
}

export class RiskAdjuster {
  private historicalConditions: MarketConditions[] = [];
  private baselineRisk: number = ML_CONFIG.TRADING.RISK_CONTROLS.MIN_CONFIDENCE;
  
  adjustRisk(
    confidence: number,
    currentMarket: MarketConditions,
    recentCandles: RawDataPoint[]
  ): number {
    // Update market conditions history
    this.updateMarketHistory(currentMarket);
    
    // Calculate dynamic adjustments
    const volatilityFactor = this.getVolatilityAdjustment(currentMarket.volatility);
    const trendFactor = this.getTrendAdjustment(currentMarket.trend);
    const volumeFactor = this.getVolumeAdjustment(currentMarket.volume);
    const liquidityFactor = this.getLiquidityAdjustment(currentMarket.liquidity);
    
    // Calculate market regime score (0-1)
    const marketRegime = this.detectMarketRegime(recentCandles);
    
    // Adjust base confidence
    let adjustedConfidence = confidence * (
      volatilityFactor * 0.3 +
      trendFactor * 0.3 +
      volumeFactor * 0.2 +
      liquidityFactor * 0.2
    );

    // Apply market regime modifier
    adjustedConfidence *= (0.5 + marketRegime);

    // Log adjustments
    console.log('Risk Adjustments:', {
      original: confidence.toFixed(2),
      volatility: volatilityFactor.toFixed(2),
      trend: trendFactor.toFixed(2),
      volume: volumeFactor.toFixed(2),
      liquidity: liquidityFactor.toFixed(2),
      regime: marketRegime.toFixed(2),
      final: adjustedConfidence.toFixed(2)
    });

    return adjustedConfidence;
  }

  private detectMarketRegime(candles: RawDataPoint[]): number {
    if (candles.length < 20) return 0.5;

    // Calculate market characteristics
    const volatility = this.calculateVolatility(candles);
    const trendStrength = this.calculateTrendStrength(candles);
    const volumeConsistency = this.calculateVolumeConsistency(candles);

    // Determine regime score (0-1)
    // Higher scores indicate more favorable trading conditions
    const regimeScore = (
      this.normalizeVolatility(volatility) * 0.4 +
      trendStrength * 0.4 +
      volumeConsistency * 0.2
    );

    return Math.max(0.1, Math.min(regimeScore, 1));
  }

  private calculateVolatility(candles: RawDataPoint[]): number {
    const returns = candles.slice(1).map((candle, i) => 
      Math.log(candle.close / candles[i].close)
    );
    return Math.sqrt(returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length);
  }

  private normalizeVolatility(volatility: number): number {
    // Convert volatility to 0-1 score where 0.5 is ideal
    const idealVolatility = 0.02; // 2% daily volatility as ideal
    const diff = Math.abs(volatility - idealVolatility);
    return Math.max(0, 1 - (diff / idealVolatility));
  }

  private calculateTrendStrength(candles: RawDataPoint[]): number {
    const prices = candles.map(c => c.close);
    const sma20 = this.calculateSMA(prices, 20);
    const sma50 = this.calculateSMA(prices, 50);
    
    // Trend alignment score
    return Math.min(1, Math.abs(sma20 - sma50) / sma50);
  }

  private calculateVolumeConsistency(candles: RawDataPoint[]): number {
    const volumes = candles.map(c => c.volume);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const volumeVariance = volumes.reduce((sum, vol) => 
      sum + Math.pow(vol - avgVolume, 2), 0
    ) / volumes.length;
    
    return 1 / (1 + Math.sqrt(volumeVariance) / avgVolume);
  }

  private calculateSMA(values: number[], period: number): number {
    return values.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  private getVolatilityAdjustment(volatility: number): number {
    // Reduce risk in high volatility
    return Math.max(0.5, 1 - Math.pow(volatility, 2));
  }

  private getTrendAdjustment(trend: number): number {
    // Increase risk in strong trends
    return 0.5 + (trend * 0.5);
  }

  private getVolumeAdjustment(volume: number): number {
    // Adjust based on volume profile
    return Math.min(1, volume / this.getAverageVolume());
  }

  private getLiquidityAdjustment(liquidity: number): number {
    // Reduce risk in low liquidity
    return Math.max(0.5, liquidity);
  }

  private updateMarketHistory(conditions: MarketConditions): void {
    this.historicalConditions.push(conditions);
    if (this.historicalConditions.length > 100) {
      this.historicalConditions.shift();
    }
  }

  private getAverageVolume(): number {
    return this.historicalConditions.reduce((sum, condition) => 
      sum + condition.volume, 0
    ) / this.historicalConditions.length || 1;
  }
}
