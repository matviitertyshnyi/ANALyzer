import * as tf from '@tensorflow/tfjs';  // Update to the correct TensorFlow package
import fs from 'fs';
import path from 'path';

export class ModelPersistence {
  private readonly modelsDir: string;

  constructor() {
    this.modelsDir = path.join(process.cwd(), 'data', 'models');
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
    }
  }

  public async saveModel(model: tf.LayersModel, metadata: any, name: string): Promise<void> {
    const modelPath = path.join(this.modelsDir, name);
    await model.save(`file://${modelPath}`);
    fs.writeFileSync(
      path.join(modelPath, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
  }

  public async loadModel(name: string): Promise<{
    model: tf.LayersModel;
    metadata: any;
  }> {
    const modelPath = path.join(this.modelsDir, name);
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model ${name} not found`);
    }
    const model = await tf.loadLayersModel(`file://${modelPath}/model.json`);
    const metadata = JSON.parse(
      fs.readFileSync(path.join(modelPath, 'metadata.json'), 'utf-8')
    );
    return { model, metadata };
  }
}
