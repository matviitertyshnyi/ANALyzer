export const MINIMAL_SCHEMA = {
  TRAINING_DATA: `
    CREATE TABLE IF NOT EXISTS training_data_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      interval TEXT NOT NULL,
      open_time INTEGER NOT NULL,
      open TEXT NOT NULL,
      close TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `,
  
  DATA_USAGE: `
    CREATE TABLE IF NOT EXISTS data_usage_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      interval TEXT NOT NULL,
      lookback INTEGER NOT NULL,
      timestamp TEXT DEFAULT (datetime('now'))
    )
  `,

  TRAINING_HISTORY: `
    CREATE TABLE IF NOT EXISTS training_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id INTEGER,
      params TEXT NOT NULL,
      metrics TEXT NOT NULL,
      history TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `,

  BOT_STATE: `
    CREATE TABLE IF NOT EXISTS bot_state (
      id INTEGER PRIMARY KEY,
      is_active BOOLEAN DEFAULT false,
      last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
      strategy TEXT DEFAULT 'MACD'
    )
  `,

  ML_TABLES: `
    CREATE TABLE IF NOT EXISTS ml_experiences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id INTEGER NOT NULL,
      features TEXT NOT NULL,
      action INTEGER NOT NULL,
      reward REAL NOT NULL,
      next_features TEXT NOT NULL,
      timestamp TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
    );

    CREATE TABLE IF NOT EXISTS ml_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      model_type TEXT NOT NULL,
      accuracy REAL,
      win_rate REAL,
      total_predictions INTEGER DEFAULT 0,
      last_training_time DATETIME,
      config TEXT,
      metrics TEXT,
      status TEXT DEFAULT 'inactive',
      weights_path TEXT,
      metadata TEXT,
      last_updated DATETIME
    );
  `,

  ML_STATE: `
    CREATE TABLE IF NOT EXISTS ml_state (
      id INTEGER PRIMARY KEY,
      state TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS model_checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id INTEGER,
      epoch INTEGER,
      metrics TEXT,
      weights_path TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,

  BALANCE_HISTORY: `
    CREATE TABLE IF NOT EXISTS balance_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME NOT NULL,
      balance REAL NOT NULL,
      pnl REAL NOT NULL,
      reason TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_balance_history_timestamp 
    ON balance_history(timestamp);
  `,

  MARKET_DATA: `
    CREATE TABLE IF NOT EXISTS market_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      interval TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(symbol, interval, timestamp)
    );
    
    CREATE INDEX IF NOT EXISTS idx_market_data_lookup 
    ON market_data(symbol, interval, timestamp);
    
    CREATE INDEX IF NOT EXISTS idx_market_data_time 
    ON market_data(timestamp);
  `,

  EXPECTED_COLUMNS: [
    'id', 'symbol', 'interval', 'open_time', 'open', 'close', 'timestamp'
  ],

  EXPECTED_TABLES: [
    'training_data_cache',
    'data_usage_stats',
    'training_history',
    'schema_version',
    'bot_state',
    'ml_experiences',
    'ml_models'
  ]
};
