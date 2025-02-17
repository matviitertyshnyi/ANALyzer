import { MarketData } from '../types';

export class MarketRegime {
  private readonly LOOKBACK_PERIODS = [20, 50, 200];

  public detectRegime(data: MarketData[]): {
    trend: 'bullish' | 'bearish' | 'sideways';
    volatility: 'high' | 'normal' | 'low';
    momentum: 'strong' | 'weak';
    support: number;
    resistance: number;
  } {
    const trend = this.detectTrend(data);
    const volatility = this.calculateVolatility(data);
    const momentum = this.calculateMomentum(data);
    const levels = this.findKeyLevels(data);

    return {
      trend: this.classifyTrend(trend),
      volatility: this.classifyVolatility(volatility),
      momentum: this.classifyMomentum(momentum),
      support: levels.support,
      resistance: levels.resistance
    };
  }

  private detectTrend(data: MarketData[]): number {
    const mas = this.LOOKBACK_PERIODS.map(period => 
      this.calculateMA(data.slice(-period))
    );
    
    return mas[0] > mas[1] && mas[1] > mas[2] ? 1 :
           mas[0] < mas[1] && mas[1] < mas[2] ? -1 : 0;
  }

  private calculateVolatility(data: MarketData[]): number {
    const returns = data.slice(-20).map((d, i) => 
      i === 0 ? 0 : (d.close - data[i-1].close) / data[i-1].close
    );
    
    return Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length);
  }

  private calculateMomentum(data: MarketData[]): number {
    const returns = data.slice(-14).map((d, i) => 
      i === 0 ? 0 : (d.close - data[i-1].close) / data[i-1].close
    );
    
    return returns.reduce((sum, r) => sum + r, 0);
  }

  private findKeyLevels(data: MarketData[]): { support: number; resistance: number } {
    const lows = data.map(d => d.low);
    const highs = data.map(d => d.high);
    
    const support = Math.min(...lows);
    const resistance = Math.max(...highs);
    
    return { support, resistance };
  }

  private calculateMA(data: MarketData[]): number {
    return data.reduce((sum, d) => sum + d.close, 0) / data.length;
  }

  private classifyTrend(trend: number): 'bullish' | 'bearish' | 'sideways' {
    return trend === 1 ? 'bullish' : trend === -1 ? 'bearish' : 'sideways';
  }

  private classifyVolatility(volatility: number): 'high' | 'normal' | 'low' {
    return volatility > 0.02 ? 'high' : volatility < 0.01 ? 'low' : 'normal';
  }

  private classifyMomentum(momentum: number): 'strong' | 'weak' {
    return momentum > 0 ? 'strong' : 'weak';
  }
}
