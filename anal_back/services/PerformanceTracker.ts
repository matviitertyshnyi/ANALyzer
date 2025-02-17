  export class PerformanceTracker {
    private metrics: {
      cumulativePnL: number;
      trades: any[];
      winningTrades: number;
      losingTrades: number;
      maxDrawdown: number;
      peakBalance: number;
      currentBalance: number;
      epochMetrics: Map<number, any>;
    };

    constructor(initialBalance: number) {
      this.metrics = {
        cumulativePnL: 0,
        trades: [],
        winningTrades: 0,
        losingTrades: 0,
        maxDrawdown: 0,
        peakBalance: initialBalance,
        currentBalance: initialBalance,
        epochMetrics: new Map()
      };
    }

    updateMetrics(epoch: number, trades: any[]): void {
      // Update cumulative metrics
      trades.forEach(trade => {
        this.metrics.trades.push(trade);
        this.metrics.cumulativePnL += trade.pnl;
        this.metrics.currentBalance += trade.pnl;
        
        if (trade.pnl > 0) this.metrics.winningTrades++;
        if (trade.pnl < 0) this.metrics.losingTrades++;

        // Update peak balance and drawdown
        if (this.metrics.currentBalance > this.metrics.peakBalance) {
          this.metrics.peakBalance = this.metrics.currentBalance;
        }
        
        const drawdown = (this.metrics.peakBalance - this.metrics.currentBalance) / this.metrics.peakBalance;
        this.metrics.maxDrawdown = Math.max(this.metrics.maxDrawdown, drawdown);
      });

      // Store epoch-specific metrics
      this.metrics.epochMetrics.set(epoch, {
        trades: trades.length,
        pnl: trades.reduce((sum, t) => sum + t.pnl, 0),
        winRate: this.calculateWinRate(trades),
        drawdown: this.metrics.maxDrawdown
      });
    }

    private calculateWinRate(trades: any[]): number {
      if (trades.length === 0) return 0;
      const winners = trades.filter(t => t.pnl > 0).length;
      return winners / trades.length;
    }

    getMetrics() {
      return {
        ...this.metrics,
        totalTrades: this.metrics.trades.length,
        winRate: this.calculateWinRate(this.metrics.trades),
        averagePnL: this.metrics.cumulativePnL / Math.max(1, this.metrics.trades.length)
      };
    }
  }
