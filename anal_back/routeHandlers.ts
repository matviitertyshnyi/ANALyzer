import { Router, RequestHandler } from 'express';
import { getDb } from './database';  // Fixed import to use getDb instead of initDb
import { calculateLiquidationPrice } from './utils';

export function createRoutes(): Router {
  const router = Router();

  const positionsHandler: RequestHandler = async (req, res) => {
    try {
      const db = await getDb();  // Using getDb instead of initDb
      const positions = await db.all('SELECT * FROM trades WHERE status = "open" ORDER BY timestamp DESC');
      const mapped = positions.map(p => ({
        id: p.id.toString(),
        coin: 'BTCUSDT',
        type: p.type,
        entryPrice: parseFloat(p.price),
        size: parseFloat(p.size),
        leverage: parseInt(p.leverage),
        initialMargin: parseFloat(p.amount),
        exposure: parseFloat(p.size) * parseFloat(p.price),
        liquidationPrice: calculateLiquidationPrice(p),
        timestamp: new Date(p.timestamp),
        status: p.status
      }));
      res.json(mapped);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch positions' });
    }
  };

  router.get('/positions', positionsHandler);
  
  return router;
}