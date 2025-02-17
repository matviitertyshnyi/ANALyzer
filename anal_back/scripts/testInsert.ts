import { getDb } from '../database.js';

(async () => {
  try {
    const db = await getDb();
    
    // Drop and recreate with minimal schema
    await db.exec(`DROP TABLE IF EXISTS training_data_cache`);
    await db.exec(`
      CREATE TABLE training_data_cache (
        symbol TEXT,
        open_time TEXT,
        open TEXT,
        close TEXT
      )
    `);
    console.log('Created minimal test table');

    // Test minimal insert
    const testValue = {
      symbol: 'BTCUSDT',
      openTime: '1727409600000',
      open: '65366.01000000',
      close: '65303.96000000'
    };

    // Try insert with explicit columns
    const sql = `INSERT INTO training_data_cache (symbol, open_time, open, close) VALUES (?, ?, ?, ?)`;
    const params = [testValue.symbol, testValue.openTime, testValue.open, testValue.close];
    
    console.log('Executing SQL:', sql);
    console.log('With params:', params);
    console.log('Param types:', params.map(p => typeof p));

    await db.run(sql, params);
    console.log('Test insert successful');

    // Verify data
    const result = await db.all('SELECT * FROM training_data_cache');
    console.log('Table contents:', result);

    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
})();
