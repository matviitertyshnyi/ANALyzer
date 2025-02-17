import * as tf from '@tensorflow/tfjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { getDb } from '../database';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ModelRepository {
  private static readonly MODEL_DIR = join(__dirname, '../../data/models');

  static async saveModel(modelId: number, model: tf.LayersModel, metadata: any) {
    // Ensure directory exists
    if (!fs.existsSync(this.MODEL_DIR)) {
      fs.mkdirSync(this.MODEL_DIR, { recursive: true });
    }

    const modelPath = join(this.MODEL_DIR, `model_${modelId}`);
    await model.save(`file://${modelPath}`);

    const db = await getDb();
    await db.run(`
      UPDATE ml_models 
      SET 
        weights_path = ?,
        metadata = ?,
        last_updated = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [modelPath, JSON.stringify(metadata), modelId]);
  }

  static async loadModel(modelId: number): Promise<{
    model: tf.LayersModel;
    metadata: any;
  }> {
    const db = await getDb();
    const modelData = await db.get(`
      SELECT weights_path, metadata
      FROM ml_models WHERE id = ?
    `, [modelId]);

    if (!modelData?.weights_path) {
      throw new Error('Model not found');
    }

    const model = await tf.loadLayersModel(`file://${modelData.weights_path}/model.json`);
    return {
      model,
      metadata: JSON.parse(modelData.metadata)
    };
  }

  static async updateModelMetrics(modelId: number, metrics: any) {
    const db = await getDb();
    await db.run(`
      UPDATE ml_models 
      SET 
        accuracy = ?,
        win_rate = ?,
        total_predictions = total_predictions + 1,
        metrics = ?
      WHERE id = ?
    `, [
      metrics.accuracy,
      metrics.winRate,
      JSON.stringify(metrics),
      modelId
    ]);
  }
}
