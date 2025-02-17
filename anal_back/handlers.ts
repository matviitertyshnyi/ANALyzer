import { Request, Response, NextFunction } from 'express';
import { getDb } from './database.js';
import { calculateLiquidationPrice, formatPositionType, calculatePercentage } from './utils.js';
import { Trade, Position, PositionType } from './interfaces.js';
import { Database } from 'sqlite';

export const getPositions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const db: Database = await getDb();
    const positions = await db.all<Trade[]>('SELECT * FROM trades WHERE status = "open" ORDER BY timestamp DESC');
    const mapped = positions.map((p: Trade): Position => {
      const exposure = parseFloat(p.size) * parseFloat(p.price);
      const position: Position = {
        id: p.id.toString(),
        coin: 'BTCUSDT',
        type: formatPositionType(p.type),
        entryPrice: parseFloat(p.price),
        size: parseFloat(p.size),
        leverage: parseInt(p.leverage),
        initialMargin: parseFloat(p.amount),
        exposure,
        percentage: 0, // Initialize with 0
        liquidationPrice: calculateLiquidationPrice(p),
        timestamp: new Date(p.timestamp),
        status: p.status
      };
      position.percentage = calculatePercentage(position);
      return position;
    });
    res.json(mapped);
  } catch (error: unknown) {
    console.error('Failed to fetch positions:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
};

// ...other handlers...
