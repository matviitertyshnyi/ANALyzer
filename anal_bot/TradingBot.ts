import { BaseStrategy } from './strategies/BaseStrategy';
import { BotConfig, MarketData } from './types';

export class TradingBot {
  private strategy: BaseStrategy;
  private isRunning: boolean = false;
  private ws: WebSocket | null = null;
  
  // Add references to UI elements
  private uiCallbacks: {
    placeLongOrder: (amount: number, leverage: number) => void;
    placeShortOrder: (amount: number, leverage: number) => void;
  };

  constructor(strategy: BaseStrategy, uiCallbacks: {
    placeLongOrder: (amount: number, leverage: number) => void;
    placeShortOrder: (amount: number, leverage: number) => void;
  }) {
    this.strategy = strategy;
    this.uiCallbacks = uiCallbacks;
  }

  public async start() {
    this.isRunning = true;
    this.connectToWebSocket();
  }

  public stop() {
    this.isRunning = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private connectToWebSocket() {
    const symbol = "btcusdt"; // lowercase for websocket
    this.ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@kline_1m`);

    this.ws.onmessage = async (event) => {
      if (!this.isRunning) return;

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

      if (decision.action !== 'hold') {
        this.executeTrade(decision);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.reconnect();
    };
  }

  private async executeTrade(decision: { action: string; amount?: number; leverage?: number }) {
    if (!decision.amount || !decision.leverage) return;

    // Execute trade through UI callbacks
    switch (decision.action) {
      case 'buy':
        this.uiCallbacks.placeLongOrder(decision.amount, decision.leverage);
        break;
      case 'sell':
        this.uiCallbacks.placeShortOrder(decision.amount, decision.leverage);
        break;
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
