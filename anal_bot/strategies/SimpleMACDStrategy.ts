import { BaseStrategy } from './BaseStrategy';
import { MarketData, Trade, BotConfig } from '../types';
import { calculateMACD } from '../indicators';
import { TradeMemory } from '../learning/TradeMemory';

// Export as SimpleMACD to match the import in strategies.tsx
export { SimpleMACDStrategy as SimpleMACD };

export class SimpleMACDStrategy extends BaseStrategy {
  private positions: Map<string, {
    type: 'LONG' | 'SHORT';
    entryPrice: number;
    size: number;
    stopLoss: number;
    takeProfit: number;
  }> = new Map();

  private activeOrders: Map<string, {
    stopLoss: number;
    takeProfit: number;
  }> = new Map();

  protected memory: TradeMemory;

  constructor(config: BotConfig) {
    super(config);
    this.memory = new TradeMemory();
  }

  private calculateEMA(data: number[], period: number): number[] {
    const multiplier = 2 / (period + 1);
    const ema = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
      ema.push((data[i] - ema[i-1]) * multiplier + ema[i-1]);
    }
    return ema;
  }

  protected calculateMACD(data: MarketData[]): { macd: number[]; signal: number[] } {
    const closes = data.map(d => d.close);
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    const macdLine = ema12.map((v, i) => v - ema26[i]);
    const signalLine = this.calculateEMA(macdLine, 9);
    
    return { macd: macdLine, signal: signalLine };
  }

  private findSupportResistanceLevels(data: MarketData[], period: number = 20): { supports: number[], resistances: number[] } {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const supports: number[] = [];
    const resistances: number[] = [];

    // Look for swing points
    for (let i = period; i < data.length - period; i++) {
      // Support detection
      if (lows[i] <= Math.min(...lows.slice(i - period, i)) && 
          lows[i] <= Math.min(...lows.slice(i + 1, i + period))) {
        supports.push(lows[i]);
      }

      // Resistance detection
      if (highs[i] >= Math.max(...highs.slice(i - period, i)) && 
          highs[i] >= Math.max(...highs.slice(i + 1, i + period))) {
        resistances.push(highs[i]);
      }
    }

    // Group nearby levels (within 0.5% range)
    const groupLevels = (levels: number[]): number[] => {
      const grouped: number[] = [];
      for (const level of levels) {
        const nearby = grouped.find(g => Math.abs((g - level) / g) < 0.005);
        if (!nearby) {
          grouped.push(level);
        }
      }
      return grouped.sort((a, b) => a - b);
    };

    return {
      supports: groupLevels(supports),
      resistances: groupLevels(resistances)
    };
  }

  private checkPositionExits(currentPrice: number) {
    // More aggressive position management
    this.positions.forEach((pos, id) => {
      const priceMove = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
      const normalizedMove = pos.type === 'LONG' ? priceMove : -priceMove;

      // Close positions faster
      if (normalizedMove <= -0.5 || normalizedMove >= 1.0) {
        this.closePosition(id, currentPrice, normalizedMove <= -0.5 ? 'stop_loss' : 'take_profit');
      }
    });
  }

  protected async analyze(data: MarketData[]): Promise<'buy' | 'sell' | 'hold'> {
    if (data.length < 26) return 'hold';

    const currentPrice = data[data.length - 1].close;
    const { macd, signal } = this.calculateMACD(data);
    const { supports, resistances } = this.findSupportResistanceLevels(data);
    const volumeProfile = this.calculateVolumeProfile(data.slice(-50));

    // Enhanced entry conditions
    const last = macd.length - 1;
    const macdTrend = this.calculateTrendStrength(macd.slice(-10));
    const volumeTrend = this.calculateVolumeStrength(data.slice(-10));
    const priceGap = this.calculatePriceGap(currentPrice, supports, resistances);

    // Only trade when market conditions are favorable
    if (volumeTrend < 1.0 || priceGap < 0.3) return 'hold';

    const bullishSignal = 
      macd[last] > signal[last] &&
      macdTrend > 0.5 &&
      currentPrice > volumeProfile.vwap &&
      this.isNearSupport(currentPrice, supports);

    const bearishSignal = 
      macd[last] < signal[last] &&
      macdTrend < -0.5 &&
      currentPrice < volumeProfile.vwap &&
      this.isNearResistance(currentPrice, resistances);

    // Risk adjustment based on trend strength
    if (bullishSignal || bearishSignal) {
      const trendStrength = Math.abs(macdTrend);
      this.config.riskPerTrade = Math.min(15 * trendStrength, 20);
    }

    return bullishSignal ? 'buy' : bearishSignal ? 'sell' : 'hold';
  }

  private calculateVolumeProfile(data: MarketData[]) {
    const totalVolume = data.reduce((sum, d) => sum + d.volume, 0);
    const vwap = data.reduce((sum, d) => sum + d.close * d.volume, 0) / totalVolume;
    return { vwap };
  }

  private calculatePriceGap(price: number, supports: number[], resistances: number[]): number {
    const nearestSupport = Math.max(...supports.filter(s => s < price));
    const nearestResistance = Math.min(...resistances.filter(r => r > price));
    return Math.min(
      Math.abs(price - nearestSupport) / price,
      Math.abs(nearestResistance - price) / price
    ) * 100;
  }

  private isNearSupport(price: number, supports: number[]): boolean {
    return supports.some(s => Math.abs(price - s) / price < 0.005);
  }

  private isNearResistance(price: number, resistances: number[]): boolean {
    return resistances.some(r => Math.abs(price - r) / price < 0.005);
  }

  private calculateTrendStrength(data: number[]): number {
    const slope = data.map((v, i) => i > 0 ? v - data[i-1] : 0);
    return this.average(slope);
  }

  private calculateVolumeStrength(data: MarketData[]): number {
    const volumes = data.map(d => d.volume);
    const avgVol = this.average(volumes.slice(0, -1));
    return volumes[volumes.length - 1] / avgVol;
  }

  private calculateVolatility(data: MarketData[]): number {
    const returns = data.slice(1).map((d, i) => 
      (d.close - data[i].close) / data[i].close * 100
    );
    return Math.sqrt(returns.reduce((a, b) => a + b * b, 0) / returns.length);
  }

  private average(numbers: number[]): number {
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private closePosition(id: string, currentPrice: number, reason: 'stop_loss' | 'take_profit') {
    const position = this.positions.get(id);
    if (!position) return;

    const pnl = position.type === 'LONG'
      ? (currentPrice - position.entryPrice) * position.size
      : (position.entryPrice - currentPrice) * position.size;

    console.log(`Closing position ${id}:`, {
      type: position.type,
      entryPrice: position.entryPrice,
      exitPrice: currentPrice,
      pnl,
      reason
    });

    this.positions.delete(id);
  }

  // Implement the required abstract methods
  protected setTakeProfit(tradeId: string, price: number): void {
    const order = this.activeOrders.get(tradeId);
    if (order) {
      order.takeProfit = price;
      this.activeOrders.set(tradeId, order);
    }
  }

  protected setStopLoss(tradeId: string, price: number): void {
    const order = this.activeOrders.get(tradeId);
    if (order) {
      order.stopLoss = price;
      this.activeOrders.set(tradeId, order);
    }
  }

  protected onOrderFilled(trade: Trade): void {
    if (!trade.id) {
      console.error('Trade ID is missing');
      return;
    }

    const stopPrice = trade.type === 'LONG'
      ? trade.entryPrice * (1 - this.config.stopLoss / 100)
      : trade.entryPrice * (1 + this.config.stopLoss / 100);

    const targetPrice = trade.type === 'LONG'
      ? trade.entryPrice * (1 + this.config.takeProfit / 100)
      : trade.entryPrice * (1 - this.config.takeProfit / 100);

    this.activeOrders.set(trade.id, {
      stopLoss: stopPrice,
      takeProfit: targetPrice
    });

    this.setStopLoss(trade.id, stopPrice);
    this.setTakeProfit(trade.id, targetPrice);

    // Learn from this trade
    this.memory.addTrade(trade, this.historicalData.slice(-10));
  }
}
