import { Trade, Position, PositionType } from './interfaces';

export function calculateLiquidationPrice(trade: Trade): number {
  const price = parseFloat(trade.price);
  const leverage = parseInt(trade.leverage);
  
  if (isNaN(price) || isNaN(leverage) || leverage === 0) {
    return 0;
  }
  
  return trade.type === 'LONG' 
    ? price * (1 - 1/leverage)
    : price * (1 + 1/leverage);
}

export function calculateAverage(numbers: number[]): number {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return 0;
  }
  return numbers.reduce((sum: number, num: number): number => sum + num, 0) / numbers.length;
}

export function sortByTime<T extends { time?: number }>(a: T, b: T): number {
  return (a.time ?? 0) - (b.time ?? 0);
}

export function formatPositionType(type: string): PositionType {
  return type.toUpperCase() as PositionType;
}

export function getTimestamp(date: Date | number): number {
  return date instanceof Date ? date.getTime() : date;
}

export function calculatePercentage(position: Position): number {
  if (!position) return 0;
  const exposure = position.size * position.entryPrice;
  return (exposure / position.initialMargin) * 100;
}

export function formatValue(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}
