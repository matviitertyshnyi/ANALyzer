import { Trade, Position, MarketData } from '../types';

export class RiskManager {
  constructor(private config: {
    maxDrawdown: number;
    maxLeverage: number;
    maxPositions: number;
    maxRiskPerTrade: number;
  }) {}

  public validateTrade(trade: Partial<Trade>, currentPositions: Position[], balance: number, volatility: number) {
    if (currentPositions.length >= this.config.maxPositions) {
      return { allowed: false, reason: 'Maximum positions reached' };
    }

    const maxLeverage = this.calculateMaxLeverage(volatility);
    if ((trade.leverage || 0) > maxLeverage) {
      return { 
        allowed: false, 
        reason: `Leverage too high for current volatility. Max: ${maxLeverage}x` 
      };
    }

    return { allowed: true };
  }

  public adjustPositionSize(intendedSize: number, balance: number, volatility: number): number {
    const volatilityFactor = 1 - Math.min(volatility / 100, 0.5);
    const maxSize = balance * (this.config.maxRiskPerTrade / 100) * volatilityFactor;
    return Math.min(intendedSize, maxSize);
  }

  private calculateMaxLeverage(volatility: number): number {
    return Math.max(1, this.config.maxLeverage - Math.floor(volatility * 2));
  }
}
