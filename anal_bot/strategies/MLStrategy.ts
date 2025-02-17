import { BaseStrategy } from './BaseStrategy';
import { MarketData, Trade } from '../types';
import * as tf from '@tensorflow/tfjs';  // Update to the correct TensorFlow package
import { notifyBot } from '../../lib/services/telegram';

export class MLStrategy extends BaseStrategy {
  private model!: tf.Sequential; // Add definite assignment assertion with !
  private windowSize: number;
  private readonly features = 5;
  private lastTrainingTime = 0;
  private readonly TRAINING_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MINIMUM_SAMPLES = 100; // Added minimum samples requirement
  private isTraining = false; // Added training lock
  private predictionCount = 0;  // Add this property

  constructor(config: any) {
    super(config);
    this.windowSize = config.mlConfig?.windowSize || 60;
    this.initModel();
  }

  private async initModel() {
    console.log('[MLStrategy] Creating model...');
    
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({
          units: 32,
          inputShape: [this.windowSize * this.features],
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 3,
          activation: 'softmax'
        })
      ]
    });

    this.model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    console.log('[MLStrategy] Model architecture:');
    this.model.summary();
  }

  private async saveMetrics(metrics: any) {
    try {
      const response = await fetch('/api/ml/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save metrics');
      }
    } catch (error) {
      console.error('Failed to save ML metrics:', error);
    }
  }

  protected async prepareData(data: MarketData[]) {
    console.log('[MLStrategy] Preparing data...');
    
    if (data.length < this.windowSize) {
      console.log('[MLStrategy] Not enough data points:', data.length);
      return null;
    }

    const features = data.map(d => [
      d.open / d.close, // Normalized price
      d.high / d.close,
      d.low / d.close,
      1.0, // Current close (normalized to itself)
      Math.log(d.volume) // Log volume
    ]);

    // Take last windowSize data points
    const window = features.slice(-this.windowSize);
    const flattened = window.flat();
    
    console.log('[MLStrategy] Data shape:', this.windowSize, 'x', this.features);
    return tf.tensor2d([flattened], [1, this.windowSize * this.features]);
  }

  // Add public training method
  public async train(data: MarketData[]): Promise<void> {
    await this.trainModel(data);
  }

  protected async trainModel(data: MarketData[]) {
    // Check requirements before sending any messages
    if (this.isTraining) {
      console.log('[MLStrategy] Training already in progress, skipping...');
      return;
    }

    if (data.length < this.MINIMUM_SAMPLES) {
      console.log(`[MLStrategy] Not enough data: ${data.length}/${this.MINIMUM_SAMPLES} samples required`);
      return;
    }

    this.isTraining = true;

    try {
      // Send single start message
      await notifyBot(`[ML Strategy] Starting Training
Dataset: ${data.length} samples
Window: ${this.windowSize} periods
Features: ${this.features}`);

      const batchSize = 32;
      const epochs = 50;

      // Create training data
      const X = [];
      const y = [];
      
      for (let i = this.windowSize; i < data.length - 1; i++) {
        const window = data.slice(i - this.windowSize, i);
        const nextPrice = data[i].close;
        const currentPrice = data[i - 1].close;
        
        const prepared = await this.prepareData(window);
        if (!prepared) continue;

        X.push(prepared.arraySync()[0]);
        
        // Create one-hot encoded target (buy/sell/hold)
        const priceChange = (nextPrice - currentPrice) / currentPrice * 100;
        if (priceChange > 0.5) y.push([1, 0, 0]); // buy
        else if (priceChange < -0.5) y.push([0, 1, 0]); // sell
        else y.push([0, 0, 1]); // hold
      }

      const xs = tf.tensor2d(X);
      const ys = tf.tensor2d(y);

      console.log('[MLStrategy] Training on shapes:', xs.shape, ys.shape);

      try {
        const history = await this.model.fit(xs, ys, {
          batchSize,
          epochs,
          validationSplit: 0.2,
          callbacks: {
            onEpochEnd: (epoch, logs) => {
              console.log(`[MLStrategy] Epoch ${epoch + 1}/${epochs}:`, logs);
            },
            onTrainEnd: async () => {
              // Send final results
              const metrics = history.history;
              const lastEpoch = metrics.acc.length - 1;
              await notifyBot(`[ML Strategy] Training Complete
Accuracy: ${(Number(metrics.acc[lastEpoch]) * 100).toFixed(2)}%
Loss: ${Number(metrics.loss[lastEpoch]).toFixed(4)}
Duration: ${epochs} epochs`);

              const finalAccuracy = Number(metrics.acc[lastEpoch]);
              const finalWinRate = Number(metrics.winRate[lastEpoch]);
              const metricsData = {
                accuracy: finalAccuracy,
                winRate: finalWinRate,
                totalPredictions: this.predictionCount,
                status: 'active'
              };

              await this.saveMetrics(metricsData);
            }
          }
        });

        xs.dispose();
        ys.dispose();

      } catch (error: unknown) {
        console.error('[MLStrategy] Training error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await notifyBot(`[ML Strategy] Training failed: ${errorMessage}`);
      }
    } finally {
      this.isTraining = false;
    }
  }

  public async analyze(data: MarketData[]): Promise<'buy' | 'sell' | 'hold'> {
    try {
      if (!this.model) {
        console.log('[MLStrategy] Model not initialized');
        return 'hold';
      }

      // Periodic training
      const now = Date.now();
      if (now - this.lastTrainingTime > this.TRAINING_INTERVAL) {
        console.log('[MLStrategy] Starting periodic training...');
        await this.trainModel(data);
        this.lastTrainingTime = now;
      }

      const input = await this.prepareData(data);
      if (!input) return 'hold';

      console.log('[MLStrategy] Making prediction...');
      const prediction = this.model.predict(input) as tf.Tensor;
      const [buy, sell, hold] = Array.from(await prediction.data());

      this.predictionCount++; // Increment counter on each prediction

      console.log('[MLStrategy] Prediction scores:', { buy, sell, hold });
      
      input.dispose();
      prediction.dispose();

      const threshold = 0.6;
      if (buy > threshold) return 'buy';
      if (sell > threshold) return 'sell';
      return 'hold';

    } catch (error) {
      console.error('[MLStrategy] Analysis error:', error);
      return 'hold';
    }
  }

  protected setTakeProfit(tradeId: string, price: number): void {
    console.log('[MLStrategy] Setting take profit:', tradeId, price);
  }

  protected setStopLoss(tradeId: string, price: number): void {
    console.log('[MLStrategy] Setting stop loss:', tradeId, price);
  }

  protected onOrderFilled(trade: Trade): void {
    console.log('[MLStrategy] Order filled:', trade);
    this.memory.addTrade(trade, this.historicalData.slice(-10));
  }
}
