import { getDb } from '../database';
import { notifyBot } from '../../lib/services/telegram';
import { MonteCarloSimulator } from './MonteCarloSimulator';

export class ModelValidator {
  private static PERFORMANCE_THRESHOLD = 0.55; // 55% accuracy minimum
  private static CONFIDENCE_THRESHOLD = 0.65; // 65% confidence minimum

  static async validateModel(modelId: number, metrics: any, model: any, historicalData: number[][]) {
    const db = await getDb();
    
    // Check if model meets minimum performance requirements
    if (metrics.accuracy < this.PERFORMANCE_THRESHOLD) {
      await notifyBot(`⚠️ Model ${modelId} failed validation
Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%
Required: ${(this.PERFORMANCE_THRESHOLD * 100)}%`);
      return false;
    }

    // Check recent predictions performance
    const recentPredictions = await db.all(`
      SELECT * FROM ml_predictions 
      WHERE model_id = ? 
      ORDER BY timestamp DESC 
      LIMIT 100
    `, [modelId]);

    const accurateCount = recentPredictions.filter(p => 
      p.actual_outcome === p.prediction && p.confidence > this.CONFIDENCE_THRESHOLD
    ).length;

    const recentAccuracy = accurateCount / recentPredictions.length;

    if (recentAccuracy < this.PERFORMANCE_THRESHOLD) {
      await notifyBot(`📉 Model ${modelId} performance degrading
Recent Accuracy: ${(recentAccuracy * 100).toFixed(1)}%
Required: ${(this.PERFORMANCE_THRESHOLD * 100)}%
Initiating retraining...`);
      return false;
    }

    // Run Monte Carlo simulation
    const simulationResults = await MonteCarloSimulator.simulateTrading(model, historicalData, {
      initialCapital: 1000,
      simulations: 1000,
      horizon: 30,
      riskPerTrade: 2,
      maxLeverage: 10
    });

    await notifyBot(`📊 Monte Carlo Simulation Results:
Average Return: ${simulationResults.averageReturn.toFixed(2)}%
Success Rate: ${(simulationResults.successRate * 100).toFixed(1)}%
Best Case: ${simulationResults.bestCase.toFixed(2)}%
Worst Case: ${simulationResults.worstCase.toFixed(2)}%`);

    // Additional validation based on simulation
    if (simulationResults.averageReturn < 0 || simulationResults.successRate < 0.5) {
      await notifyBot('⚠️ Model failed Monte Carlo validation');
      return false;
    }

    return true;
  }
}
