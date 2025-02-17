import { Trade, Position } from '../interfaces.js';

export class TradeSimulator {
  private balance: number;

  constructor(initialBalance: number) {
    this.balance = initialBalance;
  }

  simulateTrade(trade: Trade): Position {
    // Simulate trade execution and return the resulting position
    const exposure = parseFloat(trade.size) * parseFloat(trade.price);
    const position: Position = {
      id: trade.id.toString(),
      coin: 'BTCUSDT',
      type: trade.type,
      entryPrice: parseFloat(trade.price),
      size: parseFloat(trade.size),
      leverage: parseInt(trade.leverage),
      initialMargin: parseFloat(trade.amount),
      exposure,
      percentage: 0, // Initialize with 0
      liquidationPrice: this.calculateLiquidationPrice(trade),
      timestamp: new Date(trade.timestamp),
      status: trade.status
    };
    position.percentage = this.calculatePercentage(position);
    return position;
  }

  private calculateLiquidationPrice(trade: Trade): number {
    // Calculate liquidation price based on trade details
    return parseFloat(trade.price) * 0.9; // Placeholder calculation
  }

  private calculatePercentage(position: Position): number {
    // Calculate percentage change based on position details
    return (position.entryPrice - position.liquidationPrice) / position.entryPrice * 100;
  }
}
