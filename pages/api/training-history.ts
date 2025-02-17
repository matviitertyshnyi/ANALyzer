import { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../anal_back/database';  // Fixed import path

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startTime = Date.now();
  console.log('=== Start Training History API ===');
  
  try {
    const db = await getDb();
    
    // Check database connection
    const dbTest = await db.get('SELECT sqlite_version()');
    console.log('Database connection test:', dbTest);

    // Verify table structure
    const tableInfo = await db.all("PRAGMA table_info('training_history')");
    console.log('Table structure:', tableInfo);

    // Get record count
    const count = await db.get('SELECT COUNT(*) as count FROM training_history');
    console.log('Total records:', count);

    // Get actual records
    const history = await db.all(`
      SELECT id, params, metrics, timestamp,
             json_valid(params) as valid_params,
             json_valid(metrics) as valid_metrics
      FROM training_history 
      ORDER BY timestamp DESC 
      LIMIT 100
    `);

    console.log(`Found ${history.length} records`);
    console.log('First record:', history[0]);

    const parsedHistory = history.map(entry => {
      try {
        return {
          id: entry.id,
          timestamp: entry.timestamp,
          params: JSON.parse(entry.params || '{}'),
          metrics: JSON.parse(entry.metrics || '{}')
        };
      } catch (error) {
        console.error('Failed to parse entry:', entry, error);
        return null;
      }
    }).filter(Boolean);

    console.log(`Successfully parsed ${parsedHistory.length} records`);
    console.log(`API call took ${Date.now() - startTime}ms`);
    console.log('=== End Training History API ===');

    res.status(200).json(parsedHistory);
  } catch (error) {
    console.error('Training history API error:', error);
    res.status(500).json({ error: 'Failed to fetch training history' });
  }
}
