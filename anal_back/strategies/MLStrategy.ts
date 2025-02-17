import { TRADING_CONFIG } from '../config/tradingConfig';
import { PnLTracker } from '../ml/PnLTracker';
import { notifyBot } from '../../lib/services/telegram';

export class MLStrategy {
  private activePositions: Map<string, any> = new Map();
  private dailyStats = {
    tradesCount: 0,
    dailyPnL: 0,
    riskRemaining: TRADING_CONFIG.RISK_MANAGEMENT.MAX_DAILY_RISK
  };

  async evaluatePosition(signal: {
    symbol: string;
    confidence: number;
    prediction: number;
    price: number;
    volume: number;
  }) {
    // Skip if daily risk limit reached
    if (this.dailyStats.riskRemaining <= 0) {
      return null;
    }

    // Check entry conditions
    if (!this.checkEntryConditions(signal)) {
      return null;
    }

    // Calculate position size based on kelly criterion and risk
    const { size, leverage } = this.calculatePositionSize(signal);

    // Determine stop loss and take profit levels
    const levels = this.calculateRiskLevels(signal.price, signal.prediction > 0.5);

    return {
      type: signal.prediction > 0.5 ? 'LONG' : 'SHORT',
      size,
      leverage,
      entry: signal.price,
      stopLoss: levels.stopLoss,
      takeProfit: levels.takeProfit,
      trailingStop: levels.trailingStop
    };
  }

  private checkEntryConditions(signal: any): boolean {
    return (
      signal.confidence >= TRADING_CONFIG.STRATEGY.ENTRY_CONDITIONS.MIN_CONFIDENCE &&
      signal.volume >= TRADING_CONFIG.STRATEGY.ENTRY_CONDITIONS.MIN_VOLUME &&
      this.dailyStats.tradesCount < 5 // Max 5 trades per day
    );
  }

  private calculatePositionSize(signal: any) {
    const balance = TRADING_CONFIG.CAPITAL.INITIAL_BALANCE;
    const riskAmount = balance * TRADING_CONFIG.RISK_MANAGEMENT.MAX_RISK_PER_TRADE;
    
    // Kelly Criterion for leverage
    const winRate = 0.55; // From model metrics
    const avgWin = 0.04; // 4% average win
    const avgLoss = 0.02; // 2% average loss
    const kellyFraction = (winRate / avgLoss) - ((1 - winRate) / avgWin);
    
    const leverage = Math.min(
      Math.max(
        Math.round(kellyFraction * TRADING_CONFIG.RISK_MANAGEMENT.LEVERAGE.DEFAULT),
        TRADING_CONFIG.RISK_MANAGEMENT.LEVERAGE.MIN
      ),
      TRADING_CONFIG.RISK_MANAGEMENT.LEVERAGE.MAX
    );

    const size = Math.min(
      Math.max(
        riskAmount * leverage,
        TRADING_CONFIG.CAPITAL.MIN_POSITION_SIZE
      ),
      TRADING_CONFIG.CAPITAL.MAX_POSITION_SIZE
    );

    return { size, leverage };
  }

  private calculateRiskLevels(price: number, isLong: boolean) {
    const stopLoss = isLong
      ? price * (1 - TRADING_CONFIG.RISK_MANAGEMENT.STOP_LOSS)
      : price * (1 + TRADING_CONFIG.RISK_MANAGEMENT.STOP_LOSS);

    const takeProfit = isLong
      ? price * (1 + TRADING_CONFIG.RISK_MANAGEMENT.TAKE_PROFIT)
      : price * (1 - TRADING_CONFIG.RISK_MANAGEMENT.TAKE_PROFIT);

    const trailingStop = TRADING_CONFIG.STRATEGY.EXIT_CONDITIONS.TRAILING_STOP;

    return { stopLoss, takeProfit, trailingStop };
  }

  async updatePosition(position: any, currentPrice: number) {
    // Update trailing stop
    if (position.type === 'LONG' && currentPrice > position.entry) {
      const newStop = currentPrice * (1 - TRADING_CONFIG.STRATEGY.EXIT_CONDITIONS.TRAILING_STOP);
      if (newStop > position.stopLoss) {
        position.stopLoss = newStop;
      }
    }

    // Check exit conditions
    if (this.shouldExitPosition(position, currentPrice)) {
      await this.closePosition(position, currentPrice);
    }
  }

  private shouldExitPosition(position: any, currentPrice: number): boolean {
    const hoursSinceEntry = (Date.now() - position.entryTime) / (1000 * 60 * 60);
    
    return (
      currentPrice <= position.stopLoss ||
      currentPrice >= position.takeProfit ||
      hoursSinceEntry >= TRADING_CONFIG.STRATEGY.EXIT_CONDITIONS.MAX_HOLDING_TIME
    );
  }

  private async closePosition(position: any, exitPrice: number) {
    const pnl = position.type === 'LONG'
      ? (exitPrice - position.entry) * position.size * position.leverage
      : (position.entry - exitPrice) * position.size * position.leverage;

    // Update daily stats
    this.dailyStats.dailyPnL += pnl;
    this.dailyStats.riskRemaining -= (pnl < 0 ? Math.abs(pnl) / TRADING_CONFIG.CAPITAL.INITIAL_BALANCE : 0);

    // Track PnL
    await PnLTracker.trackTrade({
      modelId: position.modelId,
      entryPrice: position.entry,
      exitPrice: exitPrice,
      size: position.size,
      type: position.type,
      timestamp: new Date(),
      confidence: position.confidence
    });

    this.activePositions.delete(position.symbol);
  }
}
