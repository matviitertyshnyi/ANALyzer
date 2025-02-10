import { MarketData, TradingState, BotConfig, TradeRecord, StrategyMetrics } from '../types';

export abstract class BaseStrategy {
  protected state: TradingState;
  protected config: BotConfig;
  protected historicalData: MarketData[] = [];
  protected tradeHistory: TradeRecord[] = [];
  protected metrics: StrategyMetrics;

  constructor(config: BotConfig) {
    this.config = config;
    this.state = {
      balance: 1000,
      position: { type: null, entryPrice: 0, size: 0, leverage: 1 },
      lastAction: null
    };
    this.metrics = {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalProfit: 0,
      averageROI: 0,
      winRate: 0,
      tradeHistory: []
    };
  }

  protected recordTrade(trade: TradeRecord) {
    this.tradeHistory.push(trade);
    this.updateMetrics();
    this.adjustStrategy();
  }

  private updateMetrics() {
    const completedTrades = this.tradeHistory.filter(t => t.exitPrice !== undefined);
    this.metrics.totalTrades = completedTrades.length;
    this.metrics.winningTrades = completedTrades.filter(t => (t.profit || 0) > 0).length;
    this.metrics.losingTrades = completedTrades.filter(t => (t.profit || 0) <= 0).length;
    this.metrics.totalProfit = completedTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    this.metrics.winRate = this.metrics.totalTrades > 0 
      ? this.metrics.winningTrades / this.metrics.totalTrades 
      : 0;
    this.metrics.averageROI = this.metrics.totalTrades > 0 
      ? this.metrics.totalProfit / this.metrics.totalTrades 
      : 0;
  }

  protected abstract adjustStrategy(): void;

  public getMetrics(): StrategyMetrics {
    return {
      totalTrades: this.metrics.totalTrades,
      winningTrades: this.metrics.winningTrades,
      losingTrades: this.metrics.losingTrades,
      totalProfit: this.metrics.totalProfit,
      averageROI: this.metrics.averageROI,
      winRate: this.metrics.winRate,
      tradeHistory: [...this.metrics.tradeHistory]
    };
  }

  public getConfig(): BotConfig {
    return this.config;
  }

  public getCurrentPrice(): number {
    if (this.historicalData.length === 0) return 0;
    return this.historicalData[this.historicalData.length - 1].close;
  }

  abstract updateMarketData(newData: MarketData): void;
  abstract makeDecision(): Promise<{
    action: 'buy' | 'sell' | 'hold';
    amount?: number;
    leverage?: number;
  }>;
  protected abstract analyze(data: MarketData[]): 'buy' | 'sell' | 'hold';
}
