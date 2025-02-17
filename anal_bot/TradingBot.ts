import WebSocket from 'ws';
import { BaseStrategy } from './strategies/BaseStrategy';
import { MarketData } from './types';
import { notifyBot } from '../lib/services/telegram';

export class TradingBot {
  private isRunning: boolean = false;
  private ws: WebSocket | null = null;
  private historicalData: MarketData[] = [];
  private positions = new Map<string, {
    id: string;
    type: 'LONG' | 'SHORT';
    entryPrice: number;
    size: number;
    leverage: number;
    amount: number;
  }>();
  private latestPrice: number | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  
  // Add references to UI elements
  private uiCallbacks: {
    placeLongOrder: (amount: number, leverage: number) => void;
    placeShortOrder: (amount: number, leverage: number) => void;
  };

  constructor(
    private strategy: BaseStrategy,
    private handlers: {
      placeLongOrder: (amount: number, leverage: number) => Promise<void>;
      placeShortOrder: (amount: number, leverage: number) => Promise<void>;
    }
  ) {
    this.strategy = strategy;
    this.uiCallbacks = handlers;
  }

  public async start() {
    this.isRunning = true;
    this.updateInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        const decision = await this.strategy.makeDecision();
        
        if (decision.action === 'buy' && decision.amount && decision.leverage) {
          await this.uiCallbacks.placeLongOrder(decision.amount, decision.leverage);
        } else if (decision.action === 'sell' && decision.amount && decision.leverage) {
          await this.uiCallbacks.placeShortOrder(decision.amount, decision.leverage);
        }
      } catch (error) {
        console.error('Error in trading loop:', error);
      }
    }, 60000); // Check every minute
    this.connectToWebSocket();
  }

  public stop() {
    this.isRunning = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private connectToWebSocket() {
    const symbol = "btcusdt";
    console.log(`Connecting to WebSocket for ${symbol}...`);
    
    this.ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@kline_1m`);

    this.ws.on('open', () => {
      console.log('WebSocket connection established');
    });

    this.ws.on('message', async (eventData) => {
      if (!this.isRunning) return;

      try {
        const data = JSON.parse(eventData.toString());
        const kline = data.k;

        const price = parseFloat(kline.c);
        console.log(`Received price: ${price}`);

        const marketData: MarketData = {
          timestamp: kline.t,  // Use timestamp instead of time
          open: parseFloat(kline.o),
          high: parseFloat(kline.h),
          low: parseFloat(kline.l),
          close: parseFloat(kline.c),
          volume: parseFloat(kline.v),
          closeTime: kline.T,
          trades: kline.n,
          quoteVolume: parseFloat(kline.q),
          takerBuyBaseVolume: parseFloat(kline.V),
          takerBuyQuoteVolume: parseFloat(kline.Q)
        };

        this.historicalData.push(marketData);
        if (this.historicalData.length > 1000) {
          this.historicalData.shift(); // Keep last 1000 data points
        }

        this.strategy.updateMarketData(marketData);
        const decision = await this.strategy.makeDecision();
        console.log('Strategy decision:', decision);

        if (decision.action !== 'hold') {
          await notifyBot(`🎯 Signal Detected!
Price: $${price}
Action: ${decision.action.toUpperCase()}
Amount: $${decision.amount?.toFixed(2)}
Leverage: ${decision.leverage}x`);
          console.log('Executing trade:', decision);
          this.executeTrade(decision);
        }

        const currentPrice = parseFloat(kline.c);
        await this.checkPositionsForExit(currentPrice);
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.reconnect();
    });
  }

  private handlePrice(price: number, time: number): void {
    const candle: MarketData = {
      timestamp: time,  // This is already correct
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 0,
      closeTime: time,  // Add required fields
      trades: 0,
      quoteVolume: 0,
      takerBuyBaseVolume: 0,
      takerBuyQuoteVolume: 0
    };
    
    // ...existing code...
  }

  private async checkPositionsForExit(currentPrice: number) {
    for (const [id, position] of this.positions.entries()) {
      const priceDiff = position.type === 'LONG' 
        ? currentPrice - position.entryPrice 
        : position.entryPrice - currentPrice;
      
      const profit = priceDiff * position.size;
      const roi = (profit / position.amount) * 100;

      // Close position if profit >= 2% or loss <= -1%
      if (roi >= 2 || roi <= -1) {
        try {
          await fetch(`${process.env.BOT_SERVER_URL}/api/positions/${id}/close`, {
            method: 'POST'
          });
          this.positions.delete(id);
          
          await notifyBot(`🔄 Auto-${roi >= 2 ? 'Take Profit' : 'Stop Loss'}
Position: ${position.type}
Entry: $${position.entryPrice}
Exit: $${currentPrice}
ROI: ${roi.toFixed(2)}%
P/L: $${profit.toFixed(2)}`);
        } catch (error) {
          console.error('Failed to auto-close position:', error);
        }
      }
    }
  }

  private async executeTrade(decision: { action: string; amount?: number; leverage?: number }) {
    if (!decision.amount || !decision.leverage) return;

    const currentPrice = this.getLatestPrice();
    if (!currentPrice) {
      console.error('No price data available');
      return;
    }
    
    try {
      switch (decision.action) {
        case 'buy':
          await notifyBot(`🟢 Opening LONG position\nPrice: $${currentPrice}\nAmount: $${decision.amount}\nLeverage: ${decision.leverage}x`);
          await this.uiCallbacks.placeLongOrder(decision.amount, decision.leverage);
          this.positions.set(Date.now().toString(), {
            id: Date.now().toString(),
            type: 'LONG',
            entryPrice: currentPrice,
            size: (decision.amount * decision.leverage) / currentPrice,
            leverage: decision.leverage,
            amount: decision.amount
          });
          break;
        case 'sell':
          await notifyBot(`🔴 Opening SHORT position\nPrice: $${currentPrice}\nAmount: $${decision.amount}\nLeverage: ${decision.leverage}x`);
          await this.uiCallbacks.placeShortOrder(decision.amount, decision.leverage);
          this.positions.set(Date.now().toString(), {
            id: Date.now().toString(),
            type: 'SHORT',
            entryPrice: currentPrice,
            size: (decision.amount * decision.leverage) / currentPrice,
            leverage: decision.leverage,
            amount: decision.amount
          });
          break;
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      console.error('Trade execution failed:', errorMessage);
      await notifyBot(`⚠️ Trade execution failed: ${errorMessage}`);
    }
  }

  public getLatestPrice(): number | null {
    if (this.historicalData.length === 0) return null;
    return this.historicalData[this.historicalData.length - 1].close;
  }

  private reconnect() {
    setTimeout(() => {
      if (this.isRunning) {
        this.connectToWebSocket();
      }
    }, 5000);
  }
}
