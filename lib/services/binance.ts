import axios from 'axios';

const BINANCE_API_URL = 'https://api.binance.com/api/v3';

export interface HistoricalDataParams {
  symbol: string;
  interval: string;
  startTime: number;
  endTime: number;
  limit?: number;
}

export async function fetchHistoricalData({ symbol, interval, startTime, endTime, limit = 1000 }: HistoricalDataParams) {
  try {
    const response = await axios.get(`${BINANCE_API_URL}/klines`, {
      params: {
        symbol: symbol.toUpperCase(),
        interval,
        startTime,
        endTime,
        limit
      }
    });
    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Invalid response from Binance API');
    }
    return response.data.map(candle => ({
      timestamp: Number(candle[0]),
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5])
    }));
  } catch (error) {
    console.error("Binance fetchHistoricalData error:", error);
    throw error;
  }
}
