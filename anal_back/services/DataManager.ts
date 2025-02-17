import { getDb } from '../database.js';
import { fetchHistoricalData } from '../../lib/services/binance.js';
import { TechnicalIndicators } from './TechnicalIndicators.js';
// import { CandleData } from '../interfaces';

interface TrainingDataParams {
  symbol: string;
  interval: string;
  lookback: number;
  useStoredData?: boolean;
}

export class DataManager {
  static async getTrainingData({ 
    symbol, 
    interval, 
    startTime, 
    endTime, 
    useStoredData = true 
  }): Promise<RawDataPoint[]> {
    try {
      console.log(`Fetching ${symbol} ${interval} data from ${new Date(startTime).toISOString()}`);

      // Try to get from database first if useStoredData is true
      if (useStoredData) {
        const storedData = await this.getStoredData(symbol, interval, startTime, endTime);
        if (storedData?.length) {
          console.log(`Retrieved ${storedData.length} candles from database`);
          return storedData;
        }
      }

      // Fetch from exchange
      const data = await this.fetchFromExchange(symbol, interval, startTime, endTime);
      
      // Validate data
      if (!Array.isArray(data) || !data.length) {
        throw new Error('Invalid data received from exchange');
      }

      // Store in database for future use
      await this.storeData(symbol, interval, data);

      return data;

    } catch (error) {
      console.error('Error fetching training data:', error);
      throw error;
    }
  }

  private static async getStoredData(
    symbol: string, 
    interval: string, 
    startTime: number,
    endTime: number
  ): Promise<any[]> {
    const db = await getDb();
    const data = await db.all(`
      SELECT * FROM market_data 
      WHERE symbol = ? 
      AND interval = ? 
      AND timestamp BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `, [symbol, interval, startTime, endTime]);

    if (data?.length) {
      return data.map(row => ({
        timestamp: row.timestamp,
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: parseFloat(row.volume)
      }));
    }
    return [];
  }

  private static async fetchFromExchange(
    symbol: string, 
    interval: string, 
    startTime: number,
    endTime: number
  ): Promise<any[]> {
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('Invalid symbol provided to fetchFromExchange');
    }

    console.log(`Fetching data from exchange: ${symbol} ${interval}`);
    
    try {
      const data = await fetchHistoricalData({
        symbol: symbol.toString(),  // Ensure string
        interval,
        startTime,
        endTime,
        limit: 1000
      });

      if (!Array.isArray(data) || !data.length) {
        throw new Error('No data received from Binance');
      }

      // Store the fetched data
      await this.storeData(symbol, interval, data);
      
      return data;

    } catch (error) {
      console.error('Failed to fetch from exchange:', error);
      throw error;
    }
  }

  private static async storeData(
    symbol: string,
    interval: string,
    data: any[]
  ): Promise<void> {
    const db = await getDb();
    
    // Begin transaction
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Prepare statement for better performance
      const stmt = await db.prepare(`
        INSERT OR REPLACE INTO market_data (
          symbol,
          interval,
          timestamp,
          open,
          high,
          low,
          close,
          volume
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Insert all records
      for (const candle of data) {
        await stmt.run([
          symbol,
          interval,
          candle.timestamp,
          candle.open,
          candle.high,
          candle.low,
          candle.close,
          candle.volume
        ]);
      }

      // Finalize statement and commit transaction
      await stmt.finalize();
      await db.run('COMMIT');
      
      console.log(`Stored ${data.length} candles for ${symbol} ${interval}`);

    } catch (error) {
      // Rollback on error
      await db.run('ROLLBACK');
      console.error('Failed to store market data:', error);
      throw error;
    }
  }

  private static async trackDataUsage(params: TrainingDataParams) {
    const db = await getDb();
    await db.run(`
      INSERT INTO data_usage_stats (
        symbol,
        interval,
        lookback,
        timestamp
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      params.symbol,
      params.interval,
      params.lookback
    ]);
  }

  static async cleanupOldData() {
    const db = await getDb();
    await db.run(`
      DELETE FROM training_data_cache 
      WHERE timestamp < datetime('now', '-7 days')
    `);
  }

  static async getDataStats() {
    const db = await getDb();
    return await db.all(`
      SELECT 
        symbol,
        COUNT(*) as usage_count,
        MAX(timestamp) as last_used,
        AVG(lookback) as avg_lookback
      FROM data_usage_stats
      GROUP BY symbol
      ORDER BY usage_count DESC
    `);
  }

  static async ensureDataTables() {
    const db = await getDb();
    // This method is now just a pass-through since table creation is handled in database.ts
    console.log('Tables are managed by database.ts initialization');
    return true;
  }
}
