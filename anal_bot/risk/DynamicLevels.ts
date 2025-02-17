import { MarketData } from '../types';

export class DynamicLevels {
  private readonly minStopDistance = 0.2;  // 0.2%
  private readonly maxStopDistance = 2.0;  // 2%
  private readonly maxTakeProfitRatio = 3; // 3:1 reward/risk ratio

  public calculateStopLoss(
    price: number,
    type: 'LONG' | 'SHORT',
    atr: number,
    volatility: number
  ): number {
    // Dynamic stop based on volatility and ATR
    const atrStop = atr * 1.5;
    const volatilityStop = price * (volatility / 100);
    const stopDistance = Math.max(atrStop, volatilityStop);
    
    return type === 'LONG' 
      ? price * (1 - stopDistance)
      : price * (1 + stopDistance);
  }

  public calculateTakeProfit(
    price: number,
    type: 'LONG' | 'SHORT',
    stopDistance: number
  ): number {
    const profitDistance = stopDistance * this.maxTakeProfitRatio;
    
    return type === 'LONG'
      ? price * (1 + profitDistance)
      : price * (1 - profitDistance);
  }

  public updateTrailingStop(
    currentPrice: number,
    position: { type: 'LONG' | 'SHORT', entryPrice: number },
    currentStop: number,
    atr: number
  ): number {
    const minMove = atr * 0.5;
    
    if (position.type === 'LONG' && currentPrice > position.entryPrice) {
      return Math.max(currentStop, currentPrice - minMove);
    } else if (position.type === 'SHORT' && currentPrice < position.entryPrice) {
      return Math.min(currentStop, currentPrice + minMove);
    }
    
    return currentStop;
  }
}
