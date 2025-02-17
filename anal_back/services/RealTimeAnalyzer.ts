import { TechnicalAnalyzer } from '../analysis/TechnicalAnalyzer.js';
import { WINDOW_CONFIG } from '../config/windowConfig.js';
import { RawDataPoint } from '../interfaces/DataTypes.js';

export class RealTimeAnalyzer {
  private mainTimeframe: RawDataPoint[] = [];
  private subTimeframes: { [key: string]: RawDataPoint[] } = {};
  private currentWindow: {
    mainCandle: RawDataPoint | null;
    subCandles: {
      '15m': RawDataPoint[];
      '5m': RawDataPoint[];
    };
  } = {
    mainCandle: null,
    subCandles: {
      '15m': [],
      '5m': []
    }
  };

  constructor() {}

  public async analyzeTimeWindow(
    mainCandle: RawDataPoint,
    subCandles: { [key: string]: RawDataPoint[] }
  ) {
    try {
      const mainTime = new Date(mainCandle.timestamp);
      
      // Clear log header
      console.log('\nAnalyzing new window');
      console.log(`Time: ${mainTime.toISOString()}`);

      // Sort and analyze 5m candles
      const sorted5m = (subCandles['5m'] || []).sort((a, b) => a.timestamp - b.timestamp);
      let fiveMinCount = 0;
      let fifteenMinCount = 0;

      // Process each candle
      for (const candle of sorted5m) {
        fiveMinCount++;
        const time = new Date(candle.timestamp);
        const timeStr = `${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`;
        
        const is15mBoundary = fiveMinCount % 3 === 0;
        if (is15mBoundary) {
          fifteenMinCount++;
          console.log(`${timeStr} (5m ${fiveMinCount}/12 & 15m ${fifteenMinCount}/4)`);
        } else {
          console.log(`${timeStr} (5m ${fiveMinCount}/12)`);
        }
      }

      // Simple summary
      console.log(`\nProcessed: 1h(1), 15m(${fifteenMinCount}), 5m(${fiveMinCount})`);

      // Analyze main timeframe quietly (without logs)
      const mainAnalysis = new TechnicalAnalyzer([...this.mainTimeframe, mainCandle], true)
        .analyzeCandle(this.mainTimeframe.length);

      // Update stored data
      this.updateStoredData(mainCandle, subCandles);

      return {
        timestamp: mainCandle.timestamp,
        mainTimeframe: mainAnalysis,
        subTimeframes: {
          '15m': fifteenMinCount,
          '5m': fiveMinCount
        },
        complete: (1 + fifteenMinCount + fiveMinCount) === 17
      };

    } catch (error) {
      console.error('Analysis error:', error);
      throw error;
    }
  }

  private updateStoredData(mainCandle: RawDataPoint, subCandles: { [key: string]: RawDataPoint[] }): void {
    this.mainTimeframe.push(mainCandle);
    for (const [interval, candles] of Object.entries(subCandles)) {
      this.subTimeframes[interval] = [
        ...(this.subTimeframes[interval] || []),
        ...candles
      ];
    }
    this.trimStoredData();
  }

  private trimStoredData(): void {
    const maxMainCandles = WINDOW_CONFIG.CANDLES.MAIN.COUNT;
    if (this.mainTimeframe.length > maxMainCandles) {
      this.mainTimeframe = this.mainTimeframe.slice(-maxMainCandles);
      
      // Also trim sub-timeframes proportionally
      for (const interval of Object.keys(this.subTimeframes)) {
        const multiplier = interval === '15m' ? 4 : 12;
        const maxSubCandles = maxMainCandles * multiplier;
        this.subTimeframes[interval] = this.subTimeframes[interval].slice(-maxSubCandles);
      }
    }
  }

  public getMarketState() {
    return {
      mainTimeframe: this.mainTimeframe,
      subTimeframes: this.subTimeframes
    };
  }
}
