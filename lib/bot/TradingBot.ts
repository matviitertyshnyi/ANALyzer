import { BaseStrategy } from './strategies/BaseStrategy';
import { MarketData } from './types';

export class TradingBot {
  private strategy: BaseStrategy;
  private isRunning: boolean = false;
  private ws: WebSocket | null = null;
  
  private uiCallbacks: {
    placeLongOrder: (amount: number, leverage: number) => void;
    placeShortOrder: (amount: number, leverage: number) => void;
  };

  constructor(
    strategy: BaseStrategy,
    callbacks: {
      placeLongOrder: (amount: number, leverage: number) => void;
      placeShortOrder: (amount: number, leverage: number) => void;
    }
  ) {
    this.strategy = strategy;
    this.uiCallbacks = callbacks;
    console.log("TradingBot initialized");
  }

  public async start() {
    console.log("Starting trading bot...");
    this.isRunning = true;
    this.connectToWebSocket();
  }

  public stop(): void {
    console.log("Stopping trading bot...");
    this.isRunning = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public getStrategy(): BaseStrategy {
    return this.strategy;
  }

  private connectToWebSocket() {
    const symbol = this.strategy.getConfig().symbol.toLowerCase();
    const interval = this.strategy.getConfig().interval;
    
    console.log(`Connecting to WebSocket for ${symbol}@kline_${interval}`);
    this.ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`);

    this.ws.onopen = () => console.log("WebSocket connected");
    this.ws.onclose = () => console.log("WebSocket disconnected");
    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.reconnect();
    };

    this.ws.onmessage = async (event) => {
      if (!this.isRunning) return;

      try {
        const data = JSON.parse(event.data);
        const kline = data.k;

        const marketData: MarketData = {
          time: Math.floor(kline.t / 1000),
          open: parseFloat(kline.o),
          high: parseFloat(kline.h),
          low: parseFloat(kline.l),
          close: parseFloat(kline.c),
          volume: parseFloat(kline.v)
        };

        this.strategy.updateMarketData(marketData);
        const decision = await this.strategy.makeDecision();
        console.log("Bot decision:", decision);

        if (decision.action !== 'hold') {
          await this.executeTrade(decision);
        }
      } catch (error) {
        console.error("Error processing market data:", error);
      }
    };
  }

  private async executeTrade(decision: { action: 'buy' | 'sell' | 'hold'; amount?: number; leverage?: number }) {
    if (!decision.amount || !decision.leverage || decision.action === 'hold') return;

    console.log(`Executing ${decision.action} trade:`, {
      amount: decision.amount,
      leverage: decision.leverage,
      currentPrice: this.strategy.getCurrentPrice()
    });

    try {
      if (decision.action === 'buy') {
        await this.uiCallbacks.placeLongOrder(decision.amount, decision.leverage);
      } else if (decision.action === 'sell') {
        await this.uiCallbacks.placeShortOrder(decision.amount, decision.leverage);
      }
    } catch (error) {
      console.error('Error executing trade:', error);
    }
  }

  private reconnect() {
    setTimeout(() => {
      if (this.isRunning) {
        this.connectToWebSocket();
      }
    }, 5000);
  }
}
