import { MarketData } from '../types';
import { MLStrategy } from '../strategies/MLStrategy';

interface ValidationResult {
  accuracy: number;
  returns: number;
  winRate: number;
  trades: number;
}

export class CrossValidator {
  private readonly FOLDS = 5;
  private readonly VALIDATION_PERIOD = 30; // days

  public async validateStrategy(data: MarketData[], strategy: MLStrategy): Promise<{
    accuracy: number;
    robustness: number;
    consistency: number;
    metrics: ValidationMetrics;
  }> {
    const foldResults = await this.performCrossValidation(data, strategy);
    
    return {
      accuracy: this.calculateMean(foldResults.map(r => r.accuracy)),
      robustness: this.calculateStdDev(foldResults.map(r => r.returns)),
      consistency: this.calculateConsistencyScore(foldResults),
      metrics: this.aggregateMetrics(foldResults)
    };
  }

  private async performCrossValidation(data: MarketData[], strategy: MLStrategy): Promise<ValidationResult[]> {
    const foldSize = Math.floor(data.length / this.FOLDS);
    const results: ValidationResult[] = [];

    for (let i = 0; i < this.FOLDS; i++) {
      const validationStart = i * foldSize;
      const validationEnd = validationStart + foldSize;
      
      const trainingData = [
        ...data.slice(0, validationStart),
        ...data.slice(validationEnd)
      ];
      const validationData = data.slice(validationStart, validationEnd);

      // Use public train method instead of protected trainModel
      await strategy.train(trainingData);

      // Validate
      const foldResult = await this.validateFold(strategy, validationData);
      results.push(foldResult);
    }

    return results;
  }

  private async validateFold(strategy: MLStrategy, data: MarketData[]): Promise<ValidationResult> {
    let correct = 0;
    let returns = 0;
    let trades = 0;
    
    for (let i = 0; i < data.length - 1; i++) {
      const prediction = await strategy.analyze(data.slice(0, i + 1));
      const actualMove = data[i + 1].close - data[i].close;

      if ((prediction === 'buy' && actualMove > 0) || 
          (prediction === 'sell' && actualMove < 0) ||
          (prediction === 'hold' && Math.abs(actualMove) < 0.1)) {
        correct++;
      }

      if (prediction !== 'hold') trades++;
      returns += actualMove;
    }

    return {
      accuracy: correct / data.length,
      returns: returns / data.length,
      winRate: trades > 0 ? correct / trades : 0,
      trades
    };
  }

  private calculateMean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculateStdDev(values: number[]): number {
    const mean = this.calculateMean(values);
    return Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
  }

  private calculateConsistencyScore(results: ValidationResult[]): number {
    const winRates = results.map(r => r.winRate);
    return 1 - this.calculateStdDev(winRates) / this.calculateMean(winRates);
  }

  private aggregateMetrics(results: ValidationResult[]): ValidationMetrics {
    return {
      meanAccuracy: this.calculateMean(results.map(r => r.accuracy)),
      meanReturns: this.calculateMean(results.map(r => r.returns)),
      meanWinRate: this.calculateMean(results.map(r => r.winRate)),
      totalTrades: results.reduce((sum, r) => sum + r.trades, 0),
      foldResults: results
    };
  }
}

interface ValidationMetrics {
  meanAccuracy: number;
  meanReturns: number;
  meanWinRate: number;
  totalTrades: number;
  foldResults: ValidationResult[];
}
