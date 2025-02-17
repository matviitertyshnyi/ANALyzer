import { TechnicalIndicators } from '../services/TechnicalIndicators';
import * as tf from '@tensorflow/tfjs';

export class DataPreprocessor {
  // Constants for feature engineering
  private static readonly FEATURE_PARAMS = {
    RSI_PERIOD: 14,
    MACD: {
      FAST: 12,
      SLOW: 26,
      SIGNAL: 9
    },
    BB_PERIOD: 20,
    BB_STD: 2,
    ATR_PERIOD: 14,
    MOMENTUM_PERIOD: 10,
    VOLATILITY_WINDOW: 20,
    PRICE_CHANGE_THRESHOLD: 0.002  // 0.2% threshold for trade signals
  };

  static preprocessData(rawData: any[]) {
    // Add technical indicators
    const enrichedData = TechnicalIndicators.calculateIndicators(rawData);

    // Feature matrix includes:
    const features = enrichedData.map(d => ([
      d.close_normalized,      // Normalized close price
      d.volume_normalized,     // Normalized volume
      d.rsi,                  // Relative Strength Index (0-100)
      d.macd,                 // MACD line
      d.macd_signal,          // MACD signal line
      d.bb_upper_dist,        // Distance to upper Bollinger Band
      d.bb_lower_dist,        // Distance to lower Bollinger Band
      d.atr_normalized,       // Average True Range (volatility)
      d.obv_normalized,       // On-Balance Volume
      d.momentum,             // Price momentum
      d.volatility            // Historical volatility
    ]));

    // Normalize features
    const normalizedFeatures = this.normalize(features);

    // Create sliding windows
    const { X, y } = this.createWindows(normalizedFeatures, 60);

    // Trading signal thresholds
    const labels = rawData.slice(1).map((candle, i) => {
      const priceChange = (candle.close - rawData[i].close) / rawData[i].close;
      
      if (priceChange > this.FEATURE_PARAMS.PRICE_CHANGE_THRESHOLD) return [1, 0, 0]; // Buy
      if (priceChange < -this.FEATURE_PARAMS.PRICE_CHANGE_THRESHOLD) return [0, 1, 0]; // Sell
      return [0, 0, 1]; // Hold
    });

    return {
      features: X,
      labels: y,
      featureNames: [
        'close', 'volume', 'rsi', 'macd', 'macd_signal',
        'bb_upper', 'bb_lower', 'atr', 'obv', 'momentum', 'volatility'
      ]
    };
  }

  private static normalize(data: number[][]) {
    const tensorData = tf.tensor2d(data);
    const min = tensorData.min(0);
    const max = tensorData.max(0);
    const normalized = tensorData.sub(min).div(max.sub(min));
    const result = normalized.arraySync() as number[][];
    tensorData.dispose();
    min.dispose();
    max.dispose();
    normalized.dispose();
    return result;
  }

  private static createWindows(data: number[][], windowSize: number) {
    const X = [];
    const y = [];
    
    for (let i = windowSize; i < data.length; i++) {
      X.push(data.slice(i - windowSize, i));
      y.push(data[i][0] > data[i-1][0] ? 1 : 0);
    }

    return { X, y };
  }
}
