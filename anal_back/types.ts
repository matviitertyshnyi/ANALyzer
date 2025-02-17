import { Request, Response, NextFunction } from 'express';

export type ExpressHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

export interface Position {
  id: string;
  coin: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  size: number;
  leverage: number;
  initialMargin: number;
  liquidationPrice: number;
  timestamp: Date;
  status: string;
}

export interface Trade {
  id: string;
  type: 'LONG' | 'SHORT';
  amount: number;
  leverage: number;
  timestamp: Date;
  price: number;
  size: number;
  status: string;
}
