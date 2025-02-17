import { MarketData, Position, MarketRegimeState, PortfolioRiskMetrics } from '../types';
import { RiskMetrics } from '../risk/RiskMetrics';
import { MarketRegime } from '../analytics/MarketRegime';

export class PositionOptimizer {
  private readonly MAX_LEVERAGE = 20;
  private readonly MIN_CONFIDENCE = 0.6;
  private readonly VOLATILITY_IMPACT = 0.7;

  constructor(
    private riskMetrics: RiskMetrics,
    private marketRegime: MarketRegime
  ) {}

  public calculateOptimalSize(
    balance: number,
    marketData: MarketData[],
    currentPositions: Position[],
    volatility: number
  ): {
    size: number;
    leverage: number;
    confidence: number;
  } {
    const regime = this.marketRegime.detectRegime(marketData);
    const portfolioRisk = this.riskMetrics.calculatePortfolioRisk(currentPositions, balance);
    
    const baseSize = this.calculateBaseSize(balance, regime.trend);
    const adjustedSize = this.adjustForVolatility(baseSize, volatility);
    const finalSize = this.adjustForPortfolioRisk(adjustedSize, portfolioRisk.riskPercentage);
    
    return {
      size: finalSize,
      leverage: this.calculateOptimalLeverage(regime.trend, volatility),
      confidence: this.calculateConfidence(regime.trend, volatility)
    };
  }

  private calculateBaseSize(balance: number, trend: MarketRegimeState['trend']): number {
    const baseSizePercentage = {
      bullish: 0.1,    // 10% of balance in bullish markets
      bearish: 0.05,   // 5% in bearish markets
      sideways: 0.03   // 3% in sideways markets
    }[trend] || 0.05;  // default to 5%

    return balance * baseSizePercentage;
  }

  private adjustForVolatility(baseSize: number, volatility: number): number {
    // Reduce position size as volatility increases
    const volatilityFactor = Math.max(0.2, 1 - (volatility * this.VOLATILITY_IMPACT));
    return baseSize * volatilityFactor;
  }

  private adjustForPortfolioRisk(size: number, currentRisk: number): number {
    // Reduce size if portfolio risk is too high
    const maxRisk = 0.15; // 15% max portfolio risk
    const riskAdjustment = Math.max(0, 1 - (currentRisk / maxRisk));
    return size * riskAdjustment;
  }

  private calculateOptimalLeverage(trend: MarketRegimeState['trend'], volatility: number): number {
    const baseMultiplier = {
      bullish: 1.0,
      bearish: 0.7,
      sideways: 0.5
    }[trend] || 0.7;

    // Reduce leverage in high volatility conditions
    const volatilityAdjustment = Math.max(0.3, 1 - volatility);
    const leverage = Math.floor(this.MAX_LEVERAGE * baseMultiplier * volatilityAdjustment);

    return Math.min(leverage, this.MAX_LEVERAGE);
  }

  private calculateConfidence(trend: MarketRegimeState['trend'], volatility: number): number {
    const baseConfidence = {
      bullish: 0.8,
      bearish: 0.6,
      sideways: 0.4
    }[trend] || 0.6;

    // Reduce confidence in high volatility
    return Math.max(
      this.MIN_CONFIDENCE,
      baseConfidence * (1 - volatility * 0.5)
    );
  }
}
