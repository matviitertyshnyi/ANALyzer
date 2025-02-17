import { MarketData } from './types';

export interface SimulationResult {
  paths: number[][];
  statistics: {
    mean: number;
    median: number;
    worstCase: number;
    bestCase: number;
    confidence95: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
}

export class MonteCarloSimulator {
  constructor(private historicalData: MarketData[]) {}

  public simulate(
    initialBalance: number = 1000,
    numPaths: number = 1000,
    numDays: number = 365,
    params = {
      winRate: 0.55,
      avgWin: 0.02,
      avgLoss: 0.01,
      tradesPerDay: 3
    }
  ): SimulationResult {
    const paths: number[][] = [];
    const { winRate, avgWin, avgLoss, tradesPerDay } = params;

    for (let path = 0; path < numPaths; path++) {
      const equity = [initialBalance];
      let balance = initialBalance;
      let maxBalance = balance;
      
      for (let day = 0; day < numDays; day++) {
        for (let trade = 0; trade < tradesPerDay; trade++) {
          const isWin = Math.random() < winRate;
          const return_ = isWin ? avgWin : -avgLoss;
          balance *= (1 + return_);
          maxBalance = Math.max(maxBalance, balance);
        }
        equity.push(balance);
      }
      paths.push(equity);
    }

    return {
      paths,
      statistics: this.calculateStatistics(paths)
    };
  }

  private calculateStatistics(paths: number[][]): SimulationResult['statistics'] {
    const finalBalances = paths.map(path => path[path.length - 1]);
    const sortedBalances = [...finalBalances].sort((a, b) => a - b);
    const returns = this.calculateReturns(paths);

    return {
      mean: finalBalances.reduce((a, b) => a + b) / finalBalances.length,
      median: sortedBalances[Math.floor(sortedBalances.length / 2)],
      worstCase: sortedBalances[0],
      bestCase: sortedBalances[sortedBalances.length - 1],
      confidence95: sortedBalances[Math.floor(sortedBalances.length * 0.05)],
      maxDrawdown: this.calculateMaxDrawdown(paths),
      sharpeRatio: this.calculateSharpeRatio(returns)
    };
  }

  private calculateReturns(paths: number[][]): number[] {
    return paths.map(path => {
      const finalReturn = (path[path.length - 1] - path[0]) / path[0];
      return finalReturn;
    });
  }

  private calculateMaxDrawdown(paths: number[][]): number {
    const drawdowns = paths.map(path => {
      let maxDrawdown = 0;
      let peak = path[0];

      for (const value of path) {
        if (value > peak) {
          peak = value;
        }
        const drawdown = (peak - value) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }

      return maxDrawdown;
    });

    return Math.max(...drawdowns);
  }

  private calculateSharpeRatio(returns: number[]): number {
    const mean = returns.reduce((a, b) => a + b) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const riskFreeRate = 0.02; // Assuming 2% risk-free rate

    return stdDev === 0 ? 0 : (mean - riskFreeRate) / stdDev;
  }
}
