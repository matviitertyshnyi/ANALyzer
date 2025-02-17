import { getDb } from '../database.js';

interface BalanceUpdate {
  timestamp: Date;
  balance: number;
  pnl: number;
  reason: 'TRADE' | 'FEE' | 'FUNDING' | 'DEPOSIT' | 'WITHDRAWAL';
  details: string;
}

export class BalanceTracker {
  private initialBalance: number;
  private currentBalance: number;
  private history: BalanceUpdate[] = [];
  private peakBalance: number;
  private maxDrawdown: number = 0;

  constructor(initialBalance: number) {
    this.initialBalance = initialBalance;
    this.currentBalance = initialBalance;
    this.peakBalance = initialBalance;
    
    // Record initial balance
    this.recordUpdate({
      timestamp: new Date(),
      balance: initialBalance,
      pnl: 0,
      reason: 'DEPOSIT',
      details: 'Initial balance'
    });
  }

  public async updateBalance(pnl: number, reason: BalanceUpdate['reason'], details: string): Promise<void> {
    try {
      // Validate PnL
      const normalizedPnL = Number(pnl);
      if (isNaN(normalizedPnL)) {
        throw new Error(`Invalid PnL value: ${pnl}`);
      }

      // Prevent catastrophic losses
      if (Math.abs(normalizedPnL) > this.initialBalance * 0.1) { // Max 10% loss per trade
        console.error('PnL exceeds maximum allowed loss:', normalizedPnL);
        return;
      }

      const newBalance = this.currentBalance + normalizedPnL;
      
      // Prevent negative balance
      if (newBalance < 0) {
        console.error('Operation would result in negative balance:', newBalance);
        return;
      }

      // Log the values for debugging
      console.log('Balance update values:', {
        currentBalance: this.currentBalance,
        pnl: normalizedPnL,
        newBalance,
        reason
      });

      const update: BalanceUpdate = {
        timestamp: new Date(),
        balance: newBalance,
        pnl: normalizedPnL,
        reason,
        details: details || 'No details provided'
      };

      // Update balance before database operation
      this.currentBalance = newBalance;
      this.recordUpdate(update);

      // Update peak and drawdown
      if (newBalance > this.peakBalance) {
        this.peakBalance = newBalance;
      } else {
        const drawdown = (this.peakBalance - newBalance) / this.peakBalance;
        this.maxDrawdown = Math.max(this.maxDrawdown, drawdown);
      }

      // Database update can be async
      await this.logToDatabase(update).catch(err => {
        console.error('Database update failed:', err);
        // Don't throw here, we already updated memory state
      });

    } catch (error) {
      console.error('Balance update error:', error);
      // Don't throw, maintain last valid state
    }
  }

  public async restoreState(state: {
    initialBalance: number;
    currentBalance: number;
    peakBalance: number;
    maxDrawdown: number;
    history: BalanceUpdate[];
  }): Promise<void> {
    try {
      // Validate the state
      if (!state || typeof state.currentBalance !== 'number') {
        throw new Error('Invalid state object');
      }

      // Restore values
      this.initialBalance = state.initialBalance;
      this.currentBalance = state.currentBalance;
      this.peakBalance = state.peakBalance;
      this.maxDrawdown = state.maxDrawdown / 100; // Convert back from percentage
      this.history = state.history;

      // Log restoration
      console.log('Balance state restored:', {
        initialBalance: this.initialBalance,
        currentBalance: this.currentBalance,
        peakBalance: this.peakBalance,
        maxDrawdown: this.maxDrawdown
      });

      // Record restoration in history
      await this.updateBalance(
        0,
        'DEPOSIT',
        'State restored from previous session'
      );

    } catch (error) {
      console.error('Failed to restore balance state:', error);
      // Don't throw, just keep initial values
    }
  }

  public async resetBalance(): Promise<void> {
    try {
      this.currentBalance = this.initialBalance;
      this.peakBalance = this.initialBalance;
      this.maxDrawdown = 0;
      
      await this.updateBalance(
        0, 
        'DEPOSIT',
        'Balance reset due to excessive drawdown'
      );

      console.log('Balance reset to:', {
        initialBalance: this.initialBalance,
        currentBalance: this.currentBalance,
        peakBalance: this.peakBalance,
        maxDrawdown: this.maxDrawdown
      });

    } catch (error) {
      console.error('Failed to reset balance:', error);
    }
  }

  private async ensureTablesExist(): Promise<void> {
    const db = await getDb();
    await db.exec(`
        CREATE TABLE IF NOT EXISTS balance_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME NOT NULL,
            balance REAL NOT NULL,
            pnl REAL NOT NULL,
            reason TEXT NOT NULL,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS account_balance (
            id INTEGER PRIMARY KEY,
            balance REAL NOT NULL DEFAULT 500,
            last_update DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
  }

  private async logToDatabase(update: BalanceUpdate): Promise<void> {
    try {
      await this.ensureTablesExist();
      const db = await getDb();
      
      // Ensure all values are valid numbers
      const values = [
        update.timestamp.toISOString(),
        Number(update.balance).toFixed(8),
        Number(update.pnl).toFixed(8),
        update.reason,
        update.details
      ];

      // Validate before insert
      if (values.some(v => v === undefined || v === null)) {
        throw new Error(`Invalid values in update: ${JSON.stringify(values)}`);
      }

      await db.run(`
        INSERT INTO balance_history (
          timestamp,
          balance,
          pnl,
          reason,
          details
        ) VALUES (?, ?, ?, ?, ?)
      `, values);

    } catch (error) {
      console.error('Database logging error:', error);
      throw error; // Re-throw to handle in updateBalance
    }
  }

  private recordUpdate(update: BalanceUpdate): void {
    this.history.push(update);
  }

  public getMetrics() {
    const totalPnL = this.currentBalance - this.initialBalance;
    const percentageReturn = (totalPnL / this.initialBalance) * 100;
    
    return {
      initialBalance: this.initialBalance,
      currentBalance: this.currentBalance,
      totalPnL,
      percentageReturn,
      peakBalance: this.peakBalance,
      maxDrawdown: this.maxDrawdown * 100, // Convert to percentage
      history: this.history
    };
  }

  public getHistory(): BalanceUpdate[] {
    return this.history;
  }

  public getCurrentBalance(): number {
    return this.currentBalance;
  }

  public async getBalanceHistory(days: number = 30): Promise<BalanceUpdate[]> {
    const db = await getDb();
    return await db.all(`
        SELECT * FROM balance_history 
        WHERE timestamp >= datetime('now', '-${days} days')
        ORDER BY timestamp DESC
    `);
  }
}
