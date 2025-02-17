import { MarketData, Trade } from '../types';
import { BaseStrategy } from '../strategies/BaseStrategy';

interface SimulationMetrics {
  winRate: number;
  maxDrawdown: number;
  expectedReturn: number;
  totalTrades: number;
  avgProfit: number;
  avgLoss: number;
  riskMetrics: {
    sharpeRatio: number;
    sortinoPatio: number;
    maxConsecutiveLosses: number;
  };
}

interface MetricResult {
  winRate: number;
  maxDrawdown: number;
  totalReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxConsecutiveLosses: number;
  trades: number;
  wins: number;
  profits: number[];
}

export class MonteCarloSimulator {
  private tradeIdCounter = 0;

  private generateTradeId(): string {
    return `sim_${Date.now()}_${this.tradeIdCounter++}`;
  }

  private static average(numbers: number[]): number {
    if (!numbers.length) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  public async simulateStrategy(
    strategy: BaseStrategy,
    historicalData: MarketData[],
    iterations: number = 1000,
    onProgress?: (progress: number) => void
  ): Promise<SimulationMetrics> {
    const results: Trade[][] = [];
    
    for (let i = 0; i < iterations; i++) {
      const trades = await this.runSimulation(strategy, this.shuffleData(historicalData));
      results.push(trades);
      onProgress?.((i + 1) / iterations);
    }

    const metrics = results.map(trades => this.calculateMetrics(trades));
    const allTrades = results.flat();
    const profits = allTrades.filter(t => t.profit > 0);
    const losses = allTrades.filter(t => t.profit < 0);

    return {
      winRate: allTrades.length > 0 ? (profits.length / allTrades.length) * 100 : 0,
      maxDrawdown: MonteCarloSimulator.average(metrics.map(m => m.maxDrawdown)),
      expectedReturn: MonteCarloSimulator.average(metrics.map(m => m.totalReturn)),
      totalTrades: allTrades.length,
      avgProfit: profits.length > 0 ? MonteCarloSimulator.average(profits.map(t => t.profit)) : 0,
      avgLoss: losses.length > 0 ? MonteCarloSimulator.average(losses.map(t => t.profit)) : 0,
      riskMetrics: {
        sharpeRatio: MonteCarloSimulator.average(metrics.map(m => m.sharpeRatio)),
        sortinoPatio: MonteCarloSimulator.average(metrics.map(m => m.sortinoRatio)),
        maxConsecutiveLosses: Math.max(...metrics.map(m => m.maxConsecutiveLosses))
      }
    };
  }

  private async runSimulation(
    strategy: BaseStrategy,
    data: MarketData[]
  ): Promise<Trade[]> {
    const trades: Trade[] = [];
    let balance = 1000;
    let lastPrice = data[0].close;

    // Reduced window size for more trading opportunities
    const windowSize = 14; // Changed from 26 to 14
    
    for (let i = windowSize; i < data.length; i++) {
      const candle = data[i];
      strategy.updateMarketData(candle);
      const decision = await strategy.makeDecision();
      
      // More aggressive trading conditions
      if (decision.action !== 'hold' && decision.amount && decision.leverage && balance >= 100) {
        const positionSize = Math.min(balance * 0.2, decision.amount); // Use up to 20% of balance
        const size = (positionSize * decision.leverage) / candle.close;
        
        trades.push({
          id: this.generateTradeId(),
          type: decision.action === 'buy' ? 'LONG' : 'SHORT',
          entryPrice: candle.close,
          size,
          leverage: decision.leverage,
          timestamp: new Date(candle.time ?? Date.now()),
          profit: 0,
          initialMargin: positionSize
        });
        
        balance -= positionSize;
      }

      // Close trades more aggressively
      this.checkAndCloseTrades(trades, candle.close, balance);
      lastPrice = candle.close;
    }

    return trades;
  }

  private checkAndCloseTrades(trades: Trade[], currentPrice: number, balance: number, forceClose: boolean = false) {
    for (let i = trades.length - 1; i >= 0; i--) {
      const trade = trades[i];
      if (!trade.exitPrice) {
        const pnl = trade.type === 'LONG'
          ? (currentPrice - trade.entryPrice) / trade.entryPrice
          : (trade.entryPrice - currentPrice) / trade.entryPrice;

        // Close positions more frequently
        if (forceClose || pnl >= 0.015 || pnl <= -0.01 || balance < 100) {
          trade.exitPrice = currentPrice;
          trade.profit = pnl * trade.size * trade.leverage * trade.entryPrice;
        }
      }
    }
  }

  private shuffleData(data: MarketData[]): MarketData[] {
    // Use block bootstrapping to preserve time series properties
    const blockSize = 20; // Size of each block
    const blocks: MarketData[][] = [];
    
    // Split data into blocks
    for (let i = 0; i < data.length - blockSize; i += blockSize) {
      blocks.push(data.slice(i, i + blockSize));
    }

    // Shuffle blocks
    for (let i = blocks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    }

    // Concatenate blocks
    return blocks.flat();
  }

  private calculateMetrics(trades: Trade[]): MetricResult {
    if (trades.length === 0) {
      return {
        winRate: 0,
        maxDrawdown: 0,
        totalReturn: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        maxConsecutiveLosses: 0,
        trades: 0,
        wins: 0,
        profits: []
      };
    }

    let balance = 1000;
    let peak = balance;
    let maxDrawdown = 0;
    let consecutiveLosses = 0;
    let maxConsecutiveLosses = 0;
    let wins = 0;
    const returns: number[] = [];

    trades.forEach(trade => {
      const profit = trade.profit || 0;
      balance += profit;
      
      if (profit > 0) {
        wins++;
        consecutiveLosses = 0;
      } else {
        consecutiveLosses++;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
      }

      peak = Math.max(peak, balance);
      const drawdown = ((peak - balance) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
      returns.push((profit / balance) * 100);
    });

    const avgReturn = MonteCarloSimulator.average(returns);
    const riskFreeRate = 2;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );

    const negativeReturns = returns.filter(r => r < 0);
    const downside = Math.sqrt(
      negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / (negativeReturns.length || 1)
    );

    return {
      winRate: (wins / trades.length) * 100,
      maxDrawdown,
      totalReturn: ((balance - 1000) / 1000) * 100,
      sharpeRatio: stdDev === 0 ? 0 : (avgReturn - riskFreeRate) / stdDev,
      sortinoRatio: downside === 0 ? 0 : (avgReturn - riskFreeRate) / downside,
      maxConsecutiveLosses,
      trades: trades.length,
      wins,
      profits: trades.map(t => t.profit || 0)
    };
  }
}
