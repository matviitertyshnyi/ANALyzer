import { getDb } from '../database';
import { notifyBot } from '../../lib/services/telegram';

export class PnLTracker {
  private static readonly RISK_METRICS = {
    MAX_DRAWDOWN_PERCENT: 5,    // 5% maximum drawdown
    MIN_WIN_RATE: 0.55,         // 55% minimum win rate
    MIN_PROFIT_FACTOR: 1.5,     // Profit factor threshold
    MIN_SHARPE_RATIO: 1.2       // Minimum Sharpe ratio
  };

  static async trackTrade(trade: {
    modelId: number;
    entryPrice: number;
    exitPrice: number;
    size: number;
    type: 'LONG' | 'SHORT';
    timestamp: Date;
    confidence: number;
  }) {
    const pnl = this.calculatePnL(trade);
    await this.saveTrade({ ...trade, pnl });

    // Update model performance metrics
    await this.updateModelMetrics(trade.modelId);

    // Send notification if significant trade
    if (Math.abs(pnl.pnlPercent) > 2) {
      await notifyBot(`📊 Significant Trade
Type: ${trade.type}
PnL: ${pnl.pnlUSD.toFixed(2)} USD (${pnl.pnlPercent.toFixed(2)}%)
Confidence: ${(trade.confidence * 100).toFixed(1)}%`);
    }
  }

  private static calculatePnL(trade: any) {
    const pnlUSD = trade.type === 'LONG'
      ? (trade.exitPrice - trade.entryPrice) * trade.size
      : (trade.entryPrice - trade.exitPrice) * trade.size;

    const pnlPercent = (pnlUSD / (trade.entryPrice * trade.size)) * 100;

    return {
      pnlUSD,
      pnlPercent,
      roi: pnlPercent / trade.size // Return on investment
    };
  }

  static async getModelPerformance(modelId: number) {
    const db = await getDb();
    const trades = await db.all(`
      SELECT * FROM trades 
      WHERE model_id = ? 
      ORDER BY timestamp DESC 
      LIMIT 1000
    `, [modelId]);

    const metrics = this.calculatePerformanceMetrics(trades);

    return {
      ...metrics,
      isProfileProductive: this.isPerformanceAcceptable(metrics)
    };
  }

  private static calculatePerformanceMetrics(trades: any[]) {
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);

    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

    const returns = trades.map(t => t.pnl / t.size);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / trades.length;
    const stdReturn = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / trades.length
    );

    return {
      totalPnL,
      winRate: winningTrades.length / trades.length,
      profitFactor: grossProfit / grossLoss,
      sharpeRatio: avgReturn / stdReturn * Math.sqrt(252), // Annualized
      maxDrawdown: this.calculateMaxDrawdown(trades),
      avgWin: grossProfit / winningTrades.length,
      avgLoss: grossLoss / losingTrades.length,
      expectancy: (this.calculateExpectancy(trades) * 100).toFixed(2) // Expected return per trade
    };
  }

  private static calculateMaxDrawdown(trades: any[]) {
    let peak = -Infinity;
    let maxDrawdown = 0;
    let runningPnL = 0;

    for (const trade of trades) {
      runningPnL += trade.pnl;
      if (runningPnL > peak) peak = runningPnL;
      const drawdown = (peak - runningPnL) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return maxDrawdown;
  }

  private static calculateExpectancy(trades: any[]) {
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);

    const winRate = winningTrades.length / trades.length;
    const avgWin = winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length;
    const avgLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0)) / losingTrades.length;

    return (winRate * avgWin) - ((1 - winRate) * avgLoss);
  }

  private static async saveTrade(trade: any) {
    const db = await getDb();
    await db.run(`
      INSERT INTO trade_history (
        model_id,
        type,
        entry_price,
        exit_price,
        size,
        pnl,
        confidence,
        timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      trade.modelId,
      trade.type,
      trade.entryPrice,
      trade.exitPrice,
      trade.size,
      trade.pnl.pnlUSD,
      trade.confidence,
      trade.timestamp
    ]);
  }

  private static isPerformanceAcceptable(metrics: any) {
    return (
      metrics.winRate >= this.RISK_METRICS.MIN_WIN_RATE &&
      metrics.profitFactor >= this.RISK_METRICS.MIN_PROFIT_FACTOR &&
      metrics.sharpeRatio >= this.RISK_METRICS.MIN_SHARPE_RATIO &&
      metrics.maxDrawdown <= this.RISK_METRICS.MAX_DRAWDOWN_PERCENT / 100
    );
  }
}
