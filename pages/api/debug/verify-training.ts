import { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../../anal_back/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const db = await getDb();
    
    // Test insert
    const testData = {
      params: JSON.stringify({ test: 'params' }),
      history: JSON.stringify({ test: 'history' }),
      metrics: JSON.stringify({ accuracy: 0.5 })
    };

    const result = await db.run(`
      INSERT INTO training_history (params, history, metrics)
      VALUES (?, ?, ?)
    `, [testData.params, testData.history, testData.metrics]);

    // Verify insert
    const record = await db.get('SELECT * FROM training_history WHERE id = ?', result.lastID);

    res.status(200).json({
      insertResult: result,
      verification: record,
      success: !!record
    });
  } catch (error) {
    console.error('Verification failed:', error);
    res.status(500).json({ error: String(error) });
  }
}
