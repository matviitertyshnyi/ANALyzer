import { Request } from 'express';
import { 
  ChartConfiguration, 
  ChartOptions, 
  ChartData,
  Plugin,
  ScaleOptions
} from 'chart.js';

export interface TypedRequest<T> extends Request {
  body: T;
}

export interface StrategyRequest {
  strategy: string;
  config: {
    timeframe: string;
    days: number;
    leverage: number;
    stopLoss: number;
    takeProfit: number;
    riskPerTrade: number;
  };
}

export interface Trade {
  id: number;
  type: 'LONG' | 'SHORT';
  price: string;
  size: string;
  leverage: string;
  amount: string;
  timestamp: string;
  status: string;
}

export type PositionType = 'LONG' | 'SHORT';

export interface Position {
  id: string;
  coin: string;
  type: PositionType;
  entryPrice: number;
  size: number;
  leverage: number;
  initialMargin: number;
  liquidationPrice: number;
  exposure: number;
  percentage: number;
  timestamp: Date;
  status: string;
  originalPositions?: Position[];
}

export interface ChartScaleOptions extends ScaleOptions {
  position: 'left' | 'right' | 'top' | 'bottom' | 'center';
  beginAtZero: boolean;
  grid: {
    color: string;
  };
  ticks: {
    color: string;
    callback?: (value: number) => string;
  };
}

export interface CustomChartPlugins {
  legend: {
    display: boolean;
  };
  tooltip: {
    enabled: boolean;
  };
}

export interface CustomChartConfiguration extends Omit<ChartConfiguration, 'options'> {
  options: {
    responsive: boolean;
    scales: {
      pnl: ChartScaleOptions;
      y: ChartScaleOptions;
      x: ChartScaleOptions;
    };
    plugins: CustomChartPlugins;
  };
}

export interface TrainingMetrics {
  accuracy?: number;
  loss?: number;
  precision?: number;
  recall?: number;
  [key: string]: number | undefined;
}

export interface TrainingHistory {
  loss?: number[];
  accuracy?: number[];
  [key: string]: number[] | undefined;
}

export interface CandleData {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  buyBaseVolume: string;
  buyQuoteVolume: string;
}

export interface TrainingData {
  raw_data: CandleData[];
  processed_features: any[];
  timestamp: string;
}
