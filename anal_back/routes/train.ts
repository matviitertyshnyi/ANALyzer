import { Router, Request, Response } from 'express';
import { DataManager } from '../services/DataManager.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'Train route is working' });
});

router.post('/train', async (req: Request, res: Response) => {
  try {
    const trainingData = await DataManager.getTrainingData({
      symbol: req.body.symbol,
      interval: req.body.interval,
      lookback: req.body.lookback,
      useStoredData: req.body.useStoredData
    });
    res.json({ message: 'Training started successfully', trainingData });
  } catch (error) {
    console.error('Training failed:', error);
    res.status(500).json({ error: 'Training failed', details: error });
  }
});

export default router;
