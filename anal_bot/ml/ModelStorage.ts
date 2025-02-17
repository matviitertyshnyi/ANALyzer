import * as tf from '@tensorflow/tfjs';
import { getDb } from '../../anal_back/database';
import path from 'path';
import fs from 'fs';

export class ModelStorage {
  private readonly MODEL_DIR = path.join(process.cwd(), 'data', 'models');

  constructor() {
    if (!fs.existsSync(this.MODEL_DIR)) {
      fs.mkdirSync(this.MODEL_DIR, { recursive: true });
    }
  }

  async saveModel(modelId: string, model: tf.LayersModel, metadata: any) {
    const modelPath = path.join(this.MODEL_DIR, modelId);
    await model.save(`file://${modelPath}`);
    
    const db = await getDb();
    await db.run(`
      UPDATE ml_models 
      SET 
        metrics = ?,
        last_training_time = CURRENT_TIMESTAMP,
        status = 'active'
      WHERE id = ?
    `, [JSON.stringify(metadata), modelId]);
  }

  async loadModel(modelId: string): Promise<{model: tf.LayersModel, metadata: any}> {
    const modelPath = path.join(this.MODEL_DIR, modelId);
    if (!fs.existsSync(modelPath)) {
      throw new Error('Model not found');
    }

    const model = await tf.loadLayersModel(`file://${modelPath}/model.json`);
    const db = await getDb();
    const result = await db.get('SELECT metrics FROM ml_models WHERE id = ?', modelId);
    
    return {
      model,
      metadata: JSON.parse(result.metrics)
    };
  }
}
