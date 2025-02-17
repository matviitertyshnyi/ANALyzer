import { getDb } from '../database.js';

(async () => {
  try {
    const db = await getDb();
    
    // Drop existing table to ensure clean state
    await db.exec('DROP TABLE IF EXISTS training_data_cache');
    
    // Create table with all TEXT columns
    await db.exec(`
      CREATE TABLE training_data_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        interval TEXT NOT NULL,
        open_time TEXT NOT NULL,
        open TEXT NOT NULL,
        high TEXT NOT NULL,
        low TEXT NOT NULL,
        close TEXT NOT NULL,
        volume TEXT NOT NULL,
        close_time TEXT NOT NULL,
        quote_volume TEXT NOT NULL,
        trades TEXT NOT NULL,
        buy_base_volume TEXT NOT NULL,
        buy_quote_volume TEXT NOT NULL,
        processed_data TEXT,
        timestamp TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);

    console.log('training_data_cache table recreated successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error resetting schema:', error);
    process.exit(1);
  }
})();
