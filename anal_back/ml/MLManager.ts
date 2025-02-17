import * as tf from '@tensorflow/tfjs';
import { TrainingMetrics, TrainingHistory } from '../interfaces';
import { getDb } from '../database';
import { LSTMModel } from './models/LSTMModel';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class MLManager {
  private static instance: MLManager;
  private activeModel: LSTMModel | null = null;
  private modelsPath: string;

  private constructor() {
    this.modelsPath = join(__dirname, '../../data/models');
  }

  static getInstance(): MLManager {
    if (!MLManager.instance) {
      MLManager.instance = new MLManager();
    }
    return MLManager.instance;
  }

  async trainModel(config: {
    modelType: string;
    epochs: number;
    batchSize: number;
    windowSize: number;
    features: string[];
  }): Promise<{ metrics: TrainingMetrics; history: TrainingHistory }> {
    try {
      // Initialize model based on type
      const model = await this.initializeModel(config);
      
      // Train model
      const { metrics, history } = await this.trainModelInstance(model, config);
      
      // Save to database
      const db = await getDb();
      await db.run(`
        INSERT INTO ml_models (model_type, accuracy, config, metrics, status)
        VALUES (?, ?, ?, ?, ?)
      `, [
        config.modelType,
        metrics.accuracy,
        JSON.stringify(config),
        JSON.stringify(metrics),
        'active'
      ]);

      this.activeModel = model;
      return { metrics, history };
    } catch (error) {
      console.error('Training failed:', error);
      throw error;
    }
  }

  private async initializeModel(config: any): Promise<LSTMModel> {
    tf.engine().startScope();

    const model = new LSTMModel({
      windowSize: config.windowSize,
      features: config.features,
      hiddenLayers: [64, 32]
    });

    return model;
  }

  private async trainModelInstance(model: LSTMModel, config: any) {
    try {
      const { data, labels } = await this.prepareTrainingData(config);
      return await model.train(data, labels, {
        epochs: config.epochs,
        batchSize: config.batchSize,
        validationSplit: 0.2
      });
    } finally {
      tf.engine().disposeVariables();
    }
  }

  private async prepareTrainingData(config: any) {
    // Implement data preparation logic
    // This should fetch historical data and prepare it for training
    return {
      data: [],
      labels: []
    };
  }

  async predict(data: any): Promise<{ prediction: string; confidence: number }> {
    if (!this.activeModel) {
      throw new Error('No active model available');
    }
    
    // Implement prediction logic
    return { prediction: 'BUY', confidence: 0.85 };
  }
}
