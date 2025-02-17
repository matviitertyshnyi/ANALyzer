import { Trade, MarketData } from '../types';

export class TradeMemory {
  private readonly STORAGE_KEY = 'trade_memory';
  private memories: {
    trades: Trade[];
    patterns: {
      priceAction: number[][];
      result: 'profit' | 'loss';
    }[];
    successfulPatterns: Map<string, number>;
  };

  constructor() {
    this.memories = this.loadMemories();
  }

  private loadMemories() {
    if (typeof window === 'undefined') {
      return {
        trades: [],
        patterns: [],
        successfulPatterns: new Map()
      };
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert plain object back to Map
        parsed.successfulPatterns = new Map(Object.entries(parsed.successfulPatterns));
        return parsed;
      }
    } catch (error) {
      console.error('Failed to load memories:', error);
    }

    return {
      trades: [],
      patterns: [],
      successfulPatterns: new Map()
    };
  }

  public saveMemories() {
    if (typeof window === 'undefined') return;

    try {
      // Convert Map to plain object for JSON serialization
      const memoriesToSave = {
        ...this.memories,
        successfulPatterns: Object.fromEntries(this.memories.successfulPatterns)
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(memoriesToSave));
    } catch (error) {
      console.error('Failed to save memories:', error);
    }
  }

  public addTrade(trade: Trade, priceAction: MarketData[]) {
    this.memories.trades.push(trade);
    
    // Extract pattern from price action
    const pattern = priceAction.map(d => [
      d.close / d.open - 1,
      (d.high - d.low) / d.low,
      Math.log(d.volume)
    ]);

    // Add to patterns with result
    this.memories.patterns.push({
      priceAction: pattern,
      result: trade.profit > 0 ? 'profit' : 'loss'
    });

    this.saveMemories();
  }

  public getProfitablePatterns(): number[][] {
    return this.memories.patterns
      .filter(p => p.result === 'profit')
      .map(p => p.priceAction)
      .flat();
  }

  public getWinRate(): number {
    if (this.memories.trades.length === 0) return 0;
    const wins = this.memories.trades.filter(t => t.profit > 0).length;
    return (wins / this.memories.trades.length) * 100;
  }

  public getBestPatterns(): Map<string, number> {
    return this.memories.successfulPatterns;
  }

  public getRecentWinRate(count: number): number {
    const recentTrades = this.memories.trades.slice(-count);
    if (recentTrades.length === 0) return 0;
    
    const wins = recentTrades.filter(t => t.profit > 0).length;
    return (wins / recentTrades.length) * 100;
  }

  public getTradingHourStats(): Map<number, { winRate: number; trades: number }> {
    const hourStats = new Map<number, { wins: number; trades: number }>();
    
    this.memories.trades.forEach(trade => {
      const hour = new Date(trade.timestamp).getHours();
      const stats = hourStats.get(hour) || { wins: 0, trades: 0 };
      stats.trades++;
      if (trade.profit > 0) stats.wins++;
      hourStats.set(hour, stats);
    });

    return new Map([...hourStats].map(([hour, stats]) => [
      hour,
      {
        winRate: (stats.wins / stats.trades) * 100,
        trades: stats.trades
      }
    ]));
  }
}
