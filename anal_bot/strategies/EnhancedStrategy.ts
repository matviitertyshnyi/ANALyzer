import { BaseStrategy } from './BaseStrategy';
import { MarketData, Trade } from '../types';
import { calculateRSI, calculateATR, PatternDetector, calculateVolumeProfile } from '../indicators';

export class EnhancedStrategy extends BaseStrategy {
  private lastTradeTime: number = 0;
  private readonly TRADE_COOLDOWN = 5 * 60 * 1000; // 5 minutes cooldown
  private readonly PROFIT_TARGET = 2.0; // 2% take profit
  private readonly STOP_LOSS = 1.0; // 1% stop loss
  private historicalPredictions: { signal: string; accuracy: number }[] = [];
  private readonly MIN_CONFIDENCE = 0.75;
  private activeOrders: Map<string, {
    stopLoss: number;
    takeProfit: number;
  }> = new Map();

  // Add a public method to call the protected analyze method
  public async analyzePublic(data: MarketData[]): Promise<'buy' | 'sell' | 'hold'> {
    return this.analyze(data);
  }

  protected async analyze(data: MarketData[]): Promise<'buy' | 'sell' | 'hold'> {
    if (data.length < 50) return Promise.resolve('hold');
    
    const currentPrice = data[data.length - 1].close;
    const currentVolume = data[data.length - 1].volume;
    
    // Check if we're in cooldown
    if (Date.now() - this.lastTradeTime < this.TRADE_COOLDOWN) {
      return Promise.resolve('hold');
    }

    // Calculate technical indicators
    const prices = data.slice(-14).map(d => d.close);
    const rsi = calculateRSI(prices);
    const atr = calculateATR(data.slice(-14));
    const volumeProfile = calculateVolumeProfile(data.slice(-100));
    
    // Trend analysis
    const shortMA = this.calculateMA(data.map(d => d.close), 10);
    const longMA = this.calculateMA(data.map(d => d.close), 50);
    const trend = shortMA > longMA ? 'up' : 'down';
    
    // Volume analysis
    const volumeMA = this.calculateMA(data.map(d => d.volume), 20);
    const highVolume = currentVolume > volumeMA * 1.5;

    // Market conditions check
    const volatility = atr[atr.length - 1] / currentPrice * 100;
    const isHighVolatility = volatility > 2.0;

    // Entry conditions
    let signal: 'buy' | 'sell' | 'hold' = 'hold';

    if (!isHighVolatility && highVolume) {
      if (trend === 'up' && rsi[rsi.length - 1] <= 35) {
        signal = 'buy';
      } else if (trend === 'down' && rsi[rsi.length - 1] >= 65) {
        signal = 'sell';
      }
    }

    // Risk management
    if (signal !== 'hold') {
      this.lastTradeTime = Date.now();
      this.adjustPositionSize(volatility);
    }

    return Promise.resolve(signal);
  }

  private calculateMA(values: number[], period: number): number {
    const slice = values.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  private adjustPositionSize(volatility: number): void {
    // Base position size is 5% of balance
    let size = this.config.riskPerTrade;

    // Adjust based on volatility
    if (volatility > 1.5) {
      size *= 0.5; // Reduce position size in high volatility
    }

    // Never risk more than 5% of balance
    size = Math.min(size, 5);
    
    this.config.riskPerTrade = size;
  }

  // Add method to set take profit level
  protected setTakeProfit(tradeId: string, price: number): void {
    const order = this.activeOrders.get(tradeId);
    if (order) {
      order.takeProfit = price;
      this.activeOrders.set(tradeId, order);
    }
  }

  // Add method to set stop loss level
  protected setStopLoss(tradeId: string, price: number): void {
    const order = this.activeOrders.get(tradeId);
    if (order) {
      order.stopLoss = price;
      this.activeOrders.set(tradeId, order);
    }
  }

  protected onOrderFilled(trade: Trade): void {
    // Calculate stop loss and take profit levels
    const stopPrice = trade.type === 'LONG'
      ? trade.entryPrice * (1 - this.config.stopLoss / 100)
      : trade.entryPrice * (1 + this.config.stopLoss / 100);

    const targetPrice = trade.type === 'LONG'
      ? trade.entryPrice * (1 + this.config.takeProfit / 100)
      : trade.entryPrice * (1 - this.config.takeProfit / 100);

    // Create new order tracking
    this.activeOrders.set(trade.id, {
      stopLoss: stopPrice,
      takeProfit: targetPrice
    });

    // Set the actual levels
    this.setStopLoss(trade.id, stopPrice);
    this.setTakeProfit(trade.id, targetPrice);
  }
}
