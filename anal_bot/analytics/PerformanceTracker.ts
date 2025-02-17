import { Trade, TradeMetrics } from '../types';

export class PerformanceTracker {
  private trades: Trade[] = [];

  public addTrade(trade: Trade) {
    this.trades.push(trade);
  }

  public getMetrics(): TradeMetrics {
    const winningTrades = this.trades.filter(t => t.profit > 0);
    const losingTrades = this.trades.filter(t => t.profit < 0);

    const winRate = (winningTrades.length / this.trades.length) * 100;
    const avgProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0) / winningTrades.length;
    const avgLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0) / losingTrades.length);
    const profitFactor = avgProfit / avgLoss;
    const maxDrawdown = this.getDrawdown();

    return {
      winRate,
      avgProfit,
      avgLoss,
      totalTrades: this.trades.length,
      profitFactor,
      maxDrawdown,
      sharpeRatio: this.calculateSharpeRatio(),
      maxConsecutiveLosses: this.calculateMaxConsecutiveLosses()
    };
  }

  private getDrawdown(): number {
    let peak = 0;
    let maxDrawdown = 0;
    let balance = 1000; // Initial balance

    this.trades.forEach(trade => {
      balance += trade.profit;
      if (balance > peak) {
        peak = balance;
      }
      const drawdown = (peak - balance) / peak * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    return maxDrawdown;
  }

  private calculateSharpeRatio(): number {
    const returns = this.trades.map(t => t.profit);
    const meanReturn = this.calculateMean(returns);
    const stdDev = this.calculateStdDev(returns);
    const riskFreeRate = 0.02; // Assuming 2% risk-free rate

    return (meanReturn - riskFreeRate) / stdDev;
  }

  private calculateMaxConsecutiveLosses(): number {
    let maxConsecutiveLosses = 0;
    let currentLosses = 0;

    this.trades.forEach(trade => {
      if (trade.profit < 0) {
        currentLosses++;
        if (currentLosses > maxConsecutiveLosses) {
          maxConsecutiveLosses = currentLosses;
        }
      } else {
        currentLosses = 0;
      }
    });

    return maxConsecutiveLosses;
  }

  private calculateMean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculateStdDev(values: number[]): number {
    const mean = this.calculateMean(values);
    return Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
  }
}
