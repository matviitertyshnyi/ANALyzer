import { MarketData } from '../types';
import { PatternDetector } from '../indicators/patterns';
import { MarketRegime } from '../analytics/MarketRegime';
import { ExternalDataIntegrator } from '../data/ExternalDataIntegrator';

export class MultiTimeframeAnalyzer {
  private readonly timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
  private data: { [key: string]: MarketData[] } = {};
  
  constructor(
    private patternDetector: PatternDetector,
    private marketRegime: MarketRegime,
    private dataIntegrator: ExternalDataIntegrator
  ) {}

  public async analyze(symbol: string): Promise<{
    trend: { [timeframe: string]: string };
    patterns: { [timeframe: string]: any };
    confirmation: number;
    strength: number;
  }> {
    await this.updateData(symbol);
    
    const analysis = this.timeframes.reduce((acc, tf) => ({
      ...acc,
      [tf]: {
        regime: this.marketRegime.detectRegime(this.data[tf]),
        patterns: this.patternDetector.detectAll(this.data[tf])
      }
    }), {});

    return {
      trend: this.aggregateTrends(analysis),
      patterns: this.aggregatePatterns(analysis),
      confirmation: this.calculateConfirmation(analysis),
      strength: this.calculateSignalStrength(analysis)
    };
  }

  private async updateData(symbol: string): Promise<void> {
    for (const timeframe of this.timeframes) {
      this.data[timeframe] = await this.dataIntegrator.fetchMarketData(symbol, timeframe);
    }
  }

  private aggregateTrends(analysis: any): { [timeframe: string]: string } {
    return this.timeframes.reduce((acc, tf) => ({
      ...acc,
      [tf]: analysis[tf].regime.trend
    }), {});
  }

  private aggregatePatterns(analysis: any): { [timeframe: string]: any } {
    return this.timeframes.reduce((acc, tf) => ({
      ...acc,
      [tf]: analysis[tf].patterns
    }), {});
  }

  private calculateConfirmation(analysis: any): number {
    const trends = this.timeframes.map(tf => analysis[tf].regime.trend);
    const bullishCount = trends.filter(t => t === 'bullish').length;
    const bearishCount = trends.filter(t => t === 'bearish').length;

    return bullishCount > bearishCount ? bullishCount / trends.length : bearishCount / trends.length;
  }

  private calculateSignalStrength(analysis: any): number {
    const momentumScores = this.timeframes.map(tf => analysis[tf].regime.momentum === 'strong' ? 1 : 0);
    return momentumScores.reduce((sum: number, score: number) => sum + score, 0) / momentumScores.length;
  }
}
