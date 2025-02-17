import { Router, Request, Response } from 'express';
// Updated import with explicit extension
import { getDb } from '../database.js'; 
import { TrainingMetrics, TrainingHistory, TypedRequest } from '../interfaces';
import { notifyBot } from '../../lib/services/telegram.js';
import { emitTrainingProgress } from '../services/socketService.js';
import { startTraining } from '../services/trainingService.js';  // NEW import

const router = Router();

interface TrainingHistoryRecord {
  id: number;
  params: string;
  metrics: string;
  history: string;
  timestamp: string;
}

// NEW: Add route for POST / (to handle /api/train)
router.post('/', async (req, res) => {
  console.log("POST /api/train received"); // Debug log to check request arrival
  // Start training asynchronously without blocking the HTTP response
  startTraining().catch(error => {
    console.error("Training failed:", error);
  });
  res.json({ success: true, message: 'Training initiated' });
});

router.get('/training-history', async (_: Request, res: Response) => {
  try {
    console.log('=== Start Training History API ===');
    const db = await getDb();
    
    // Verify database connection and table structure
    const version = await db.get('SELECT sqlite_version()');
    console.log('Database connection test:', version);
    
    const tableInfo = await db.all('PRAGMA table_info(training_history)');
    console.log('Table structure:', tableInfo);
    
    const count = await db.get('SELECT COUNT(*) as count FROM training_history');
    console.log('Total records:', count);

    const history = await db.all<TrainingHistoryRecord[]>(`
      SELECT * FROM training_history ORDER BY timestamp DESC LIMIT 100
    `);
    console.log(`Found ${history.length} records`);
    
    if (history.length > 0) {
      console.log('First record:', history[0]);
    }

    const parsedHistory = history.map(entry => ({
      id: entry.id,
      timestamp: entry.timestamp,
      params: JSON.parse(entry.params || '{}'),
      metrics: JSON.parse(entry.metrics || '{}') as TrainingMetrics,
      history: JSON.parse(entry.history || '{}') as TrainingHistory
    }));

    console.log('Successfully parsed', parsedHistory.length, 'records');
    res.json(parsedHistory);
  } catch (error) {
    console.error('Training history API error:', error);
    res.status(500).json({ error: 'Failed to fetch training history' });
  }
});

router.post('/training-history', async (req: TypedRequest<{
  params: any;
  metrics: any;
  history: any;
}>, res: Response) => {
  try {
    const db = await getDb();
    await db.run(`
      INSERT INTO training_history (
        params,
        metrics,
        history,
        timestamp
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      JSON.stringify(req.body.params || {}),
      JSON.stringify(req.body.metrics || {}),
      JSON.stringify(req.body.history || {})
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to save training history:', error);
    res.status(500).json({ error: 'Failed to save training history' });
  }
});

router.post('/training-progress', async (req: TypedRequest<{
  epoch: number;
  loss: number;
  metrics?: any;
}>, res: Response) => {
  try {
    console.log(`Training progress - Epoch ${req.body.epoch}: loss = ${req.body.loss}`);
    
    // Emit progress via socket
    emitTrainingProgress(req.body);
    
    // Send Telegram notification every 5 epochs
    if (req.body.epoch % 5 === 0) {
      try {
        const memoryInfo = tf.memory(); // removed await here, tf.memory() is synchronous 
        await notifyBot(`📊 Training Progress
Epoch ${req.body.epoch}
Loss: ${req.body.loss.toFixed(4)}
Memory: ${(memoryInfo.numBytes / 1024 / 1024).toFixed(2)}MB`);
      } catch (error) {
        console.warn('Failed to send progress notification:', error);
      }
    }
    
    // Enhanced GPU memory management
    if (req.body.epoch % 2 === 0) {
      tf.engine().endScope();
      const memInfo = tf.memory(); // removed await here as well
      console.log('GPU Memory Stats:', {
        numBytes: Math.round(memInfo.numBytes / 1024 / 1024) + 'MB',
        numTensors: memInfo.numTensors,
        numDataBuffers: memInfo.numDataBuffers,
        unreliable: memInfo.unreliable,
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to handle training progress:', error);
    res.status(500).json({ error: 'Failed to handle training progress' });
  }
});

export default router;
