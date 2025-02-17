-- ML Models table
CREATE TABLE IF NOT EXISTS ml_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    weights BLOB NOT NULL,
    config TEXT NOT NULL,
    metrics TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ML Experiences table
CREATE TABLE IF NOT EXISTS ml_experiences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    experience BLOB NOT NULL,
    metrics TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ML State table
CREATE TABLE IF NOT EXISTS ml_state (
    id INTEGER PRIMARY KEY,
    state TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bot State table
CREATE TABLE IF NOT EXISTS bot_state (
    id INTEGER PRIMARY KEY,
    state TEXT NOT NULL,
    status TEXT NOT NULL,
    config TEXT,
    strategy TEXT,      -- Added strategy column
    is_active BOOLEAN DEFAULT 0,
    last_action TEXT,
    last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bot Activity Log table for tracking actions
CREATE TABLE IF NOT EXISTS bot_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    details TEXT,
    status TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Market Data table
CREATE TABLE IF NOT EXISTS market_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    interval TEXT NOT NULL,  -- Add interval column
    timestamp INTEGER NOT NULL,
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, timeframe, interval, timestamp)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_models_symbol_timeframe ON ml_models(symbol, timeframe);
CREATE INDEX IF NOT EXISTS idx_experiences_symbol_timeframe ON ml_experiences(symbol, timeframe);
CREATE INDEX IF NOT EXISTS idx_bot_activity_timestamp ON bot_activity(timestamp);
CREATE INDEX IF NOT EXISTS idx_bot_state_status ON bot_state(status);
CREATE INDEX IF NOT EXISTS idx_market_data_lookup ON market_data(symbol, timeframe, timestamp);
CREATE INDEX IF NOT EXISTS idx_market_data_time ON market_data(timestamp);

-- Update version tracking
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO schema_version (version) VALUES (1);
