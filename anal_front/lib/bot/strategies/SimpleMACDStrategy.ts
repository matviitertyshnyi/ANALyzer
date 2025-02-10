import { BaseStrategy } from './BaseStrategy';
import { MarketData } from '../types';
import { saveBotData, getBotData } from '../utils/storage';

export class SimpleMACDStrategy extends BaseStrategy {
  private lastTradeTime: number = 0;
  private readonly TRADE_COOLDOWN = 1000 * 60 * 5; // 5 minutes cooldown
  private historicalData: MarketData[] = [];
  private macdPeriods = {
    fast: 12,
    slow: 26,
    signal: 9
  };

  constructor(config: BotConfig) {
    super(config);
    this.loadStoredData();
  }

  public updateMarketData(newData: MarketData) {
    this.historicalData.push(newData);
    if (this.historicalData.length > 100) {
      this.historicalData.shift();
    }
  }

  private loadStoredData() {
    const storedData = getBotData()[this.config.symbol];
    if (storedData) {
      this.metrics = storedData.metrics;
      this.tradeHistory = storedData.tradeHistory;
      this.macdPeriods = storedData.macdPeriods;
      console.log('Loaded stored bot data:', storedData);
    }
  }

  private calculateEMA(data: number[], period: number): number[] {
    const multiplier = 2 / (period + 1);
    const emas = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
      emas.push((data[i] - emas[i-1]) * multiplier + emas[i-1]);
    }
    return emas;
  }

  private calculateMACD(prices: number[]): { macd: number[], signal: number[] } {
    const ema12 = this.calculateEMA(prices, this.macdPeriods.fast);
    const ema26 = this.calculateEMA(prices, this.macdPeriods.slow);
    
    const macdLine = ema12.map((ema12Val, i) => ema12Val - ema26[i]);
    const signalLine = this.calculateEMA(macdLine, this.macdPeriods.signal);
    
    return { macd: macdLine, signal: signalLine };
  }

  protected analyze(data: MarketData[]): 'buy' | 'sell' | 'hold' {
    if (data.length < 35) return 'hold';

    // Check if we're in cooldown
    const now = Date.now();
    if (now - this.lastTradeTime < this.TRADE_COOLDOWN) {
      return 'hold';
    }

    // Don't open opposite positions
    if (this.state.position.type === 'long') {
      // Only look for sell signals when in long position
      const { profit } = this.calculateCurrentProfit();
      if (profit && profit < -this.config.stopLoss) {
        return 'sell'; // Stop loss
      }
      if (profit && profit > this.config.takeProfit) {
        return 'sell'; // Take profit
      }
    } else if (this.state.position.type === 'short') {
      // Only look for buy signals when in short position
      const { profit } = this.calculateCurrentProfit();
      if (profit && profit < -this.config.stopLoss) {
        return 'buy'; // Stop loss
      }
      if (profit && profit > this.config.takeProfit) {
        return 'buy'; // Take profit
      }
    }

    const prices = data.map(d => d.close);
    const { macd, signal } = this.calculateMACD(prices);
    const lastIndex = macd.length - 1;
    const prevIndex = lastIndex - 1;

    // Only open new positions if we're not in any position
    if (!this.state.position.type) {
      if (macd[prevIndex] < signal[prevIndex] && macd[lastIndex] > signal[lastIndex]) {
        this.lastTradeTime = now;
        return 'buy';
      }
      if (macd[prevIndex] > signal[prevIndex] && macd[lastIndex] < signal[lastIndex]) {
        this.lastTradeTime = now;
        return 'sell';
      }
    }

    return 'hold';
  }

  private calculateCurrentProfit() {
    if (!this.state.position.type || !this.state.position.entryPrice || !this.state.position.size) {
      return { profit: 0, roi: 0 };
    }

    const currentPrice = this.getCurrentPrice();
    const priceDiff = this.state.position.type === 'long'
      ? currentPrice - this.state.position.entryPrice
      : this.state.position.entryPrice - currentPrice;

    const profit = priceDiff * this.state.position.size;
    const roi = (profit / (this.state.position.entryPrice * this.state.position.size)) * 100;

    return { profit, roi };
  }

  protected adjustStrategy(): void {
    if (this.metrics.totalTrades < 10) return; // Need minimum trades to adjust

    // Adjust risk based on win rate
    if (this.metrics.winRate > 0.6) {
      this.config.riskPerTrade = Math.min(10, this.config.riskPerTrade + 1);
    } else if (this.metrics.winRate < 0.4) {
      this.config.riskPerTrade = Math.max(1, this.config.riskPerTrade - 1);
    }

    // Adjust MACD periods based on performance
    if (this.metrics.averageROI > 0) {
      // Current settings are working, make small adjustments
      this.macdPeriods.fast = Math.max(8, this.macdPeriods.fast - 1);
      this.macdPeriods.slow = Math.max(22, this.macdPeriods.slow - 1);
    } else {
      // Poor performance, increase periods
      this.macdPeriods.fast = Math.min(16, this.macdPeriods.fast + 1);
      this.macdPeriods.slow = Math.min(30, this.macdPeriods.slow + 1);
    }

    console.log("Strategy adjusted:", {
      riskPerTrade: this.config.riskPerTrade,
      macdPeriods: this.macdPeriods,
      metrics: this.metrics
    });

    this.saveData();
  }

  protected recordTrade(trade: TradeRecord) {
    super.recordTrade(trade);
    this.saveData();
  }

  private saveData() {
    saveBotData(this.config.symbol, {
      metrics: this.metrics,
      tradeHistory: this.tradeHistory,
      macdPeriods: this.macdPeriods,
      lastUpdated: Date.now()
    });
  }

  public async makeDecision(): Promise<{ action: 'buy' | 'sell' | 'hold'; amount?: number; leverage?: number; }> {
    if (this.historicalData.length < 35) {
      return { action: 'hold' };
    }

    const action = this.analyze(this.historicalData);
    console.log('MACD Analysis:', action);

    if (action === 'hold') {
      return { action };
    }

    const tradeAmount = (this.state.balance * this.config.riskPerTrade) / 100;
    console.log('Trade setup:', { action, amount: tradeAmount, leverage: this.config.maxLeverage });

    if (action !== 'hold') {
      // Update state when opening new position
      const currentPrice = this.getCurrentPrice();
      this.state.position = {
        type: action === 'buy' ? 'long' : 'short',
        entryPrice: currentPrice,
        size: (this.state.balance * this.config.riskPerTrade) / (100 * currentPrice),
        leverage: this.config.maxLeverage
      };
    }

    return {
      action,
      amount: tradeAmount,
      leverage: this.config.maxLeverage
    };
  }
}
