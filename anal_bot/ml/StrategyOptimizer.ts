import * as tf from '@tensorflow/tfjs';  // Changed to use pure JS version
import { MarketData } from '../types';
import { Backtester } from '../backtesting/Backtester';
import { getDb } from '../../anal_back/database';
import { notifyBot } from '../../lib/services/telegram';
import { ModelStorage } from './ModelStorage';
import { getIO } from '../../lib/services/socket';
import { emitTrainingProgress } from '../../lib/services/socketService';

interface HyperParameters {
  lookbackWindow: number;
  lstmUnits: number;
  denseUnits: number;
  learningRate: number;
  batchSize: number;
  epochs: number;
}

export class StrategyOptimizer {
  private readonly parameterRanges = {
    lookbackWindow: [50, 100],  // Reduced ranges for faster training
    lstmUnits: [32, 64],
    denseUnits: [16, 32],
    learningRate: [0.001, 0.0005],
    batchSize: [32, 64],
    epochs: [30, 50]
  };

  private modelStorage = new ModelStorage();
  private lastTrainingData: MarketData[] = [];
  private readonly dataUpdateInterval = 4 * 60 * 60 * 1000; // 4 hours
  private lastDataUpdate = 0;

  private async getTrainingData(): Promise<MarketData[]> {
    const now = Date.now();
    if (
      this.lastTrainingData.length === 0 ||
      now - this.lastDataUpdate > this.dataUpdateInterval
    ) {
      console.log('Fetching fresh training data...');
      // Fetch last 30 days of data
      const newData = await this.fetchMarketData(30);
      this.lastTrainingData = newData;
      this.lastDataUpdate = now;
      
      await notifyBot(`📊 Updated training data
Dataset size: ${newData.length} candles
Time range: ${new Date(newData[0].timestamp).toISOString()} to ${new Date(newData[newData.length-1].timestamp).toISOString()}`);
    }
    return this.lastTrainingData;
  }

