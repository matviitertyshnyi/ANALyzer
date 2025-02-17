export const TRADING_CONFIG = {
  CAPITAL: {
    INITIAL_MARGIN: 500,      // $500 initial margin
    MIN_POSITION_USDT: 5,     // Minimum $5 position
    MAX_POSITION_USDT: 100,   // Maximum $100 position (20% of margin)
    RESERVE_MARGIN: 100       // Keep $100 as reserve margin (20%)
  },

  RISK_MANAGEMENT: {
    RISK_PER_TRADE_USD: 10,   // Risk $10 per trade (2% of $500)
    MAX_DAILY_RISK_USD: 25,   // Max $25 daily risk (5% of $500)
    MAX_DRAWDOWN_USD: 75,     // Max $75 drawdown (15% of $500)
    POSITION_SIZING: {
      DEFAULT_RISK_PCT: 0.02,  // 2% risk per trade
      MAX_LEVERAGE_USE: 0.8,   // Use max 80% of available leverage
      SCALE_OUT_LEVELS: [0.5, 0.75, 1],  // Take profits at 50%, 75%, 100% targets
    },
    LEVERAGE: {
      DEFAULT: 5,             // 5x default leverage ($2500 position)
      MAX: 10,               // 10x max leverage ($5000 position)
      MIN: 2                 // 2x min leverage ($1000 position)
    }
  },

  STRATEGY: {
    TIMEFRAMES: ['1h', '4h'],  // Multiple timeframe analysis
    SYMBOLS: ['BTCUSDT'],      // Start with BTC
    INDICATORS: {
      RSI: {
        PERIOD: 14,
        OVERBOUGHT: 70,
        OVERSOLD: 30
      },
      MACD: {
        FAST: 12,
        SLOW: 26,
        SIGNAL: 9
      },
      BB: {
        PERIOD: 20,
        STD: 2
      }
    },
    ENTRY_CONDITIONS: {
      MIN_CONFIDENCE: 0.7,     // 70% minimum model confidence
      MIN_VOLUME: 1000000,     // Minimum 24h volume
      TREND_CONFIRMATION: true // Require trend confirmation
    },
    EXIT_CONDITIONS: {
      TRAILING_STOP: 0.015,    // 1.5% trailing stop
      MAX_HOLDING_TIME: 48     // Max 48 hours per position
    }
  },

  TRADING_PAIRS: {
    PRIMARY: {
      symbol: 'BTCUSDT',
      minOrderSize: 10,      // Minimum order in USDT
      maxLeverage: 10,
      description: 'Bitcoin/USDT',
      priority: 1
    },
    SECONDARY: [
      {
        symbol: 'ETHUSDT',
        minOrderSize: 10,
        maxLeverage: 10,
        description: 'Ethereum/USDT',
        priority: 2
      },
      {
        symbol: 'BNBUSDT',
        minOrderSize: 10,
        maxLeverage: 8,
        description: 'Binance Coin/USDT',
        priority: 3
      }
    ],
    EXPERIMENTAL: [
      {
        symbol: 'SOLUSDT',
        minOrderSize: 10,
        maxLeverage: 5,
        description: 'Solana/USDT',
        priority: 4
      },
      {
        symbol: 'AVAXUSDT',
        minOrderSize: 10,
        maxLeverage: 5,
        description: 'Avalanche/USDT',
        priority: 4
      }
    ]
  },

  TRAINING: {
    LOOKBACK_DAYS: 180,        // 6 months historical data
    MIN_TRAINING_SAMPLES: 1000,
    VALIDATION_SPLIT: 0.2,
    BATCH_SIZE: 32,
    EPOCHS: 100,
    FEATURES: [
      'close',
      'volume',
      'rsi',
      'macd',
      'bb_upper',
      'bb_lower',
      'atr',
      'trend_strength'
    ],
    PAIRS_STRATEGY: {
      INITIAL_PAIR: 'BTCUSDT',  // Start with BTC
      TRAINING_ORDER: [
        'BTCUSDT',              // Train on BTC first
        'ETHUSDT',              // Then ETH
        'BNBUSDT'              // Then BNB
      ],
      MIN_VOLUME_24H: 100000000, // $100M minimum daily volume
      MIN_MARKET_CAP: 5000000000 // $5B minimum market cap
    }
  }
};
