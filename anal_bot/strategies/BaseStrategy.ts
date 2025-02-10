import { MarketData, TradingState, BotConfig } from '../types';

export abstract class BaseStrategy {
  protected state: TradingState;
  protected config: BotConfig;
  protected historicalData: MarketData[] = [];

  constructor(config: BotConfig) {
    this.config = config;
    this.state = {
      balance: 1000,
      position: { type: null, entryPrice: 0, size: 0, leverage: 1 },
      lastAction: null
    };
  }

  protected abstract analyze(data: MarketData[]): 'buy' | 'sell' | 'hold';

  public updateMarketData(newData: MarketData) {
    this.historicalData.push(newData);
    if (this.historicalData.length > 1000) {
      this.historicalData.shift();
    }
  }

  public async makeDecision(): Promise<{
    action: 'buy' | 'sell' | 'hold';
    amount?: number;
    leverage?: number;
  }> {
    if (this.historicalData.length < 2) return { action: 'hold' };

    const action = this.analyze(this.historicalData);
    if (action === 'hold') return { action };

    const currentPrice = this.historicalData[this.historicalData.length - 1].close;
    const tradeAmount = (this.state.balance * this.config.riskPerTrade) / 100;
    
    return {
      action,
      amount: tradeAmount,
      leverage: this.config.maxLeverage
    };
  }
}
