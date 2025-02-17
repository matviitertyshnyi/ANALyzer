import { getDb } from '../database.js';

(async () => {
  try {
    const db = await getDb();
    
    // First drop all tables to ensure clean state
    await db.exec(`DROP TABLE IF EXISTS training_data_cache`);
    await db.exec(`DROP TABLE IF EXISTS schema_version`);
    
    // Create fresh schema_version table
    await db.exec(`
      CREATE TABLE schema_version (
        version INTEGER PRIMARY KEY,
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      );
    `);

    // Create fresh training_data_cache table
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
      );
    `);

    // Get and display table info
    const tableInfo = await db.all(`PRAGMA table_info(training_data_cache)`);
    console.log('Table schema:', tableInfo);

    // Test single insert
    const testValues = [
      'BTCUSDT',
      '1h',
      '1727409600000',
      '65366.01000000',
      '65459.74000000',
      '65276.00000000',
      '65303.96000000',
      '548.98052000',
      '1727413199999',
      '35882561.79224900',
      '94156',
      '244.76532000',
      '15998660.65979150',
      null  // processed_data
    ];

    // Test insert (note: timestamp will be filled by default)
    try {
      await db.run(`
        INSERT INTO training_data_cache (
          symbol, interval, open_time, open, high, low, close,
          volume, close_time, quote_volume, trades,
          buy_base_volume, buy_quote_volume, processed_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, testValues);
      
      console.log('Test insert successful');
      
      // Verify the inserted data
      const inserted = await db.get('SELECT * FROM training_data_cache ORDER BY id DESC LIMIT 1');
      console.log('Inserted row:', inserted);
    } catch (error) {
      console.error('Test insert failed:', error);
      throw error;
    }

    process.exit(0);
  } catch (error) {
    console.error('Debug error:', error);
    process.exit(1);
  }
})();
