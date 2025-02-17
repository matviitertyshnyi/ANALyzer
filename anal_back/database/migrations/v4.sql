PRAGMA foreign_keys=off;
BEGIN TRANSACTION;

-- v4 Migration: Add market_data table

CREATE TABLE IF NOT EXISTS market_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, timeframe, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_market_data_lookup ON market_data(symbol, timeframe, timestamp);
CREATE INDEX IF NOT EXISTS idx_market_data_time ON market_data(timestamp);

-- Update schema version
INSERT OR REPLACE INTO schema_version (version, updated_at) VALUES (4, datetime('now'));

COMMIT;
PRAGMA foreign_keys=on;
