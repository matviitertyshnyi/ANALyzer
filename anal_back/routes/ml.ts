import { Router } from 'express';
import { MLManager } from '../ml/MLManager';

const router = Router();

router.post('/train', async (req, res) => {
  try {
    const { modelType, config } = req.body;
    const mlManager = MLManager.getInstance();
    const result = await mlManager.trainModel({
      modelType,
      ...config
    });
    res.json(result);
  } catch (error) {
    console.error('Training failed:', error);
    res.status(500).json({ error: 'Training failed' });
  }
});

router.post('/predict', async (req, res) => {
  try {
    const { data } = req.body;
    const mlManager = MLManager.getInstance();
    const prediction = await mlManager.predict(data);
    res.json(prediction);
  } catch (error) {
    console.error('Prediction failed:', error);
    res.status(500).json({ error: 'Prediction failed' });
  }
});

export default router;
