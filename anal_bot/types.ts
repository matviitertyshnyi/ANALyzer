// ...existing types...

export interface SimulationResults {
  winRate: number;
  expectedReturn: number;
  maxDrawdown: number;
  totalTrades: number;
  avgProfit?: number;
  avgLoss?: number;
  riskMetrics: {
    sharpeRatio: number;
    maxConsecutiveLosses: number;
  };
}

export interface OptimizationResult {
  config: BotConfig;
  score: number;
  metrics: SimulationResults;
}

export interface BotConfig {
  symbol: string;
  interval: string;
  maxLeverage: number;
  riskPerTrade: number;  // percentage of balance
  stopLoss: number;      // percentage
  takeProfit: number;    // percentage
  mlConfig?: MLConfig;   // optional ML-specific config
}

// Add any unique types from types/index.ts here if needed

export interface MarketData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time?: number;
  closeTime?: number;
  quoteVolume?: number;
  trades?: number;
  takerBuyBaseVolume?: number;
  takerBuyQuoteVolume?: number;
}

export interface Trade {
  id: string;  // Changed from optional to required
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  size: number;
  leverage: number;
  timestamp: Date;
  profit: number;
  initialMargin?: number;
  status?: 'open' | 'closed';
  symbol?: string;
}

export interface Position {
  id: string;
  type: 'LONG' | 'SHORT';
  coin: string;
  entryPrice: number;
  size: number;
  leverage: number;
  initialMargin: number;
  liquidationPrice: number;
  timestamp: Date;
}

export interface TradeMetrics {
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoPatio?: number;
  totalTrades: number;
  avgProfit: number;
  avgLoss: number;
  maxConsecutiveLosses?: number;
  dailyPnL?: number[];
}

export interface TradingState {
  balance: number;
  position: {
    type: 'LONG' | 'SHORT' | null;
    entryPrice: number;
    size: number;
    leverage: number;
  };
  lastAction: 'buy' | 'sell' | 'hold' | null;
}

export interface MLConfig {
  windowSize: number;
  confidenceThreshold: number;
  trainingInterval: number;
}

export interface BotConfig {
  symbol: string;
  interval: string;
  maxLeverage: number;
  riskPerTrade: number;  // percentage of balance
  stopLoss: number;      // percentage
  takeProfit: number;    // percentage
  mlConfig?: MLConfig;
}

export interface BotState {
  id: number;
  is_active: boolean;
  strategy: string;
  last_update: Date;
}

export interface MarketRegimeState {
  trend: 'bullish' | 'bearish' | 'sideways';
  volatility: 'high' | 'normal' | 'low';
  momentum: 'strong' | 'weak';
  support: number;
  resistance: number;
}

export interface PortfolioRiskMetrics {
  totalExposure: number;
  effectiveLeverage: number;
  riskPercentage: number;
  diversificationScore: number;
  correlationRisk: number;
}