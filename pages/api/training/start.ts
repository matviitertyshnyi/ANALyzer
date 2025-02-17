import { NextApiRequest, NextApiResponse } from 'next';
import { StrategyOptimizer } from '../../../anal_bot/ml/StrategyOptimizer';
import { fetchHistoricalData } from '../../../lib/services/binance';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting training...');
    const data = await fetchHistoricalData('BTCUSDT', '1h', 1000);
    const optimizer = new StrategyOptimizer();
    
    optimizer.findOptimalParameters(data)
      .then(() => console.log('Training completed'))
      .catch(error => console.error('Training failed:', error));

    res.status(200).json({ message: 'Training started' });
  } catch (error) {
    console.error('Failed to start training:', error);
    res.status(500).json({ error: 'Failed to start training' });
  }
}
