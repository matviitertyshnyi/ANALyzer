import { MarketData, TradingState, BotConfig, Trade } from '../types';
import { TradeMemory } from '../learning/TradeMemory';

export abstract class BaseStrategy {
  protected state: TradingState;
  protected config: BotConfig;
  protected historicalData: MarketData[] = [];
  protected memory: TradeMemory; // Changed from private to protected
  protected adaptiveParameters: {
    stopLoss: number;
    takeProfit: number;
    riskPerTrade: number;
    timeOfDay: Map<number, { winRate: number; trades: number }>;
  };

  constructor(config: BotConfig) {
    this.config = config;
    this.state = {
      balance: 1000,
      position: { type: null, entryPrice: 0, size: 0, leverage: 1 },
      lastAction: null
    };
    this.memory = new TradeMemory();
    this.adaptiveParameters = {
      stopLoss: config.stopLoss,
      takeProfit: config.takeProfit,
      riskPerTrade: config.riskPerTrade,
      timeOfDay: new Map()
    };
  }

  public getSymbol(): string {
    return this.config.symbol;
  }

  public getInterval(): string {
    return this.config.interval;
  }

  // Change return type to Promise
  protected abstract analyze(data: MarketData[]): Promise<'buy' | 'sell' | 'hold'>;
  protected abstract setTakeProfit(tradeId: string, price: number): void;
  protected abstract setStopLoss(tradeId: string, price: number): void;
  protected abstract onOrderFilled(trade: Trade): void;

  public updateMarketData(newData: MarketData) {
    this.historicalData.push(newData);
    if (this.historicalData.length > 1000) {
      this.historicalData.shift();
    }
  }

  protected adaptParameters(trade: Trade): void {
    if (trade.profit > 0) {
      const priceMove = Math.abs((trade.exitPrice! - trade.entryPrice) / trade.entryPrice * 100);
      this.adaptiveParameters.stopLoss = (this.adaptiveParameters.stopLoss * 0.9 + priceMove * 0.1);
      this.adaptiveParameters.takeProfit = (this.adaptiveParameters.takeProfit * 0.9 + priceMove * 1.5 * 0.1);

      const hour = new Date(trade.timestamp).getHours();
      const hourStats = this.adaptiveParameters.timeOfDay.get(hour) || { winRate: 0, trades: 0 };
      hourStats.trades++;
      hourStats.winRate = (hourStats.winRate * (hourStats.trades - 1) + 100) / hourStats.trades;
      this.adaptiveParameters.timeOfDay.set(hour, hourStats);
    }

    const recentWinRate = this.memory.getRecentWinRate(20);
    if (recentWinRate > 60) {
      this.adaptiveParameters.riskPerTrade = Math.min(this.adaptiveParameters.riskPerTrade * 1.1, 25);
    } else if (recentWinRate < 40) {
      this.adaptiveParameters.riskPerTrade = Math.max(this.adaptiveParameters.riskPerTrade * 0.9, 5);
    }

    this.config.stopLoss = this.adaptiveParameters.stopLoss;
    this.config.takeProfit = this.adaptiveParameters.takeProfit;
    this.config.riskPerTrade = this.adaptiveParameters.riskPerTrade;
  }

  public async makeDecision(): Promise<{
    action: 'buy' | 'sell' | 'hold';
    amount?: number;
    leverage?: number;
  }> {
    const currentHour = new Date().getHours();
    const hourStats = this.adaptiveParameters.timeOfDay.get(currentHour);
    if (hourStats && hourStats.trades > 10 && hourStats.winRate < 45) {
      return { action: 'hold' };
    }

    if (this.historicalData.length < 2) return { action: 'hold' };

    const action = await this.analyze(this.historicalData);
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
