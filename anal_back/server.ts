import express, { Request, Response, Application, NextFunction, Router, RequestHandler } from 'express';
import cors from 'cors';
import { Database, open as sqliteOpen } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { log, getLogPath } from './utils/logger.js';
import { TradingBot } from '../anal_bot/TradingBot.js';
import { SimpleMACDStrategy } from '../anal_bot/strategies/SimpleMACDStrategy.js';
import { notifyBot } from '../lib/services/telegram.js';
import { MLStrategy } from '../anal_bot/strategies/MLStrategy.js';
import { EnhancedStrategy } from '../anal_bot/strategies/EnhancedStrategy.js';
import { corsMiddleware } from './middleware/cors.js';
import { BaseStrategy } from '../anal_bot/strategies/BaseStrategy.js'; // Add this import
import { getDb, closeDb } from './database.js';
// Remove or comment out this unused import:
// import { getPositions } from './handlers'; 
import { createRoutes } from './routes/apiRoutes.js';
import { ExpressHandler } from './types';
import trainingRoutes from './routes/training.js';
import { Server as SocketServer } from 'socket.io';
import http from 'http';
import { initializeSocket } from '../lib/services/socket.js';
import { setSocketInstance } from '../lib/services/socketService.js';
import '@tensorflow/tfjs-node-gpu';
import * as tf from '@tensorflow/tfjs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { DataManager } from './services/DataManager.js';
import trainRouter from './routes/training.js';
import healthRouter from './routes/health.js';
import trainingRoutes from './routes/trainingRoutes.js';

// Remove WebGL specific config and use proper GPU setup
tf.env().set('DEBUG', false);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables at the very start
dotenv.config();

