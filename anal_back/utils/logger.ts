import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');

if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LOG_FILE = path.join(LOG_DIR, 'bot.log');

export function log(message: string, type: 'info' | 'error' | 'trade' = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type}] ${message}\n`;
    
    console.log(logMessage);
    
    try {
        fs.appendFileSync(LOG_FILE, logMessage);
    } catch (error) {
        console.error('Failed to write to log file:', error);
    }
}

export function getLogPath(): string {
    return LOG_FILE;
}
