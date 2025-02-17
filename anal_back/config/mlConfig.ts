export const ML_CONFIG = {
  MODEL: {
    SAVE_PATH: '../data/models/',
    VERSION: '1.0.0',
  },
  FEATURES: {
    PRICE: ['open', 'high', 'low', 'close'],
    VOLUME: ['volume', 'quote_volume'],
    TECHNICAL: {
      MOMENTUM: ['rsi_14', 'macd', 'macd_signal', 'macd_hist'],
      VOLATILITY: ['atr_14', 'bbands_upper', 'bbands_lower', 'bbands_middle'],
      TREND: ['ema_9', 'ema_21', 'trend_strength'],
    },
    MARKET: ['funding_rate', 'long_short_ratio', 'open_interest']
  },
  TRADING: {
    MAX_LEVERAGE: 20,          // Maximum 20x leverage for futures
    DEFAULT_LEVERAGE: 5,       // Default 5x leverage
    POSITION_SIZING: {
      INITIAL_MARGIN: 500,     // $500 initial margin
      MIN_POSITION_SIZE: 0.01, // $5 min position (1% of margin)
      MAX_POSITION_SIZE: 0.2,  // $100 max position (20% of margin)
      RISK_PER_TRADE: 0.02,    // $10 risk per trade (2% of margin)
      MAX_DRAWDOWN: 0.15,      // $75 max drawdown (15% of margin)
      MAX_LEVERAGE_UTILIZATION: 0.8,  // Use max 80% of available leverage
      SCALE_OUT_TARGETS: {
        FIRST: 0.01,           // Take 33% off at 1% profit
        SECOND: 0.02,          // Take 33% off at 2% profit
        FINAL: 0.03            // Take remaining at 3% profit
      }
    },
    RISK_CONTROLS: {
      MIN_CONFIDENCE: 33,     // Lowered minimum confidence threshold
      MAX_DAILY_TRADES: 10,    // Maximum trades per day
      MAX_CONCURRENT_TRADES: 2, // Maximum concurrent positions
      MIN_WIN_RATE: 0.52,      // Lowered from 0.55 to 0.52
      MAX_CONSECUTIVE_LOSSES: 3, // Maximum consecutive losing trades
      MIN_SIGNAL_STRENGTH: 0.1,  // Minimum 10% above random
      MAX_DAILY_RISK_USD: 25,  // Max $25 daily risk
      MAX_POSITION_COUNT:2 ,    // Max 2 concurrent positions
      POSITION_CORRELATION: 0.7 // Max correlation between positions
    },
    TIMEFRAMES: ['5m', '15m', '1h', '4h'],
    EXITS: {
      TRAILING_STOP: true,
      TRAILING_DISTANCE: 0.02,  // 2% trailing stop
      STOP_LOSS: {
        TIGHT: 0.01,          // $5 risk (1% of $500)
        NORMAL: 0.02,         // $10 risk (2% of $500)
        WIDE: 0.03            // $15 risk (3% of $500)
      },
      PROFIT_TARGETS: {       // Renamed from TAKE_PROFIT to PROFIT_TARGETS
        CONSERVATIVE: 0.02,   // $10 profit target (2%)
        MODERATE: 0.03,       // $15 profit target (3%)
        AGGRESSIVE: 0.04      // $20 profit target (4%)
      }
    }
  },
  TRAINING: {
    BATCH_SIZE: 32,
    EPOCHS: {
      COUNT: 100,
      CANDLES_PER_EPOCH: 1000,
      MIN_TRAINING_EPOCHS: 50,
      MAX_TRAINING_EPOCHS: 200,
      EARLY_STOPPING_PATIENCE: 20
    },
    VALIDATION_SPLIT: 0.2,
    WINDOW_SIZE: 60,           // 60 candles lookback
    MIN_SAMPLES: 1000,
    TARGET_ACCURACY: 0.65,     // Minimum 65% accuracy
    EARLY_STOPPING: {
      PATIENCE: 10,
      MIN_DELTA: 0.001
    },
    SIGNAL_THRESHOLDS: {
      PRICE_CHANGE: {
        LONG: 0.002,           // 0.2% threshold for long signals
        SHORT: -0.002,         // -0.2% threshold for short signals
        NEUTRAL_BAND: 0.0005   // ±0.05% neutral zone (tightened)
      },
      CONFIDENCE: {
        HIGH: 0.7,
        MEDIUM: 0.4,          // Lowered from 0.5
        LOW: 0.3              // Lowered from 0.4
      }
    },
    CLASS_WEIGHTS: {
      LONG: 1.5,              // Increased weight for directional trades
      SHORT: 1.5,
      NEUTRAL: 0.5            // Reduced weight for neutral
    },
    ENRICHMENT: {
      LOWER_TIMEFRAMES: ['15m', '5m'],
      MIN_SAMPLES_PER_HOUR: {
        '15m': 4,
        '5m': 12
      }
    },
    TIME_WINDOWS: {
      START_DATE: '2022-01-01',
      END_DATE: '2025-01-01',
      MAIN_TIMEFRAME: '1h',
      SUB_TIMEFRAMES: ['15m', '5m'],
      WINDOW_SIZE: 1000,        // Process 1000 candles per window
      SLIDING_WINDOW: {
        INITIAL_WAIT: 100,      // Wait 100 candles before first trade
        STEP_SIZE: 1,           // Move forward 1 candle at a time
        HISTORY_SIZE: 1000      // Keep 1000 candles in memory
      }
    },
    DATA_ENRICHMENT: {
      USE_SUB_TIMEFRAMES: true,
      CANDLES_PER_PERIOD: {
        '15m': 4,   // 4 x 15min = 1h
        '5m': 12    // 12 x 5min = 1h
      },
      FEATURES_WEIGHT: {
        '1h': 0.6,   // Main timeframe weight
        '15m': 0.25, // 15min data weight
        '5m': 0.15   // 5min data weight
      }
    },
    MEMORY: {
      SAVE_INTERVAL: 10,         // Save state every 10 windows
      CHECKPOINT_INTERVAL: 100,  // Create checkpoint every 100 windows
      KEEP_BEST_MODELS: 5,      // Keep top 5 performing models
      MERGE_INTERVAL: 1000,      // Merge learning every 1000 windows
      MAX_EXPERIENCES: 100,      // Keep last 100 training experiences
      EXPERIENCE_WEIGHT: 0.2,    // Weight for merging old experiences
      CURRENT_WEIGHT: 0.8       // Weight for current model
    },
    POSITION_SIZING: {
      INITIAL_CAPITAL: 10000,  // Move INITIAL_CAPITAL here from TRADING
      MIN_POSITION: 0.01,
      MAX_POSITION: 1.0,
      RISK_PER_TRADE: 0.02
    }
  }
};
