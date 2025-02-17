import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import { MINIMAL_SCHEMA } from './schemas/tradingSchema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db: Database | null = null;

const SCHEMA_VERSION = 1;

export async function getDb(): Promise<Database> {
  if (db) return db;
  
  const dbPath = path.join(__dirname, '..', 'data', 'database.sqlite');
  const dataDir = path.dirname(dbPath);
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  try {
    // Create tables in specific order to handle dependencies
    const schemas = [
      MINIMAL_SCHEMA.MARKET_DATA,        // Market data must be first
      MINIMAL_SCHEMA.BALANCE_HISTORY,    // Then balance history
      MINIMAL_SCHEMA.ML_STATE,           // ML related tables
      MINIMAL_SCHEMA.ML_TABLES,
      MINIMAL_SCHEMA.TRAINING_DATA,      // Training related tables
      MINIMAL_SCHEMA.DATA_USAGE,
      MINIMAL_SCHEMA.TRAINING_HISTORY,
      MINIMAL_SCHEMA.BOT_STATE           // Bot state last
    ];

    // Execute each schema
    for (const schema of schemas) {
      try {
        await db.exec(schema);
        console.log('Created table:', schema.split('\n')[1].trim());
      } catch (err) {
        console.error('Failed to execute schema:', err);
        throw err;
      }
    }

    // Verify market_data table exists
    const tableCheck = await db.get(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='market_data'
    `);

    if (!tableCheck) {
      throw new Error('market_data table was not created successfully');
    }

    console.log('Database initialized successfully');
    return db;

  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

export async function closeDb(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}

export async function resetDatabase(): Promise<void> {
  const database = await getDb();
  
  try {
    // Drop all tables
    await database.exec(`
      PRAGMA foreign_keys = OFF;
      BEGIN TRANSACTION;
      
      DROP TABLE IF EXISTS market_data;
      DROP TABLE IF EXISTS balance_history;
      DROP TABLE IF EXISTS ml_state;
      DROP TABLE IF EXISTS training_data_cache;
      DROP TABLE IF EXISTS data_usage_stats;
      DROP TABLE IF EXISTS training_history;
      DROP TABLE IF EXISTS bot_state;
      DROP TABLE IF EXISTS ml_experiences;
      DROP TABLE IF EXISTS ml_models;
      DROP TABLE IF EXISTS model_checkpoints;
      
      COMMIT;
      PRAGMA foreign_keys = ON;
    `);

    console.log('✅ Tables dropped successfully');
    
    // Close and reopen to ensure clean state
    await closeDb();
    
    // Reinitialize database
    await getDb();
    
    console.log('✅ Database reset completed');
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    throw error;
  }
}