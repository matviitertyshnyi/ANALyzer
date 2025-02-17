import { MLModelService } from './MLModelService.js';
import { RealTimeAnalyzer } from './RealTimeAnalyzer.js';
import { ML_CONFIG } from '../config/mlConfig.js';
import { PerformanceTracker } from './PerformanceTracker.js';
import { RawDataPoint } from '../interfaces/DataTypes.js';

export class ContinuousLearner {
  private model: MLModelService;
  private analyzer: RealTimeAnalyzer;
  private performance: PerformanceTracker;
  private lastSaveTime: number = Date.now();
  private trainingBuffer: RawDataPoint[] = [];

  constructor() {
    this.model = new MLModelService();
    this.analyzer = new RealTimeAnalyzer();
    this.performance = new PerformanceTracker(ML_CONFIG.TRADING.POSITION_SIZING.INITIAL_CAPITAL);
  }

  public async processNewData(
    mainCandle: RawDataPoint,
    subCandles: { [key: string]: RawDataPoint[] }
  ) {
    try {
      // Real-time analysis
      const analysis = await this.analyzer.analyzeTimeWindow(mainCandle, subCandles);
      
      // Add to training buffer
      this.trainingBuffer.push(mainCandle);

      // Check if we should perform incremental training
      if (this.trainingBuffer.length >= ML_CONFIG.TRAINING.BATCH_SIZE) {
        await this.performIncrementalTraining();
      }

      // Auto-save state periodically
      if (Date.now() - this.lastSaveTime > ML_CONFIG.TRAINING.MEMORY.SAVE_INTERVAL * 60000) {
        await this.saveState();
        this.lastSaveTime = Date.now();
      }

      return analysis;

    } catch (error) {
      console.error('Continuous learning error:', error);
      throw error;
    }
  }

  private async performIncrementalTraining() {
    console.log('\n=== Performing Incremental Training ===');
    console.log(`Buffer size: ${this.trainingBuffer.length} candles`);

    try {
      // Train on buffered data
      await this.model.train(this.trainingBuffer);
      
      // Clear buffer after successful training
      this.trainingBuffer = [];

      // Check performance and adjust if needed
      const stats = this.model.getLatestStats();
      if (stats) {
        const performance = this.performance.evaluatePerformance(stats);
        
        if (performance.requiresAdjustment) {
          console.log('⚠️ Performance degradation detected, adjusting model...');
          await this.model.adjustHyperparameters(performance.suggestions);
        }
      }

    } catch (error) {
      console.error('Incremental training error:', error);
      throw error;
    }
  }

  private async saveState() {
    console.log('\n=== Saving System State ===');
    try {
      await this.model.saveState();
      console.log('✅ State saved successfully');
    } catch (error) {
      console.error('State save error:', error);
      throw error;
    }
  }
}
