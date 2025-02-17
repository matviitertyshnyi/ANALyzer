export interface RawDataPoint {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  subFeatures?: {
    [timeframe: string]: {
      priceVolatility: number;
      volumeProfile: {
        averageVolume: number;
        volumeChange: number;
        volumeTrend: number;
      };
      priceMovement: {
        trend: number;
        strength: number;
        volatility: number;
      };
      momentum: {
        roc: number;
        acceleration: number;
      };
    };
  };
}

export interface PriceAnalysis {
  close: number;
  bodySize: number;
  range: number;
  bb?: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
  };
}

export interface MomentumAnalysis {
  rsi: number;
  macd: {
    line: number;
    signal: number;
    histogram: number;
  };
  stoch: {
    k: number;
    d: number;
  };
}

export interface TrendAnalysis {
  ema9: number;
  ema21: number;
  sma20: number;
  adx: number;
  trendStrength: number;
}

export interface VolatilityAnalysis {
  atr: number;
  bbWidth: number;
  historicalVolatility: number;
}

export interface VolumeAnalysis {
  volume: number;
  vwap: number;
  obv: number;
  volumeTrend: number;
}

export interface AnalysisResult {
  price: PriceAnalysis;
  momentum: MomentumAnalysis;
  trend: TrendAnalysis;
  volatility: VolatilityAnalysis;
  volume: VolumeAnalysis;
}
