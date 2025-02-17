import axios from 'axios';
import { CandleData } from '../interfaces.js';

export class DataManager {
  static async getTrainingData(params: { symbol: string, interval: string, lookback: number, useStoredData: boolean }): Promise<CandleData[]> {
    // Fetch historical data from an API or local storage
    const response = await axios.get(`https://api.binance.com/api/v3/klines?symbol=${params.symbol}&interval=${params.interval}&limit=${params.lookback}`);
    return response.data.map((d: any) => ({
      openTime: d[0],
      open: d[1],
      high: d[2],
      low: d[3],
      close: d[4],
      volume: d[5],
      closeTime: d[6],
      quoteVolume: d[7],
      trades: d[8],
      buyBaseVolume: d[9],
      buyQuoteVolume: d[10]
    }));
  }
}
