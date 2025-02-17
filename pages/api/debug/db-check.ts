import { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../../anal_back/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const db = await getDb();
    
    const dbInfo = {
      version: await db.get('SELECT sqlite_version()'),
      tables: await db.all("SELECT name FROM sqlite_master WHERE type='table'"),
      trainingHistory: {
        structure: await db.all("PRAGMA table_info('training_history')"),
        count: await db.get('SELECT COUNT(*) as count FROM training_history'),
        lastRecord: await db.get('SELECT * FROM training_history ORDER BY id DESC LIMIT 1')
      }
    };

    res.status(200).json(dbInfo);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}
