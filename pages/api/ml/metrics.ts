import { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../../anal_back/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const db = await getDb();
    
    // Get the latest training record
    const latestTraining = await db.get(`
      SELECT metrics FROM training_history 
      ORDER BY timestamp DESC LIMIT 1
    `);

    if (!latestTraining) {
      return res.status(200).json({
        accuracy: 0,
        winRate: 0,
        pnl: 0,
        totalTrades: 0,
        sharpeRatio: 0,
        maxDrawdown: 0
      });
    }

    const metrics = JSON.parse(latestTraining.metrics);
    console.log('Latest metrics:', metrics); // Debug log

    res.status(200).json(metrics);
  } catch (error) {
    console.error('Failed to fetch ML metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
}
