export const MINIMAL_SCHEMA = {
  TRAINING_DATA: `
    CREATE TABLE IF NOT EXISTS training_data (
      id INTEGER PRIMARY KEY,
      data TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,
  DATA_USAGE: `
    CREATE TABLE IF NOT EXISTS data_usage (
      id INTEGER PRIMARY KEY,
      usage REAL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,
  TRAINING_HISTORY: `
    CREATE TABLE IF NOT EXISTS training_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      params TEXT,
      metrics TEXT,
      history TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,
  BOT_STATE: `
    CREATE TABLE IF NOT EXISTS bot_state (
      id INTEGER PRIMARY KEY,
      is_active BOOLEAN,
      strategy TEXT,
      last_update DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,
  ML_TABLES: `
    CREATE TABLE IF NOT EXISTS ml_tables (
      id INTEGER PRIMARY KEY,
      info TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,
  EXPECTED_TABLES: ['training_data', 'data_usage', 'training_history', 'bot_state', 'ml_tables']
};
