import { MarketData } from '../types';

interface PatternResult {
  found: boolean;
  startIndex?: number;
  endIndex?: number;
  strength?: number;
  target?: number;
}

export class PatternDetector {
  constructor(private minPatternBars: number = 5) {}

  public detectAll(data: MarketData[]): {
    headAndShoulders: PatternResult;
    doubleTop: PatternResult;
    doubleBottom: PatternResult;
    bullishFlag: PatternResult;
    bearishFlag: PatternResult;
  } {
    return {
      headAndShoulders: this.findHeadAndShoulders(data),
      doubleTop: this.findDoubleTop(data),
      doubleBottom: this.findDoubleBottom(data),
      bullishFlag: this.findBullishFlag(data),
      bearishFlag: this.findBearishFlag(data)
    };
  }

  private findHeadAndShoulders(data: MarketData[]): PatternResult {
    const highs = data.map(d => d.high);
    const pivots = this.findPivotPoints(highs, 5);
    
    for (let i = 0; i < pivots.length - 4; i++) {
      const leftShoulder = pivots[i];
      const head = pivots[i + 2];
      const rightShoulder = pivots[i + 4];

      if (!leftShoulder || !head || !rightShoulder) continue;

      // Validate pattern
      const isValid = 
        head.value > leftShoulder.value &&
        head.value > rightShoulder.value &&
        Math.abs(leftShoulder.value - rightShoulder.value) / leftShoulder.value < 0.02 &&
        Math.abs(leftShoulder.index - head.index) === Math.abs(rightShoulder.index - head.index);

      if (isValid) {
        const neckline = (leftShoulder.value + rightShoulder.value) / 2;
        const pattern: PatternResult = {
          found: true,
          startIndex: leftShoulder.index,
          endIndex: rightShoulder.index,
          strength: (head.value - neckline) / neckline,
          target: neckline - (head.value - neckline) // Projected target
        };
        return pattern;
      }
    }

    return { found: false };
  }

  private findDoubleTop(data: MarketData[]): PatternResult {
    const highs = data.map(d => d.high);
    const pivots = this.findPivotPoints(highs, 5);
    
    for (let i = 0; i < pivots.length - 1; i++) {
      const top1 = pivots[i];
      const top2 = pivots[i + 1];

      if (!top1 || !top2) continue;

      const isValid = 
        Math.abs(top1.value - top2.value) / top1.value < 0.01 &&
        top2.index - top1.index >= this.minPatternBars;

      if (isValid) {
        const support = Math.min(
          ...data.slice(top1.index, top2.index).map(d => d.low)
        );
        
        return {
          found: true,
          startIndex: top1.index,
          endIndex: top2.index,
          strength: (top1.value - support) / support,
          target: support - (top1.value - support)
        };
      }
    }

    return { found: false };
  }

  private findDoubleBottom(data: MarketData[]): PatternResult {
    const lows = data.map(d => d.low);
    const pivots = this.findPivotPoints(lows, 5);
    
    for (let i = 0; i < pivots.length - 1; i++) {
      const bottom1 = pivots[i];
      const bottom2 = pivots[i + 1];

      if (!bottom1 || !bottom2) continue;

      // Validate pattern
      const isValid = 
        Math.abs(bottom1.value - bottom2.value) / bottom1.value < 0.01 &&
        bottom2.index - bottom1.index >= this.minPatternBars;

      if (isValid) {
        const resistance = Math.max(
          ...data.slice(bottom1.index, bottom2.index).map(d => d.high)
        );
        
        return {
          found: true,
          startIndex: bottom1.index,
          endIndex: bottom2.index,
          strength: (resistance - bottom1.value) / bottom1.value,
          target: resistance + (resistance - bottom1.value) // Projected target
        };
      }
    }

    return { found: false };
  }

  private findBullishFlag(data: MarketData[]): PatternResult {
    const trend = this.calculateTrend(data, 14);
    if (trend <= 0) return { found: false };

    const prices = data.map(d => d.close);
    const channelTop = this.calculateChannel(prices, 'top');
    const channelBottom = this.calculateChannel(prices, 'bottom');

    const isFlag = 
      channelTop.slope < 0 && 
      channelBottom.slope < 0 &&
      Math.abs(channelTop.slope - channelBottom.slope) < 0.1;

    if (isFlag) {
      const flagHeight = channelTop.value - channelBottom.value;
      return {
        found: true,
        startIndex: data.length - 20,
        endIndex: data.length - 1,
        strength: trend,
        target: prices[prices.length - 1] + flagHeight
      };
    }

    return { found: false };
  }

  private findBearishFlag(data: MarketData[]): PatternResult {
    const trend = this.calculateTrend(data, 14);
    if (trend >= 0) return { found: false };

    const prices = data.map(d => d.close);
    const channelTop = this.calculateChannel(prices, 'top');
    const channelBottom = this.calculateChannel(prices, 'bottom');

    const isFlag = 
      channelTop.slope > 0 && 
      channelBottom.slope > 0 &&
      Math.abs(channelTop.slope - channelBottom.slope) < 0.1;

    if (isFlag) {
      const flagHeight = channelTop.value - channelBottom.value;
      return {
        found: true,
        startIndex: data.length - 20,
        endIndex: data.length - 1,
        strength: Math.abs(trend),
        target: prices[prices.length - 1] - flagHeight
      };
    }

    return { found: false };
  }

  private calculateTrend(data: MarketData[], period: number): number {
    const prices = data.slice(-period).map(d => d.close);
    const xMean = (period - 1) / 2;
    const yMean = prices.reduce((a, b) => a + b) / period;

    let numerator = 0;
    let denominator = 0;

    prices.forEach((price, i) => {
      numerator += (i - xMean) * (price - yMean);
      denominator += Math.pow(i - xMean, 2);
    });

    return numerator / denominator;
  }

  private findPivotPoints(data: number[], window: number) {
    const pivots: Array<{ value: number; index: number }> = [];

    for (let i = window; i < data.length - window; i++) {
      const leftMax = Math.max(...data.slice(i - window, i));
      const rightMax = Math.max(...data.slice(i + 1, i + window + 1));
      
      if (data[i] > leftMax && data[i] > rightMax) {
        pivots.push({ value: data[i], index: i });
      }
    }

    return pivots;
  }

  private calculateChannel(data: number[], type: 'top' | 'bottom') {
    const period = Math.min(20, Math.floor(data.length / 2));
    const points = type === 'top' 
      ? this.findPivotPoints(data, 5)
      : this.findPivotPoints(data.map(p => -p), 5).map(p => ({ ...p, value: -p.value }));

    const recentPoints = points.slice(-period);
    
    if (recentPoints.length < 2) {
      return { slope: 0, value: data[data.length - 1] };
    }

    const xMean = recentPoints.reduce((a, p) => a + p.index, 0) / recentPoints.length;
    const yMean = recentPoints.reduce((a, p) => a + p.value, 0) / recentPoints.length;

    let numerator = 0;
    let denominator = 0;

    recentPoints.forEach(point => {
      numerator += (point.index - xMean) * (point.value - yMean);
      denominator += Math.pow(point.index - xMean, 2);
    });

    const slope = numerator / denominator;
    const value = yMean + slope * (data.length - 1 - xMean);

    return { slope, value };
  }
}
