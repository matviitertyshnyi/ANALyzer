import { MarketData, BotConfig, OptimizationResult, SimulationResults } from '../types';
import { MonteCarloSimulator } from '../backtesting/MonteCarloSimulator';
import { BaseStrategy } from '../strategies/BaseStrategy';
import { notifyBot } from '../../lib/services/telegram';

interface ParameterRange {
  min: number;
  max: number;
  step: number;
}

export class PerformanceOptimizer {
  private readonly simulator: MonteCarloSimulator;
  private progress: number = 0;
  private totalCombinations: number = 0;

  constructor() {
    this.simulator = new MonteCarloSimulator();
  }

  public async optimizeParameters(
    strategy: BaseStrategy,
    historicalData: MarketData[],
    onProgress?: (progress: number) => void
  ): Promise<OptimizationResult> {
    const parameterRanges = {
      stopLoss: { min: 1, max: 5, step: 0.5 },
      takeProfit: { min: 2, max: 8, step: 1 },
      maxLeverage: { min: 5, max: 20, step: 5 },
      riskPerTrade: { min: 1, max: 5, step: 0.5 }
    };

    await notifyBot(`[Optimizer] Starting optimization
Data Length: ${historicalData.length} periods
Parameters: Stop Loss, Take Profit, Leverage, Risk`);

    this.calculateTotalCombinations(parameterRanges);
    this.progress = 0;

    let bestConfig: BotConfig = {
      symbol: strategy.getSymbol(),
      interval: strategy.getInterval(),
      stopLoss: 0,
      takeProfit: 0,
      maxLeverage: 0,
      riskPerTrade: 0
    };
    let bestScore = -Infinity;
    let bestResults: any = null;

    // Grid search through parameter combinations
    for (let sl = parameterRanges.stopLoss.min; sl <= parameterRanges.stopLoss.max; sl += parameterRanges.stopLoss.step) {
      for (let tp = parameterRanges.takeProfit.min; tp <= parameterRanges.takeProfit.max; tp += parameterRanges.takeProfit.step) {
        for (let lev = parameterRanges.maxLeverage.min; lev <= parameterRanges.maxLeverage.max; lev += parameterRanges.maxLeverage.step) {
          for (let risk = parameterRanges.riskPerTrade.min; risk <= parameterRanges.riskPerTrade.max; risk += parameterRanges.riskPerTrade.step) {
            const config: BotConfig = {
              symbol: strategy.getSymbol(),
              interval: strategy.getInterval(),
              stopLoss: sl,
              takeProfit: tp,
              maxLeverage: lev,
              riskPerTrade: risk
            };

            const { score, results } = await this.evaluateConfig(strategy, config, historicalData);

            if (score > bestScore) {
              bestScore = score;
              bestConfig = config;
              bestResults = results;
            }

            this.progress++;
            if (onProgress) {
              onProgress((this.progress / this.totalCombinations) * 100);
            }
          }
        }
      }
    }

    await notifyBot(`[Optimizer] Complete
Best Configuration:
Stop Loss: ${bestConfig.stopLoss}%
Take Profit: ${bestConfig.takeProfit}%
Leverage: ${bestConfig.maxLeverage}x
Risk per Trade: ${bestConfig.riskPerTrade}%
Score: ${bestScore.toFixed(2)}
Win Rate: ${bestResults.winRate.toFixed(2)}%
Return: ${bestResults.expectedReturn.toFixed(2)}%`);

    return {
      config: bestConfig,
      score: bestScore,
      metrics: bestResults
    };
  }

  private calculateTotalCombinations(ranges: Record<string, ParameterRange>): void {
    this.totalCombinations = Object.values(ranges).reduce((total, range) => {
      const steps = Math.ceil((range.max - range.min) / range.step) + 1;
      return total ? total * steps : steps;
    }, 0);
  }

  private async evaluateConfig(
    strategy: BaseStrategy,
    config: BotConfig,
    data: MarketData[]
  ): Promise<{ score: number; results: SimulationResults }> {
    const results = await this.simulator.simulateStrategy(strategy, data, 50);
    
    // Calculate weighted score based on multiple metrics
    const score = 
      results.winRate * 0.3 +
      results.expectedReturn * 0.3 +
      (1 / Math.max(results.maxDrawdown, 1)) * 0.2 +
      results.riskMetrics.sharpeRatio * 0.2;

    return { score, results };
  }
}
