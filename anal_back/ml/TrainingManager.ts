import { getDb } from '../database.js';
import { notifyBot } from '../../lib/services/telegram.js';
import { MLManager } from './MLManager.js';
import { fetchHistoricalData } from '../../lib/services/binance.js';
import { DataPreprocessor } from './DataPreprocessor.js';
import { ModelValidator } from './ModelValidator.js';
import { PnLTracker } from './PnLTracker.js';
import { ExperienceMemory } from './ExperienceMemory.js';
import { ModelRepository } from './ModelRepository.js';
import { TRADING_CONFIG } from '../config/tradingConfig.js';
import { emitTrainingProgress } from '../services/socketService.js';
import { DataManager } from '../services/DataManager.js'; // Fix extension

export class TrainingManager {
  private static instance: TrainingManager;
  private isTraining: boolean = false;
  private mlManager: MLManager;
  private activeModelId: number | null = null;
  private currentConfig: any = null;

  private constructor() {
    this.mlManager = MLManager.getInstance();
  }

  static getInstance(): TrainingManager {
    if (!TrainingManager.instance) {
      TrainingManager.instance = new TrainingManager();
    }
    return TrainingManager.instance;
  }

  async startTraining(config: {
    symbol: string;
    interval: string;
    lookback: number;
    epochs: number;
    autoRetrain?: boolean;
  }) {
    if (this.isTraining) {
      throw new Error('Training already in progress');
    }

    try {
      this.isTraining = true;
      this.currentConfig = {
        ...config,
        batchSize: TRADING_CONFIG.TRAINING.BATCH_SIZE,
        validationSplit: TRADING_CONFIG.TRAINING.VALIDATION_SPLIT,
        features: TRADING_CONFIG.TRAINING.FEATURES
      };

      await notifyBot(`🎯 Starting ML Training
Symbol: ${config.symbol}
Interval: ${config.interval}
Lookback: ${config.lookback} days
Epochs: ${config.epochs}
Batch Size: ${TRADING_CONFIG.TRAINING.BATCH_SIZE}`);

      // Get fresh or alternative training data
      const data = await DataManager.getTrainingData({
        symbol: config.symbol,
        interval: config.interval,
        lookback: config.lookback,
        useStoredData: this.activeModelId !== null // Use alternative data for retraining
      });

      const { features, labels } = DataPreprocessor.preprocessData(data);

      // Load and mix in previous experiences
      const experiences = await ExperienceMemory.getExperienceBatch(
        this.activeModelId,
        config.batchSize * 10
      );

      if (experiences.length > 0) {
        // Mix experiences with new data
        const mixedData = this.mixTrainingData(features, experiences);
        await this.trainWithMixedData(mixedData);
      }

      // Regular training
      const startTime = Date.now();
      const result = await this.mlManager.trainModel({
        modelType: 'LSTM',
        epochs: config.epochs,
        batchSize: 32,
        windowSize: 60,
        features: featureNames,
        onEpochEnd: (epoch: number, logs: any) => {
          emitTrainingProgress({
            epoch,
            loss: logs.loss,
            metrics: {
              accuracy: logs.accuracy
            }
          });
        }
      });

      // Save model with metadata
      await ModelRepository.saveModel(this.activeModelId, this.mlManager.getModel(), {
        config,
        metrics: result.metrics,
        lastTraining: new Date()
      });

      // Prune old experiences
      await ExperienceMemory.pruneOldExperiences(this.activeModelId);

      // Validate model
      const modelId = await this.saveModel(result, config);
      const performance = await PnLTracker.getModelPerformance(modelId);

      await notifyBot(`💰 Model PnL Metrics:
Win Rate: ${(performance.winRate * 100).toFixed(1)}%
Profit Factor: ${performance.profitFactor.toFixed(2)}
Sharpe Ratio: ${performance.sharpeRatio.toFixed(2)}
Max Drawdown: ${(performance.maxDrawdown * 100).toFixed(1)}%
Expectancy: ${performance.expectancy}% per trade`);

      if (!performance.isProfileProductive && config.autoRetrain) {
        await this.scheduleRetraining(config);
      }

      // Save training results
      const db = await getDb();
      await db.run(`
        INSERT INTO training_history (
          params,
          metrics,
          history,
          timestamp
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        JSON.stringify(config),
        JSON.stringify(result.metrics),
        JSON.stringify(result.history)
      ]);

      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      await notifyBot(`✅ Training Complete
Duration: ${duration} minutes
Accuracy: ${(result.metrics.accuracy * 100).toFixed(1)}%
Loss: ${result.metrics.loss.toFixed(4)}`);

    } catch (error: any) {
      await notifyBot(`❌ Training Failed
Error: ${error.message}`);
      throw error;
    } finally {
      this.isTraining = false;
    }
  }

  async trainAllPairs() {
    const pairs = TRADING_CONFIG.TRAINING.PAIRS_STRATEGY.TRAINING_ORDER;
    
    for (const pair of pairs) {
      await notifyBot(`🔄 Starting training for ${pair}`);
      
      try {
        await this.startTraining({
          symbol: pair,
          interval: '1h',
          lookback: TRADING_CONFIG.TRAINING.LOOKBACK_DAYS,
          epochs: TRADING_CONFIG.TRAINING.EPOCHS,
          autoRetrain: true
        });

        // Wait between pairs to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 5000));

      } catch (error: any) {
        await notifyBot(`⚠️ Failed training ${pair}: ${error.message}`);
        continue; // Continue with next pair even if one fails
      }
    }

    await notifyBot('✅ Completed training for all pairs');
  }

  private async validatePair(symbol: string): Promise<boolean> {
    try {
      const last24h = await fetchHistoricalData(symbol, '1d', 1);
      const volume24h = last24h[0].volume * last24h[0].close;
      
      return volume24h >= TRADING_CONFIG.TRAINING.PAIRS_STRATEGY.MIN_VOLUME_24H;
    } catch (error) {
      return false;
    }
  }

  private async saveModel(result: any, config: any) {
    const db = await getDb();
    const { lastID } = await db.run(`
      INSERT INTO ml_models (
        model_type,
        accuracy,
        config,
        metrics,
        status
      ) VALUES (?, ?, ?, ?, ?)
    `, [
      'LSTM',
      result.metrics.accuracy,
      JSON.stringify(config),
      JSON.stringify(result.metrics),
      'active'
    ]);
    return lastID;
  }

  private async scheduleRetraining(config: any) {
    // Schedule retraining after 24 hours
    setTimeout(() => {
      this.startTraining({
        ...config,
        lookback: config.lookback * 2 // Double the training data
      });
    }, 24 * 60 * 60 * 1000);
  }

  private prepareTrainingData(data: any[]) {
    const features = data.map((candle, index) => {
      const macdResult = this.calculateMACD(data.slice(0, index + 1));
      const bbResult = this.calculateBollingerBands(data.slice(0, index + 1));
      
      return {
        close: candle.close,
        volume: candle.volume,
        high: candle.high,
        low: candle.low,
        rsi: this.calculateRSI(data.slice(0, index + 1)),
        macd: macdResult.macd,
        macd_signal: macdResult.signal,
        macd_hist: macdResult.histogram,
        bb_upper: bbResult.upper,
        bb_middle: bbResult.middle,
        bb_lower: bbResult.lower,
        hl_ratio: candle.high / candle.low,
        close_sma: this.calculateSMA(data.slice(0, index + 1).map(d => d.close), 20)
      };
    });

    // Generate more sophisticated labels
    const labels = data.slice(1).map((candle, i) => {
      const priceChange = (candle.close - data[i].close) / data[i].close;
      const threshold = 0.002; // 0.2% threshold
      
      if (priceChange > threshold) return 1; // Buy
      if (priceChange < -threshold) return 0; // Sell
      return 0.5; // Hold
    });

    return { features, labels };
  }

  private calculateRSI(data: any[], period: number = 14): number {
    if (data.length < period) return 50; // Default value if not enough data

    const changes = data.slice(1).map((value, index) => 
      value.close - data[index].close
    );

    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? -change : 0);

    // Calculate average gain and loss
    const avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period;
    const avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period;

    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(data: any[]): { macd: number; signal: number; histogram: number } {
    const fastPeriod = 12;
    const slowPeriod = 26;
    const signalPeriod = 9;
    const closes = data.map(d => d.close);

    // Calculate EMAs
    const fastEMA = this.calculateEMA(closes, fastPeriod);
    const slowEMA = this.calculateEMA(closes, slowPeriod);
    
    // Calculate MACD line
    const macdLine = fastEMA - slowEMA;
    
    // Calculate Signal line (9-day EMA of MACD line)
    const signalLine = this.calculateEMA([macdLine], signalPeriod);
    
    // Calculate histogram
    const histogram = macdLine - signalLine;

    return {
      macd: macdLine,
      signal: signalLine,
      histogram: histogram
    };
  }

  private calculateBollingerBands(data: any[], period: number = 20, multiplier: number = 2): {
    upper: number;
    middle: number;
    lower: number;
  } {
    const closes = data.map(d => d.close);
    
    // Calculate middle band (SMA)
    const middle = this.calculateSMA(closes, period);
    
    // Calculate standard deviation
    const stdDev = this.calculateStandardDeviation(closes, period);
    
    // Calculate upper and lower bands
    const upper = middle + (multiplier * stdDev);
    const lower = middle - (multiplier * stdDev);

    return { upper, middle, lower };
  }

  private calculateEMA(data: number[], period: number): number {
    const multiplier = 2 / (period + 1);
    let ema = data[0];
    
    for (let i = 1; i < data.length; i++) {
      ema = (data[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  private calculateSMA(data: number[], period: number): number {
    return data.slice(-period).reduce((sum, value) => sum + value, 0) / period;
  }

  private calculateStandardDeviation(data: number[], period: number): number {
    const sma = this.calculateSMA(data, period);
    const squareDiffs = data.slice(-period).map(value => Math.pow(value - sma, 2));
    const variance = squareDiffs.reduce((sum, value) => sum + value, 0) / period;
    return Math.sqrt(variance);
  }

  private async trainWithExperiences(experiences: any) {
    // Train on past experiences to maintain knowledge
    await this.mlManager.trainModel({
      ...this.currentConfig,
      epochs: 10,
      batchSize: 32,
      data: experiences.data,
      labels: experiences.labels
    });
  }

  private mixTrainingData(newData: any[], experiences: any[]) {
    // Randomly mix new data with experiences
    const mixed = [...newData];
    experiences.forEach(exp => {
      const insertIndex = Math.floor(Math.random() * mixed.length);
      mixed.splice(insertIndex, 0, exp);
    });
    return mixed;
  }

  private async trainWithMixedData(mixedData: any) {
    // Train on mixed data
    await this.mlManager.trainModel({
      ...this.currentConfig,
      epochs: 10,
      batchSize: 32,
      data: mixedData.data,
      labels: mixedData.labels
    });
  }

  async recordTradeExperience(trade: any) {
    await ExperienceMemory.saveExperience({
      modelId: this.activeModelId,
      features: trade.features,
      action: trade.type === 'LONG' ? 1 : 0,
      reward: trade.pnl > 0 ? 1 : -1,
      nextFeatures: trade.exitFeatures,
      timestamp: new Date()
    });
  }
}
