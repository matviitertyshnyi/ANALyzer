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
  lastTradeTime?: number;
}

export interface BotConfig {
  symbol: string;
  interval: string;
  maxLeverage: number;
  riskPerTrade: number;
  stopLoss: number;
  takeProfit: number;
}

export interface TradeRecord {
  timestamp: number;
  action: 'buy' | 'sell';
  entryPrice: number;
  exitPrice?: number;
  profit?: number;
  size: number;
  leverage: number;
}

export interface StrategyMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalProfit: number;
  averageROI: number;
  winRate: number;
  tradeHistory: TradeRecord[];
}