// Verify environment variables before starting
const requiredEnvVars = [
  'NEXT_PUBLIC_TELEGRAM_BOT_TOKEN',
  'NEXT_PUBLIC_TELEGRAM_CHAT_ID'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Test Telegram connection at startup
async function testTelegramConnection() {
  try {
    await notifyBot('🤖 Bot server starting...');
    console.log('Telegram connection test successful');
  } catch (error) {
    console.error('Telegram connection test failed:', error);
    process.exit(1);
  }
}

// Call test before starting server
testTelegramConnection();

// Add strategy type enum
enum StrategyType {
  MACD = 'MACD',
  ML = 'ML',
  ENHANCED = 'ENHANCED'
}

// Add strategy factory
function createStrategy(type: StrategyType): BaseStrategy {
  const baseConfig = {
    symbol: 'BTCUSDT',
    interval: '1m',
    maxLeverage: 10,
    riskPerTrade: 5,
    stopLoss: 1,
    takeProfit: 2
  };

  switch (type) {
    case StrategyType.ML:
      return new MLStrategy({
        ...baseConfig,
        mlConfig: {
          windowSize: 60,
          confidenceThreshold: 0.6,
          trainingInterval: 24 * 60 * 60 * 1000
        }
      });
    case StrategyType.ENHANCED:
      return new EnhancedStrategy(baseConfig);
    default:
      return new SimpleMACDStrategy(baseConfig);
  }
}

// Load environment variables from both .env files
dotenv.config({ path: path.join(dirname(__dirname), '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });

const app: Application = express();
const port = process.env.PORT || 5000;

// Initialize middleware
app.use(cors());
app.use(corsMiddleware);
app.use(express.json());

// Initialize Socket.IO with CORS
const server = http.createServer(app);
const io = initializeSocket(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('Client connected');
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Define all handlers first
const tradesHandler: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const db = await getDb();
    const trades = await db.all('SELECT * FROM trades ORDER BY timestamp DESC');
    res.json(trades);
  } catch (error) {
    next(error); // Use next for error handling
  }
};  

const balanceHandler: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const db = await getDb();
    const balance = await db.get('SELECT balance FROM account_balance WHERE id = 1');
    res.json({ balance: balance?.balance ?? 1000 });
  } catch (error) {
    next(error);
  }
};

const strategyHandler: RequestHandler = async (req, res) => {
  try {
    const { strategy } = req.body as { strategy: StrategyType };
    
    if (bot) {
      await bot.stop();
    }

    const newStrategy = createStrategy(strategy);
    bot = new TradingBot(newStrategy, {
      placeLongOrder: async (amount: number, leverage: number) => {
        const currentPrice = bot?.getLatestPrice();
        if (!currentPrice) throw new Error('No price data available');

        const size = (amount * leverage) / currentPrice;
        
        const db = await getDb();
        await db.run(
          'INSERT INTO trades (type, amount, leverage, timestamp, price, size, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ['LONG', amount, leverage, new Date(), currentPrice, size, 'open']
        );

        await db.run(`
          UPDATE account_balance 
          SET balance = balance - ?, last_update = ?
          WHERE id = 1
        `, [amount, new Date()]);

        log(`Long position opened: $${amount} at $${currentPrice} with ${leverage}x leverage`, 'trade');
      },
      placeShortOrder: async (amount: number, leverage: number) => {
        const currentPrice = bot?.getLatestPrice();
        if (!currentPrice) throw new Error('No price data available');

        const size = (amount * leverage) / currentPrice;
        
        const db = await getDb();
        await db.run(
          'INSERT INTO trades (type, amount, leverage, timestamp, price, size, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ['SHORT', amount, leverage, new Date(), currentPrice, size, 'open']
        );

        await db.run(`
          UPDATE account_balance 
          SET balance = balance - ?, last_update = ?
          WHERE id = 1
        `, [amount, new Date()]);

        log(`Short position opened: $${amount} at $${currentPrice} with ${leverage}x leverage`, 'trade');
      }
    });

    await bot.start();
    
    const db = await getDb();
    await db.run(`
      UPDATE bot_state 
      SET strategy = ? 
      WHERE id = 1
    `, [strategy]);

    res.json({ success: true, strategy });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change strategy' });
  }
};

const startBotHandler: RequestHandler = async (req, res) => {
  try {
    log('Starting bot...');
    
    // Create ML strategy instead of Enhanced or MACD
    const strategy = new MLStrategy({
      symbol: 'BTCUSDT',
      interval: '1m',
      maxLeverage: 10,
      riskPerTrade: 5,
      stopLoss: 1,
      takeProfit: 2,
      mlConfig: {
        windowSize: 60,
        confidenceThreshold: 0.6,
        trainingInterval: 24 * 60 * 60 * 1000 // 24 hours
      }
    });

    const db = await getDb();
    
    // Check if bot is already running
    const existing = await db.get('SELECT is_active FROM bot_state WHERE id = 1');
    if (existing?.is_active) {
      res.json({ success: false, error: 'Bot is already running' });
      return;
    }

    // Create new bot instance with proper type
    const newBot = new TradingBot(strategy, {
      placeLongOrder: async (amount: number, leverage: number) => {
        const currentPrice = newBot.getLatestPrice();
        if (!currentPrice) throw new Error('No price data available');

        const size = (amount * leverage) / currentPrice;
        
        await db.run(
          'INSERT INTO trades (type, amount, leverage, timestamp, price, size, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ['LONG', amount, leverage, new Date(), currentPrice, size, 'open']
        );

        await db.run(`
          UPDATE account_balance 
          SET balance = balance - ?, last_update = ?
          WHERE id = 1
        `, [amount, new Date()]);

        log(`Long position opened: $${amount} at $${currentPrice} with ${leverage}x leverage`, 'trade');
      },
      placeShortOrder: async (amount: number, leverage: number) => {
        const currentPrice = newBot.getLatestPrice();
        if (!currentPrice) throw new Error('No price data available');

        const size = (amount * leverage) / currentPrice;
        
        await db.run(
          'INSERT INTO trades (type, amount, leverage, timestamp, price, size, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ['SHORT', amount, leverage, new Date(), currentPrice, size, 'open']
        );

        await db.run(`
          UPDATE account_balance 
          SET balance = balance - ?, last_update = ?
          WHERE id = 1
        `, [amount, new Date()]);

        log(`Short position opened: $${amount} at $${currentPrice} with ${leverage}x leverage`, 'trade');
      }
    });

    await newBot.start();
    bot = newBot;

    await db.run('INSERT OR REPLACE INTO bot_state (id, is_active) VALUES (1, true)');

    log('Bot started successfully');
    res.json({ success: true });
  } catch (error) {
    log(`Failed to start bot: ${error}`, 'error');
    res.status(500).json({ error: 'Failed to start bot' });
  }
};

const stopBotHandler: RequestHandler = async (req, res) => {
  try {
    if (bot) {
      await bot.stop();
      bot = null;
      const db = await getDb();
      await db.run('INSERT OR REPLACE INTO bot_state (id, is_active) VALUES (1, false)');
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to stop bot' });
  }
};

const closePositionHandler: RequestHandler = (req, res, next) => {
  const { id } = req.params;
  getDb()
    .then(async (db) => {
      const position = await db.get('SELECT * FROM trades WHERE id = ? AND status = ?', [id, 'open']);
      if (!position) {
        res.status(404).json({ error: 'Position not found or already closed' });
        return;
      }

      const currentPrice = bot?.getLatestPrice();
      if (!currentPrice) {
        res.status(400).json({ error: 'Cannot close position: No price data available' });
        return;
      }

      // Calculate profit/loss
      const priceDiff = position.type === 'LONG' 
        ? currentPrice - position.price 
        : position.price - currentPrice;
      const profit = priceDiff * position.size;

      // Update balance
      await db.run(`
        UPDATE account_balance 
        SET balance = balance + ?, last_update = ?
        WHERE id = 1
      `, [position.amount + profit, new Date()]);

      // Update position status
      await db.run(`
        UPDATE trades 
        SET status = 'closed', 
            exit_price = ?, 
            exit_timestamp = ?,
            profit_loss = ?
        WHERE id = ?
      `, [currentPrice, new Date(), profit, id]);

      res.json({ 
        success: true, 
        profit,
        exitPrice: currentPrice
      });
    })
    .catch(next);
};

const botStateHandler: RequestHandler = (req, res, next) => {
  getDb()
    .then(async (db) => {
      const state = await db.get(`SELECT is_active FROM bot_state WHERE id = 1`);
      res.json({ isActive: state?.is_active ?? false });
    })
    .catch(next);
};

// Define explicit routes
app.get('/api/trades', tradesHandler);
app.get('/api/balance', balanceHandler);  // Add this line to register the balance route

// If you still need router logic:
app.use('/api', createRoutes());

// Add training routes
app.use('/api', trainingRoutes);
app.use('/api/train', trainingRoutes);
app.use('/train', trainRouter);
app.use(healthRouter);
app.use('/api/training', trainingRoutes);

const PORT = parseInt(process.env.PORT || '5001', 10);
const MAX_PORT_RETRIES = 0; // Don't try other ports, fail if port is taken
const DATA_DIR = path.join(__dirname, '../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

let bot: TradingBot | null = null;

// Stop recreating database on each init
const initDb = async (): Promise<Database> => {
  const db = await sqliteOpen({
    filename: path.join(DATA_DIR, 'database.sqlite'),
    driver: sqlite3.Database
  });

  // Remove the DROP TABLE commands and only create if not exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS bot_state (
      id INTEGER PRIMARY KEY,
      is_active BOOLEAN DEFAULT false,
      last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
      strategy TEXT DEFAULT 'MACD'
    );

    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      leverage INTEGER NOT NULL,
      timestamp DATETIME NOT NULL,
      price REAL NOT NULL,
      size REAL NOT NULL,
      status TEXT DEFAULT 'open',
      exit_price REAL,
      exit_timestamp DATETIME,
      profit_loss REAL,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
    CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
    
    CREATE TABLE IF NOT EXISTS account_balance (
      id INTEGER PRIMARY KEY,
      balance REAL NOT NULL DEFAULT 1000,
      last_update DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Initialize balance if not exists
  const balance = await db.get('SELECT balance FROM account_balance WHERE id = 1');
  if (!balance) {
    await db.run('INSERT INTO account_balance (id, balance) VALUES (1, 1000)');
  }

  return db;
};

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Auto-start bot on server startup
async function initBot() {
  try {
    const db = await getDb();
    const state = await db.get(`SELECT is_active, strategy FROM bot_state WHERE id = 1`);
    
    await notifyBot(`[BOT] Server initialized
Status: ${state?.is_active ? 'Active ✅' : 'Inactive ❌'}
Time: ${new Date().toISOString()}`);
    
    console.log(`[Server] Strategy: ${state?.strategy || 'Not set'}`);
    console.log(`[Server] Status: ${state?.is_active ? 'Active' : 'Inactive'}`);
    
    if (state?.is_active) {
      console.log('[Server] Starting bot with strategy:', state.strategy);
      const strategy = createStrategy(state.strategy || StrategyType.MACD);
      const newBot = new TradingBot(strategy, {
        placeLongOrder: async (amount: number, leverage: number) => {
          const db = await getDb();
          // Fixed null check by using the local newBot instance
          const currentPrice = newBot.getLatestPrice();
          if (!currentPrice) throw new Error('No price data available');

          const size = (amount * leverage) / currentPrice;
          
          await db.run(`
            INSERT INTO trades (type, amount, leverage, timestamp, price, size, status)
            VALUES ('LONG', ?, ?, ?, ?, ?, 'open')
          `, [amount, leverage, new Date(), currentPrice, size]);
        },
        placeShortOrder: async (amount: number, leverage: number) => {
          const db = await getDb();
          // Fixed null check by using the local newBot instance
          const currentPrice = newBot.getLatestPrice();
          if (!currentPrice) throw new Error('No price data available');

          const size = (amount * leverage) / currentPrice;
          
          await db.run(`
            INSERT INTO trades (type, amount, leverage, timestamp, price, size, status)
            VALUES ('SHORT', ?, ?, ?, ?, ?, 'open')
          `, [amount, leverage, new Date(), currentPrice, size]);
        }
      });
      
      console.log('[Server] Initializing strategy...');
      await newBot.start();
      bot = newBot;
      console.log('[Server] Bot started successfully');
    }
  } catch (error: any) {
    console.error('[Server] Init bot error:', error);
    console.error('[Server] Stack trace:', error.stack);
    const errorMessage = error?.message || 'Unknown error occurred';
    await notifyBot(`Bot initialization failed: ${errorMessage}`);
  }
}

// Add process handling for clean shutdown
process.on('SIGINT', async () => {
  if (bot) {
    log('Shutting down bot...');
    await bot.stop();
  }
  await closeDb();
  process.exit(0);
});

// Add environment check at startup
const checkEnvironment = () => {
  const required = [
    'NEXT_PUBLIC_TELEGRAM_BOT_TOKEN',
    'NEXT_PUBLIC_TELEGRAM_CHAT_ID'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  
  log('Environment variables loaded successfully');
};

// Helper function for liquidation price calculation
function calculateLiquidationPrice(position: any): number {
  const entryPrice = parseFloat(position.price);
  const leverage = parseInt(position.leverage);
  const liquidationDistance = entryPrice * (1 / leverage);
  
  return position.type === 'LONG'
    ? entryPrice - liquidationDistance
    : entryPrice + liquidationDistance;
}

// Set socket instance for use in other parts of the application
setSocketInstance(io);

// Function to try listening on a port and handle conflicts
function tryListen(server: http.Server, startPort: number, maxRetries: number = 5): Promise<number> {
  return new Promise((resolve, reject) => {
    let currentPort = startPort;
    let attempts = 0;

    function attemptListen() {
      server.listen(currentPort)
        .on('listening', () => {
          console.log(`[Server] Successfully bound to port ${currentPort}`);
          resolve(currentPort);
        })
        .on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`[Server] Port ${currentPort} in use, trying next port`);
            server.close();
            if (attempts < maxRetries) {
              attempts++;
              currentPort++;
              attemptListen();
            } else {
              reject(new Error(`Could not find available port after ${maxRetries} attempts`));
            }
          } else {
            reject(err);
          }
        });
    }

    attemptListen();
  });
}

