import { MarketData, Trade, BotConfig } from '../types';
import { EnhancedStrategy } from '../strategies/EnhancedStrategy';
import { PerformanceTracker } from '../analytics/PerformanceTracker';

export class Backtester {
  private initialBalance: number;
  private performanceTracker: PerformanceTracker;

  constructor(initialBalance: number = 1000) {
    this.initialBalance = initialBalance;
    this.performanceTracker = new PerformanceTracker();
  }

  public async runBacktest(data: MarketData[], config: BotConfig): Promise<{
    trades: Trade[];
    finalBalance: number;
    metrics: any;
  }> {
    const strategy = new EnhancedStrategy(config);
    let balance = this.initialBalance;
    const trades: Trade[] = [];

    for (let i = 100; i < data.length; i++) {
      const windowData = data.slice(0, i + 1);
      const decision = await strategy.analyzePublic(windowData); // Use the public method
      
      if (decision !== 'hold') {
        const currentPrice = data[i].close;
        const positionSize = this.calculatePositionSize(balance, config);
        
        const trade = this.executeTrade(
          decision, 
          currentPrice, 
          positionSize, 
          config.maxLeverage
        );

        trades.push(trade);
        this.performanceTracker.addTrade(trade);
        balance += trade.profit;
      }
    }

    return {
      trades,
      finalBalance: balance,
      metrics: this.performanceTracker.getMetrics()
    };
  }

  private calculatePositionSize(balance: number, config: BotConfig): number {
    return balance * (config.riskPerTrade / 100);
  }

  private executeTrade(
    type: 'buy' | 'sell',
    entryPrice: number,
    size: number,
    leverage: number
  ): Trade {
    const exitPrice = entryPrice * (type === 'buy' ? 1.02 : 0.98); // Simulate 2% move
    const profit = type === 'buy' 
      ? (exitPrice - entryPrice) * size * leverage
      : (entryPrice - exitPrice) * size * leverage;

    return {
      id: Math.random().toString(36).substr(2, 9),
      type: type === 'buy' ? 'LONG' : 'SHORT',
      entryPrice,
      exitPrice,
      size: size * leverage,
      leverage,
      profit,
      timestamp: new Date(),
      symbol: 'BTCUSDT', // Assuming BTCUSDT for this example
      status: 'closed'
    };
  }
}
