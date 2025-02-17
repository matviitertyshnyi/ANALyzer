import { Trade, MarketData } from '../types';
import { EventEmitter } from 'events';

export class PerformanceMonitor extends EventEmitter {
  private trades: Trade[] = [];
  private metrics: {
    winRate: number;
    profitFactor: number;
    drawdown: number;
    sharpeRatio: number;
    dailyPnL: number[];
  };
  private lastUpdate: number = Date.now();
  private updateInterval: number = 5000; // 5 seconds

  constructor() {
    super();
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics() {
    return {
      winRate: 0,
      profitFactor: 0,
      drawdown: 0,
      sharpeRatio: 0,
      dailyPnL: []
    };
  }

  public addTrade(trade: Trade) {
    this.trades.push(trade);
    this.updateMetrics();
  }

  private updateMetrics() {
    if (Date.now() - this.lastUpdate < this.updateInterval) return;

    const winningTrades = this.trades.filter(t => t.profit > 0);
    const losingTrades = this.trades.filter(t => t.profit < 0);

    // Calculate core metrics
    const winRate = (winningTrades.length / this.trades.length) * 100;
    const totalProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));
    const profitFactor = totalLoss === 0 ? totalProfit : totalProfit / totalLoss;

    // Calculate drawdown
    let peak = 0;
    let currentDrawdown = 0;
    let maxDrawdown = 0;
    let runningBalance = 1000;

    this.trades.forEach(trade => {
      runningBalance += trade.profit;
      if (runningBalance > peak) {
        peak = runningBalance;
        currentDrawdown = 0;
      } else {
        currentDrawdown = (peak - runningBalance) / peak * 100;
        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
        }
      }
    });

    // Calculate Sharpe Ratio
    const returns = this.calculateDailyReturns();
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length
    );
    const sharpeRatio = stdDev === 0 ? 0 : (avgReturn / stdDev) * Math.sqrt(365);

    this.metrics = {
      winRate,
      profitFactor,
      drawdown: maxDrawdown,
      sharpeRatio,
      dailyPnL: this.calculateDailyPnL()
    };

    this.lastUpdate = Date.now();
    this.emit('metricsUpdated', this.metrics);
  }

  private calculateDailyReturns(): number[] {
    const dailyPnL = this.calculateDailyPnL();
    let balance = 1000;
    return dailyPnL.map(pnl => {
      const return_ = pnl / balance;
      balance += pnl;
      return return_;
    });
  }

  private calculateDailyPnL(): number[] {
    const dailyPnL: { [key: string]: number } = {};
    
    this.trades.forEach(trade => {
      const date = new Date(trade.timestamp).toISOString().split('T')[0];
      dailyPnL[date] = (dailyPnL[date] || 0) + trade.profit;
    });

    return Object.values(dailyPnL);
  }

  public getMetrics() {
    return this.metrics;
  }
}
