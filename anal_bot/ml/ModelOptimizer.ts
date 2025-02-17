import * as tf from '@tensorflow/tfjs-node';
import { MarketData } from '../types';

export class ModelOptimizer {
  private model: tf.Sequential;

  constructor() {
    this.model = this.buildModel();
  }

  private buildModel(): tf.Sequential {
    const model = tf.sequential();
    
    model.add(tf.layers.lstm({
      units: 50,
      returnSequences: true,
      inputShape: [100, 5] // 100 timeframes, 5 features
    }));
    
    model.add(tf.layers.dropout(0.2));
    model.add(tf.layers.lstm({ units: 30 }));
    model.add(tf.layers.dense({ units: 3, activation: 'softmax' }));

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  public async train(data: MarketData[], labels: number[]): Promise<void> {
    // Prepare data for training
    const features = this.prepareFeatures(data);
    const targetLabels = tf.oneHot(labels, 3); // 3 classes: buy, sell, hold

    await this.model.fit(features, targetLabels, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch}: loss = ${logs?.loss.toFixed(4)}`);
        }
      }
    });
  }

  public predict(data: MarketData[]): number {
    const features = this.prepareFeatures(data);
    const prediction = this.model.predict(features) as tf.Tensor;
    return prediction.argMax(-1).dataSync()[0];
  }

  private prepareFeatures(data: MarketData[]): tf.Tensor {
    // Convert market data to tensor format
    const features = data.map(d => [
      d.open, d.high, d.low, d.close, d.volume
    ]);
    
    return tf.tensor3d([features], [1, features.length, 5]);
  }
}
