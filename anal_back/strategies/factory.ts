import { BaseStrategy } from '../../anal_bot/strategies/BaseStrategy';
import { SimpleMACDStrategy } from '../../anal_bot/strategies/SimpleMACDStrategy';
import { MLStrategy } from '../../anal_bot/strategies/MLStrategy';
import { EnhancedStrategy } from '../../anal_bot/strategies/EnhancedStrategy';

export enum StrategyType {
  MACD = 'MACD',
  ML = 'ML',
  ENHANCED = 'ENHANCED'
}

export function createStrategy(type: StrategyType): BaseStrategy {
  const baseConfig = {
    symbol: 'BTCUSDT',
    interval: '1m',
    maxLeverage: 10,
    riskPerTrade: 5,
    stopLoss: 1,
    takeProfit: 2
  };

  switch (type) {
    case StrategyType.ML:
      return new MLStrategy({
        ...baseConfig,
        mlConfig: {
          windowSize: 60,
          confidenceThreshold: 0.6,
          trainingInterval: 24 * 60 * 60 * 1000
        }
      });
    case StrategyType.ENHANCED:
      return new EnhancedStrategy(baseConfig);
    default:
      return new SimpleMACDStrategy(baseConfig);
  }
}
