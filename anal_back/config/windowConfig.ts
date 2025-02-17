export const WINDOW_CONFIG = {
  CANDLES: {
    MAIN: {
      INTERVAL: '1h',
      COUNT: 1000,    // Process 1000 1h candles per window
      DAYS_SPAN: 41.67 // 1000 hours ≈ 41.67 days
    },
    SUB: {
      '15m': {
        COUNT: 4000, // 4x more granular data
        CANDLES_PER_HOUR: 4
      },
      '5m': {
        COUNT: 12000, // 12x more granular data
        CANDLES_PER_HOUR: 12
      }
    }
  },
  CAPITAL: {
    INITIAL: 500,
    INJECTION_TRIGGER: 50, // Inject new capital when balance falls below $50
    INJECTION_AMOUNT: 500
  },
  TRADE_SIGNALS: {
    ENTRY: {
      RSI: {
        OVERBOUGHT: 70,
        OVERSOLD: 30,
        PERIOD: 14
      },
      SUPPORT_RESISTANCE: {
        LOOKBACK: 100,
        SENSITIVITY: 0.02
      },
      VOLUME: {
        MIN_THRESHOLD: 1.5, // 1.5x average volume
        PERIOD: 20
      },
      MOVING_AVERAGES: {
        SMA: 20,
        EMA_SHORT: 9,
        EMA_LONG: 21
      },
      BOLLINGER: {
        PERIOD: 20,
        STD: 2
      }
    },
    EXIT: {
      TAKE_PROFIT: {
        R_RATIO: 3, // Risk:Reward 1:3
        TRAILING_STOP: 0.02 // 2% trailing stop when in profit
      },
      STOP_LOSS: {
        INITIAL: 0.02, // 2% initial stop
        MAX_RISK: 0.02 // Max 2% account risk per trade
      }
    }
  }
};
