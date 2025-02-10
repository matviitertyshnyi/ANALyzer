export interface MarketData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradingState {
  balance: number;
  position: {
    type: 'long' | 'short' | null;
    entryPrice: number;
    size: number;
    leverage: number;
  };
  lastAction: 'buy' | 'sell' | 'hold' | null;
}

export interface BotConfig {
  symbol: string;
  interval: string;
  maxLeverage: number;
  riskPerTrade: number;  // percentage of balance
  stopLoss: number;      // percentage
  takeProfit: number;    // percentage
}
