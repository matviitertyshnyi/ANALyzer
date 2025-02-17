import { NextApiRequest, NextApiResponse } from 'next';
import { fetchCandlestickData } from '../../lib/services/binance';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { start, end } = req.query;
    const startTime = parseInt(start as string);
    const endTime = parseInt(end as string);

    const data = await fetchCandlestickData('BTCUSDT', '1m', startTime, endTime);
    res.status(200).json(data);
  } catch (error) {
    console.error('Failed to fetch market data:', error);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
}
