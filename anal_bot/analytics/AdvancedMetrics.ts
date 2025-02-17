import { Trade, MarketData } from '../types';

export class AdvancedMetrics {
  public calculateMetrics(trades: Trade[], data: MarketData[]) {
    return {
      basic: this.calculateBasicMetrics(trades),
      risk: this.calculateRiskMetrics(trades),
      advanced: this.calculateAdvancedMetrics(trades, data)
    };
  }

  private calculateBasicMetrics(trades: Trade[]) {
    const winningTrades = trades.filter(t => t.profit > 0);
    const losingTrades = trades.filter(t => t.profit < 0);
    
    return {
      totalTrades: trades.length,
      winRate: (winningTrades.length / trades.length) * 100,
      avgWin: winningTrades.reduce((sum, t) => sum + t.profit, 0) / winningTrades.length,
      avgLoss: Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0) / losingTrades.length),
      largestWin: Math.max(...winningTrades.map(t => t.profit)),
      largestLoss: Math.min(...losingTrades.map(t => t.profit))
    };
  }

  private calculateRiskMetrics(trades: Trade[]) {
    const returns = this.calculateDailyReturns(trades);
    return {
      sharpeRatio: this.calculateSharpeRatio(returns),
      maxDrawdown: this.calculateMaxDrawdown(trades),
      profitFactor: this.calculateProfitFactor(trades)
    };
  }

  private calculateAdvancedMetrics(trades: Trade[], data: MarketData[]) {
    // Implementation for advanced metrics
    return {};
  }

  private calculateDailyReturns(trades: Trade[]): number[] {
    const dailyReturns: number[] = [];
    let previousBalance = 1000; // Initial balance

    trades.forEach(trade => {
      const newBalance = previousBalance + trade.profit;
      const dailyReturn = (newBalance - previousBalance) / previousBalance;
      dailyReturns.push(dailyReturn);
      previousBalance = newBalance;
    });

    return dailyReturns;
  }

  private calculateSharpeRatio(returns: number[]): number {
    const meanReturn = this.calculateMean(returns);
    const stdDev = this.calculateStdDev(returns);
    const riskFreeRate = 0.02; // Assuming 2% risk-free rate

    return (meanReturn - riskFreeRate) / stdDev;
  }

  private calculateMaxDrawdown(trades: Trade[]): number {
    let peak = 0;
    let maxDrawdown = 0;
    let balance = 1000; // Initial balance

    trades.forEach(trade => {
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

  private calculateProfitFactor(trades: Trade[]): number {
    const winningTrades = trades.filter(t => t.profit > 0);
    const losingTrades = trades.filter(t => t.profit < 0);

    const totalProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));

    return totalProfit / totalLoss;
  }

  private calculateMean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculateStdDev(values: number[]): number {
    const mean = this.calculateMean(values);
    return Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
  }
}