  private async fetchMarketData(days: number): Promise<MarketData[]> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - days * 24 * 60 * 60 * 1000);
      
      // Fetch data from your data source (e.g., Binance API)
      const response = await fetch(`/api/market-data?start=${startTime.getTime()}&end=${endTime.getTime()}`);
      const data = await response.json();
      
      return data;
    } catch (error) {
      console.error('Failed to fetch market data:', error);
      throw error;
    }
  }

  public async findOptimalParameters(trainingData?: MarketData[]): Promise<HyperParameters> {
    // Use provided data or fetch fresh data
    const data = trainingData || await this.getTrainingData();
    
    let bestParams: HyperParameters | null = null;
    let bestPerformance = -Infinity;

    for (const lookbackWindow of this.parameterRanges.lookbackWindow) {
      for (const lstmUnits of this.parameterRanges.lstmUnits) {
        for (const learningRate of this.parameterRanges.learningRate) {
          const params: HyperParameters = {
            lookbackWindow,
            lstmUnits,
            denseUnits: 32,
            learningRate,
            batchSize: 64,
            epochs: 50
          };

          const performance = await this.evaluateParameters(params, data);
          if (performance > bestPerformance) {
            bestPerformance = performance;
            bestParams = params;
          }

          console.log(`Parameters: `, params);
          console.log(`Performance: ${performance}`);
        }
      }
    }

    return bestParams!;
  }

  private emitProgress(data: any) {
    const emitted = emitTrainingProgress(data);
    if (!emitted) {
      console.warn('Failed to emit training progress');
    }
  }

  private async evaluateParameters(
    params: HyperParameters,
    data: MarketData[]
  ): Promise<number> {
    try {
      console.log('Starting model training...');
      
      // Send initial notification
      await notifyBot(`
🚀 Starting Model Training

Parameters:
• Window: ${params.lookbackWindow}
• LSTM Units: ${params.lstmUnits}
• Learning Rate: ${params.learningRate}
• Batch Size: ${params.batchSize}
• Epochs: ${params.epochs}

Dataset Size: ${data.length} candles
Time Range: ${new Date(data[0].timestamp).toLocaleString()} - ${new Date(data[data.length-1].timestamp).toLocaleString()}
      `.trim());

      // Log data information
      console.log(`Training with ${data.length} candles from ${new Date(data[0].timestamp).toISOString()} to ${new Date(data[data.length-1].timestamp).toISOString()}`);

      await notifyBot(`
🎯 Training Started
Dataset:
- Size: ${data.length} candles
- Start: ${new Date(data[0].timestamp).toLocaleDateString()}
- End: ${new Date(data[data.length-1].timestamp).toLocaleDateString()}

Parameters:
- Window: ${params.lookbackWindow}
- LSTM Units: ${params.lstmUnits}
- Learning Rate: ${params.learningRate}
- Batch Size: ${params.batchSize}
- Epochs: ${params.epochs}
      `);

      const model = this.buildModel(params);
      const { features, labels } = this.prepareTrainingData(data, params.lookbackWindow);
      
      // Split data into training and validation sets
      const splitIndex = Math.floor(features.length * 0.8);
      const trainFeatures = features.slice(0, splitIndex);
      const trainLabels = labels.slice(0, splitIndex);
      const valFeatures = features.slice(splitIndex);
      const valLabels = labels.slice(splitIndex);

      // Add memory management
      const tensors = tf.memory();
      console.log('Memory before training:', tensors);

      // Train with lower batch size
      this.emitProgress({
        status: 'Training started',
        totalEpochs: params.epochs
      });

      const history = await model.fit(
        tf.tensor3d(trainFeatures),
        tf.tensor2d(trainLabels),
        {
          epochs: params.epochs,
          batchSize: Math.min(32, params.batchSize), // Limit batch size
          validationData: [
            tf.tensor3d(valFeatures),
            tf.tensor2d(valLabels)
          ],
          verbose: 1, // Show progress
          callbacks: {
            onEpochEnd: (epoch, logs) => {
              console.log(`Epoch ${epoch + 1}: loss = ${logs?.loss.toFixed(4)}`);
              this.emitProgress({
                status: 'Training',
                epoch,
                totalEpochs: params.epochs,
                loss: logs?.loss,
                accuracy: logs?.acc * 100
              });
            },
            onTrainBegin: () => {
              this.emitProgress({
                status: 'Training started',
                totalEpochs: params.epochs
              });
            },
            onEpochBegin: (epoch) => {
              this.emitProgress({
                status: 'Training',
                epoch,
                totalEpochs: params.epochs
              });
            },
            onBatchEnd: (batch, logs) => {
              if (batch % 10 === 0) { // Update every 10 batches
                this.emitProgress({
                  status: 'Training',
                  epoch: logs?.epoch,
                  totalEpochs: params.epochs,
                  loss: logs?.loss,
                  accuracy: logs?.acc * 100
                });
              }
            },
            onTrainEnd: () => {
              this.emitProgress({
                status: 'Training completed'
              });
            }
          }
        }
      );

      // Save training history
      // await this.saveTrainingHistory(params, history.history);

      // Evaluate on validation set
      const predictions = model.predict(tf.tensor3d(valFeatures)) as tf.Tensor;
      const predictionsArray = await predictions.array() as number[][];
      const accuracy = this.calculateAccuracy(predictionsArray, valLabels);
      
      // Calculate metrics before notifications
      const returns = this.calculatePnL(predictionsArray, valLabels, data.slice(splitIndex));
      const pnl = returns.reduce((sum, ret) => sum + ret, 0) * 1000; // Convert returns to PnL
      const metrics = {
        accuracy,
        pnl,
        winRate: this.calculateWinRate(predictionsArray, valLabels),
        sharpeRatio: this.calculateSharpeRatio(returns)
      };

      // Save training history with more detailed metrics
      // await this.saveTrainingHistory(params, {
      //   ...history.history,
      //   metrics,
      //   timestamp: new Date().toISOString()
      // });

      // Notify end of training with detailed results
      await notifyBot(`
✅ Training Completed
Results:
🎯 Accuracy: ${(accuracy * 100).toFixed(2)}%
💰 PnL: ${pnl.toFixed(2)} USDT
📊 Win Rate: ${(metrics.winRate * 100).toFixed(2)}%
📈 Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}
      `);

      // Save the model
      await this.modelStorage.saveModel('latest', model, { accuracy });

      // Clean up tensors
      const cleanup = () => {
        model.dispose();
        predictions.dispose();
        tf.dispose(); // Clean up any remaining tensors
      };

      // Train model with memory cleanup
      try {
        // ...existing training code...
      } finally {
        cleanup();
      }

      // Save all data in one go
      const trainingRecord = {
        params: params,
        history: history.history,
        metrics: {
          accuracy,
          pnl,
          winRate: metrics.winRate,
          sharpeRatio: metrics.sharpeRatio,
          epochHistory: history.history,
          timestamp: new Date().toISOString()
        }
      };

      // Single save point
      await this.saveTrainingHistory(trainingRecord);

      // Clean up tensors
      tf.dispose([trainFeatures, trainLabels, valFeatures, valLabels]);
      model.dispose();
      
      console.log('Memory after cleanup:', tf.memory());

      return accuracy;
    } catch (error) {
      console.error('Training error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await notifyBot(`❌ Training Error: ${errorMessage}`);
      this.emitProgress({
        status: 'Training failed: ' + error.message
      });
      throw error;
    }
  }

  private async saveTrainingHistory(record: any) {
    try {
      const db = await getDb();
      console.log('Saving metrics:', record.metrics);
      
      const currentTime = new Date().toISOString();
      const dataToSave = {
        params: JSON.stringify(record.params),
        history: JSON.stringify(record.history || {}),
        metrics: JSON.stringify({
          ...record.metrics,
          timestamp: currentTime,
          pnl: record.metrics.pnl // Make sure PnL is included
        })
      };

      const result = await db.run(`
        INSERT INTO training_history (params, history, metrics, timestamp)
        VALUES (?, ?, ?, datetime('now'))
      `, [dataToSave.params, dataToSave.history, dataToSave.metrics]);

      console.log('Save result:', result);
      
      // Verify the save
      const saved = await db.get('SELECT * FROM training_history WHERE id = ?', result.lastID);
      if (saved) {
        console.log('Verified save - PnL:', JSON.parse(saved.metrics).pnl);
      }
    } catch (error) {
      console.error('Failed to save training history:', error);
      throw error;
    }
  }

  private buildModel(params: HyperParameters): tf.LayersModel {
    const model = tf.sequential();
    
    // Simplified model architecture for browser
    model.add(tf.layers.lstm({
      units: params.lstmUnits,
      returnSequences: false,  // Changed to false to reduce memory usage
      inputShape: [params.lookbackWindow, 8]
    }));

    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: params.denseUnits, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 3, activation: 'softmax' }));

    model.compile({
      optimizer: tf.train.adam(params.learningRate),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  private prepareTrainingData(data: MarketData[], lookbackWindow: number) {
    const features: number[][][] = [];
    const labels: number[][] = [];

    for (let i = lookbackWindow; i < data.length - 1; i++) {
      const window = data.slice(i - lookbackWindow, i);
      const nextPrice = data[i].close;
      const currentPrice = data[i - 1].close;

      // Calculate return
      const return_ = (nextPrice - currentPrice) / currentPrice;

      // Create one-hot encoded label
      let label;
      if (return_ > 0.002) label = [1, 0, 0];      // Buy
      else if (return_ < -0.002) label = [0, 1, 0]; // Sell
      else label = [0, 0, 1];                       // Hold

      features.push(this.extractFeatures(window));
      labels.push(label);
    }

    return { features, labels };
  }

  private extractFeatures(window: MarketData[]): number[][] {
    return window.map(candle => [
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume,
      (candle.high - candle.low) / candle.low, // Volatility
      (candle.close - candle.open) / candle.open, // Return
      candle.volume / window[0].volume // Volume ratio
    ]);
  }

  private calculateAccuracy(predictions: number[][], labels: number[][]): number {
    let correct = 0;
    for (let i = 0; i < predictions.length; i++) {
      const predClass = predictions[i].indexOf(Math.max(...predictions[i]));
      const trueClass = labels[i].indexOf(1);
      if (predClass === trueClass) correct++;
    }
    return correct / predictions.length;
  }

  private calculatePnL(predictions: number[][], labels: number[][], data: MarketData[]): number {
    let balance = 1000;
    const leverageUsed = 3;
    let trades = 0;
    let profitableTrades = 0;
  
    predictions.forEach((pred, i) => {
      const predictedClass = pred.indexOf(Math.max(...pred));
      if (predictedClass === 2) return; // Skip "hold" positions
      
      const price = data[i].close;
      const nextPrice = data[i + 1]?.close || price;
      
      trades++;
      let profit = 0;
      
      if (predictedClass === 0) { // Buy
        profit = ((nextPrice - price) / price) * leverageUsed * balance;
      } else if (predictedClass === 1) { // Sell
        profit = ((price - nextPrice) / price) * leverageUsed * balance;
      }
      
      if (profit > 0) profitableTrades++;
      balance += profit;
    });
  
    console.log('PnL Calculation:', {
      finalBalance: balance,
      totalProfit: balance - 1000,
      trades,
      profitableTrades,
      winRate: trades > 0 ? profitableTrades / trades : 0
    });
  
    return balance - 1000; // Return total profit/loss
  }

  private calculateWinRate(predictions: number[][], labels: number[][]): number {
    let wins = 0;
    let totalTrades = 0;

    predictions.forEach((pred, i) => {
      const predictedClass = pred.indexOf(Math.max(...pred));
      if (predictedClass !== 2) { // If not "hold"
        totalTrades++;
        if (predictedClass === labels[i].indexOf(1)) {
          wins++;
        }
      }
    });

    return totalTrades > 0 ? wins / totalTrades : 0;
  }

  private calculateSharpeRatio(returns: number[]): number {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length
    );
    return mean / (stdDev || 1); // Avoid division by zero
  }
}
