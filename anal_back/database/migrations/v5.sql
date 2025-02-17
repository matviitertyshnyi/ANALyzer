PRAGMA foreign_keys=off;
BEGIN TRANSACTION;

-- Drop existing indexes to avoid conflicts
DROP INDEX IF EXISTS idx_market_data_lookup;
DROP INDEX IF EXISTS idx_market_data_time;

-- Create a new table with the interval column
CREATE TABLE market_data_new (
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

-- Copy existing data if any
INSERT OR IGNORE INTO market_data_new (symbol, timeframe, interval, timestamp, open, high, low, close, volume, created_at)
SELECT symbol, timeframe, timeframe as interval, timestamp, open, high, low, close, volume, created_at 
FROM market_data;

-- Drop old table and rename new one
DROP TABLE market_data;
ALTER TABLE market_data_new RENAME TO market_data;

-- Recreate indexes
CREATE INDEX idx_market_data_lookup ON market_data(symbol, timeframe, interval, timestamp);
CREATE INDEX idx_market_data_time ON market_data(timestamp);

-- Update schema version
INSERT OR REPLACE INTO schema_version (version, updated_at) VALUES (5, datetime('now'));

COMMIT;
PRAGMA foreign_keys=on;
