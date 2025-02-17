PRAGMA foreign_keys=off;
BEGIN TRANSACTION;

-- Check if column exists before adding
SELECT CASE 
    WHEN NOT EXISTS(SELECT 1 FROM pragma_table_info('bot_state') WHERE name='is_active') THEN
        'ALTER TABLE bot_state ADD COLUMN is_active BOOLEAN DEFAULT 0;'
END AS sql_command
WHERE sql_command IS NOT NULL;

-- Update schema version
INSERT OR REPLACE INTO schema_version (version, updated_at) VALUES (2, datetime('now'));

COMMIT;
PRAGMA foreign_keys=on;
