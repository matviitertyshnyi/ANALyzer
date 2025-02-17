import * as tf from '@tensorflow/tfjs-node-gpu';  // Use tfjs-node-gpu for GPU acceleration
import { DataManager } from './DataManager.js';
import { TRADING_CONFIG } from '../config/tradingConfig.js';
import { ML_CONFIG } from '../config/mlConfig.js';
import { notifyBot } from '../../lib/services/telegram.js';
import { resolve } from 'path';

// ...existing code...

export class MLModelService {
  private windowSize: number = ML_CONFIG.WINDOW_SIZE;  // Add the window size property
  private model: tf.LayersModel;

  private async loadOrCreateModel(): Promise<tf.LayersModel> {
    try {
      const modelPath = `file://${this.modelPath}/model.json`;
      this.model = await tf.loadLayersModel(modelPath);
      console.log('Loaded existing model');
      return this.model;
    } catch (e) {
      console.log('Creating new model');
      return this.createModel();
    }
  }

  private createModel(): tf.LayersModel {
    const model = tf.sequential();
    const inputShape = [this.windowSize, 8];
    model.add(tf.layers.lstm({
      units: 32,
      inputShape: inputShape,
      returnSequences: false,
      activation: 'relu'
    }));
    model.add(tf.layers.dense({
      units: 3,
      activation: 'softmax'
    }));
    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    console.log('Model Summary:');
    model.summary();
    return model;
  }

  private prepareTrainingData(data: any[]): { features: number[][][], labels: number[][] } {
    const features: number[][][] = [];
    const labels: number[][] = [];

    for (let i = this.windowSize; i < data.length; i++) {
      const window = data.slice(i - this.windowSize, i);
      const normalizedWindow = window.map(candle => [
        Number(candle.open),
        Number(candle.high),
        Number(candle.low),
        Number(candle.close),
        Number(candle.volume),
        Number(candle.ma),
        Number(candle.rsi),
        Number(candle.macd)
      ]);
      features.push(normalizedWindow);

      // Create one-hot encoded labels
      const nextCandle = data[i];
      const priceChange = ((nextCandle.close - window[window.length - 1].close) / window[window.length - 1].close) * 100;
      labels.push([
        priceChange < -0.1 ? 1 : 0,  // Down
        Math.abs(priceChange) <= 0.1 ? 1 : 0,  // Sideways
        priceChange > 0.1 ? 1 : 0  // Up
      ]);
    }

    return { features, labels };
  }

  async train(symbol: string, interval: string): Promise<void> {
    await tf.ready();
    
    try {
      console.log(`Fetching data for ${symbol}...`);
      const rawData = await DataManager.getTrainingData({
        symbol,
        interval,
        lookback: 1000,
        useStoredData: true
      });

      // Transform raw candle data into features and labels
      const { features, labels } = this.prepareTrainingData(rawData);

      // Create tensors from prepared data
      const featuresTensor = tf.tensor3d(features);
      const labelsTensor = tf.tensor2d(labels);

      // Train model with prepared data
      const history = await this.model.fit(featuresTensor, labelsTensor, {
        epochs: ML_CONFIG.TRAINING.EPOCHS,
        batchSize: ML_CONFIG.TRAINING.BATCH_SIZE,
        validationSplit: 0.2,
        shuffle: true,
        verbose: 1,
        callbacks: {
          onEpochEnd: async (epoch, logs) => {
            const progress = `Epoch ${epoch + 1}/${ML_CONFIG.TRAINING.EPOCHS}:
Accuracy: ${((logs?.acc ?? 0) * 100).toFixed(2)}%
Loss: ${(logs?.loss ?? 0).toFixed(4)}`;
            
            if (epoch % 10 === 0) {
              await notifyBot(`📊 Training Progress\n${progress}`);
            }
            console.log(progress);
          }
        }
      });

      // Log final training stats
      console.log('Training completed.');
      const finalLoss = typeof history.history.loss[history.history.loss.length - 1] === 'number' 
        ? history.history.loss[history.history.loss.length - 1] 
        : (history.history.loss[history.history.loss.length - 1] as tf.Tensor).dataSync()[0];
      console.log(`Final Loss: ${Number(finalLoss).toFixed(4)}`);
      console.log(`Final Accuracy: ${(Number(history.history.acc[history.history.acc.length - 1]) * 100).toFixed(2)}%`);

      // Notify final training stats
      await notifyBot(`✅ Training Completed
Final Loss: ${Number(finalLoss).toFixed(4)}
Final Accuracy: ${(Number(history.history.acc[history.history.acc.length - 1]) * 100).toFixed(2)}%`);

      // ...existing code...
    } catch (error) {
      console.error("Training error:", error);
      throw error;
    }
  }
}
