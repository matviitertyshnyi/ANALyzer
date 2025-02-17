export interface Position {
  id: string;
  coin: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  size: number;
  leverage: number;
  initialMargin: number;
  timestamp: Date;
}

export interface MLModelConfig {
  windowSize: number;
  features: string[];
  hiddenLayers?: number[];
}

export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  validationSplit: number;
}

export interface ModelPrediction {
  prediction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  timestamp: Date;
}