// Remove or comment out this first tryListen block
/*
tryListen(server, PORT, MAX_PORT_RETRIES)
  .then(actualPort => {
    console.log(`[Server] Started on port ${actualPort}`);
    checkEnvironment();
    initBot();
  })
  .catch(error => {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  });
*/

async function initializeServer() {
  try {
    await DataManager.ensureDataTables();
    
    // Use tryListen instead of direct server.listen
    const actualPort = await tryListen(server, PORT, MAX_PORT_RETRIES);
    console.log(`[Server] Started on port ${actualPort}`);
    
    // Initialize Socket.IO after server is listening
    const io = initializeSocket(server, {
      cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    setSocketInstance(io);
    
    // Initialize bot and other services
    checkEnvironment();
    await verifyTelegramConfig();
    await initBot();
    
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Start the server
initializeServer().catch(error => {
  console.error('Server initialization failed:', error);
  process.exit(1);
});

// Verify Telegram configuration
const verifyTelegramConfig = async () => {
  const token = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;
  
  if (!token || !chatId) {
    console.error('Missing Telegram configuration:', { token, chatId });
    process.exit(1);
  }

  try {
    await notifyBot('🤖 Bot startup test message');
    console.log('Telegram configuration verified successfully');
  } catch (error) {
    console.error('Failed to send test message to Telegram:', error);
    process.exit(1);
  }
};

// Export for testing
export { app, server, io };
