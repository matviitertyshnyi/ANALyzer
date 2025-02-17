import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-node-gpu';
import { DataManager } from './DataManager.js';
import { TRADING_CONFIG } from '../config/tradingConfig.js';
import { ML_CONFIG } from '../config/mlConfig.js';
import { notifyBot } from '../../lib/services/telegram.js';
import { resolve } from 'path';
import { TradeSimulator } from './TradeSimulator.js';
import { PerformanceTracker } from './PerformanceTracker.js';
import { BalanceTracker } from './BalanceTracker.js';
import { getDb } from '../database.js';
import { RawDataPoint, AnalysisResult } from '../interfaces/DataTypes.js';

// Add interfaces for type safety
interface TrainingData {
  features: tf.Tensor3D;
  labels: tf.Tensor2D;
}

interface BasicStats {
  accuracy: number;
  loss: number;
  validationAccuracy?: number;
  validationLoss?: number;
}

interface TrainingStats extends BasicStats {
  epoch: number;
  profitMetrics: ProfitabilityMetrics;
  riskMetrics: RiskMetrics;
  tradeMetrics: TradeMetrics;
  performance: PerformanceMetrics;
}

interface ProfitabilityMetrics {
  totalPnL: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  expectedValue: number;
  currentBalance?: number;
  peakBalance?: number;
  percentageReturn?: number;
}

interface RiskMetrics {
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  riskAdjustedReturn: number;
  valueAtRisk: number;
}

interface TradeMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageHoldingTime: number;
  averageSlippage: number;
  fillRatio: number;
}

interface PerformanceMetrics {
  accuracy: number;
  loss: number;
  validationAccuracy?: number;
  validationLoss?: number;
}

interface ModelOutput {
  signal: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence: number;
  suggestedEntry: number;
  stopLoss: number;
  takeProfit: number;
}

export class MLModelService {
  private model: tf.LayersModel | null = null;  // Change from definite assignment to nullable initialization
  private modelPath: string;
  private metrics: {
    trainAccuracy: number[];
    validationAccuracy: number[];
    pnl: number[];
  };
  private windowSize: number;
  private features: string[];
  private currentStats: TrainingStats | null = null;
  private tradeHistory: any[] = [];
  private checkpoints: Map<number, any> = new Map();
  private latestData: RawDataPoint[] = [];
  private bestStats: TrainingStats | null = null;
  private tradeSimulator: TradeSimulator;
  private performanceTracker: PerformanceTracker;
  private balanceTracker: BalanceTracker;
  private symbol: string = '';
  private timeframes: { [key: string]: RawDataPoint[] } = {};
  private currentWindowIndex: number = 0;
  private windowCount: number = 0;

  constructor() {
    this.modelPath = resolve(ML_CONFIG.MODEL.SAVE_PATH);
    this.metrics = {
      trainAccuracy: [],
      validationAccuracy: [],
      pnl: []
    };
    this.windowSize = 60; // 60 periods lookback
    this.features = TRADING_CONFIG.TRAINING.FEATURES;
    this.initializeBackend();
    this.tradeSimulator = new TradeSimulator();
    this.performanceTracker = new PerformanceTracker(ML_CONFIG.TRAINING.POSITION_SIZING.INITIAL_CAPITAL);
    this.balanceTracker = new BalanceTracker(ML_CONFIG.TRADING.POSITION_SIZING.INITIAL_MARGIN);
    // Model will be initialized in loadOrCreateModel
  }

  private async initializeBackend() {
    try {
      await tf.ready();
      
      // Try to use TensorFlow Node.js backend with CUDA 11
      if (tf.getBackend() !== 'tensorflow') {
        await tf.setBackend('tensorflow');
        console.log('Using TensorFlow GPU backend');
      }

      // Log initialization without memory stats
      console.log('TensorFlow.js initialized:', {
        backend: tf.getBackend(),
        version: tf.version.tfjs
      });

    } catch (error) {
      console.error('GPU backend initialization failed:', error);
      console.log('Falling back to CPU backend');
      await tf.setBackend('cpu');
    }
  }

  private async loadOrCreateModel(): Promise<tf.LayersModel> {
    try {
      // Validate input shape parameters
      if (!this.windowSize || !this.features?.length) {
        console.error('Invalid model parameters:', {
          windowSize: this.windowSize,
          features: this.features?.length
        });
        throw new Error('Invalid model parameters');
      }

      // Try to load existing model
      try {
        const modelPath = `file://${this.modelPath}/model.json`;
        console.log('Attempting to load model from:', modelPath);
        
        const loadedModel = await tf.loadLayersModel(modelPath);  // Change variable name to avoid shadowing
        console.log('Loaded existing model');
        
        // Verify model structure
        const inputShape = loadedModel.inputs[0].shape;
        console.log('Loaded model input shape:', inputShape);
        
        if (inputShape[1] !== this.windowSize || inputShape[2] !== this.features.length) {
          console.warn('Loaded model shape mismatch, creating new model');
          throw new Error('Model shape mismatch');
        }
        
        this.model = loadedModel;  // Assign to class property
        return this.model;
        
      } catch (loadError: unknown) {
        const errorMessage = loadError instanceof Error ? loadError.message : 'Unknown error';
        console.log('Could not load existing model:', errorMessage);
        return this.createModel();
      }
    } catch (error) {
      console.error('Model initialization error:', error);
      return this.createModel();
    }
  }

  private createModel(): tf.LayersModel {
    console.log('Creating new model with shape:', [this.windowSize, this.features.length]);
    
    const model = tf.sequential();

    // Input layer
    model.add(tf.layers.inputLayer({
      inputShape: [this.windowSize, this.features.length]
    }));

    // First LSTM layer
    model.add(tf.layers.lstm({
      units: 50,
      returnSequences: true,
      activation: 'tanh'
    }));

    // Dropout for regularization
    model.add(tf.layers.dropout({ rate: 0.2 }));

    // Second LSTM layer
    model.add(tf.layers.lstm({
      units: 30,
      returnSequences: false,
      activation: 'tanh'
    }));

    // Dense layers
    model.add(tf.layers.dense({
      units: 20,
      activation: 'relu'
    }));

    model.add(tf.layers.dropout({ rate: 0.1 }));

    // Output layer (3 classes: LONG, SHORT, NEUTRAL)
    model.add(tf.layers.dense({
      units: 3,
      activation: 'softmax'
    }));

    // Compile model
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // Log model structure
    model.summary();
    this.model = model;
    
    console.log('Model created successfully');
    return model;
  }

  private async normalizeData(data: RawDataPoint[]): Promise<tf.Tensor2D> {
    // Normalize the data using min-max scaling
    const tensorData = data.map(d => [
      d.open,
      d.high,
      d.low,
      d.close,
      d.volume
    ]);

    const tensor = tf.tensor2d(tensorData);
    const min = tensor.min(0);
    const max = tensor.max(0);
    
    return tensor.sub(min).div(max) as tf.Tensor2D;
  }

  private normalizeValue(value: any): number {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  private calculateIndicators(data: RawDataPoint[]): number[][] {
    if (!Array.isArray(data) || data.length < 14) {  // Need at least 14 periods for RSI
      console.error("Invalid data format or insufficient data in calculateIndicators:", data);
      throw new Error("Data must be an array with at least 14 periods");
    }

    // Pre-calculate arrays we'll need multiple times
    const closes = data.map(c => this.normalizeValue(c.close));
    const highs = data.map(c => this.normalizeValue(c.high));
    const lows = data.map(c => this.normalizeValue(c.low));
    const volumes = data.map(c => this.normalizeValue(c.volume));

    // Calculate indicators for each candle
    return data.map((candle, i) => {
      try {
        if (!candle) {
          console.error("Invalid candle data:", candle);
          return Array(8).fill(0);
        }

        // Convert and validate each value for current candle
        const close = closes[i];
        const high = highs[i];
        const low = lows[i];
        const volume = volumes[i];

        // Only calculate if we have enough previous data
        if (i < 14) {
          return [close, volume, 50, 0, high * 1.02, low * 0.98, high - low, 0];
        }

        // Calculate RSI
        const rsi = this.calculateRSI(closes.slice(i - 14, i + 1));

        // Calculate MACD
        const macd = this.calculateMACD(
          closes.slice(Math.max(0, i - 26), i + 1)
        );

        // Calculate Bollinger Bands
        const bb = this.calculateBollingerBands(
          closes.slice(Math.max(0, i - 20), i + 1)
        );

        // Calculate ATR
        const atr = this.calculateATR(
          highs.slice(i - 14, i + 1),
          lows.slice(i - 14, i + 1),
          closes.slice(i - 14, i + 1)
        );

        // Calculate trend strength
        const trendStrength = this.calculateTrendStrength(
          closes.slice(Math.max(0, i - 20), i + 1),
          highs.slice(Math.max(0, i - 20), i + 1),
          lows.slice(Math.max(0, i - 20), i + 1)
        );

        return [
          close,
          volume,
          rsi,
          macd,
          bb.upper,
          bb.lower,
          atr,
          trendStrength
        ];

      } catch (error) {
        console.error("Error processing candle:", candle, error);
        return Array(8).fill(0);
      }
    });
  }

  private calculateRSI(prices: number[]): number {
    const changes = prices.slice(1).map((price, i) => price - prices[i]);
    const gains = changes.map(c => c > 0 ? c : 0);
    const losses = changes.map(c => c < 0 ? -c : 0);
    
    const averageGain = gains.reduce((sum, gain) => sum + gain, 0) / 14;
    const averageLoss = losses.reduce((sum, loss) => sum + loss, 0) / 14;
    
    if (averageLoss === 0) return 100;
    
    const rs = averageGain / averageLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(prices: number[]): number {
    if (prices.length < 26) return 0;

    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    
    return ema12 - ema26;
  }

  private calculateEMA(prices: number[], period: number): number {
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  private calculateBollingerBands(prices: number[]): { upper: number; lower: number } {
    const sma = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const squaredDiffs = prices.map(price => Math.pow(price - sma, 2));
    const stdDev = Math.sqrt(squaredDiffs.reduce((sum, diff) => sum + diff, 0) / prices.length);
    
    return {
      upper: sma + (2 * stdDev),
      lower: sma - (2 * stdDev)
    };
  }

  private calculateATR(highs: number[], lows: number[], closes: number[]): number {
    const ranges = highs.map((high, i) => {
      if (i === 0) return high - lows[i];
      
      const tr1 = high - lows[i];
      const tr2 = Math.abs(high - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      
      return Math.max(tr1, tr2, tr3);
    });
    
    return ranges.reduce((sum, range) => sum + range, 0) / ranges.length;
  }

  private calculateTrendStrength(closes: number[], highs: number[], lows: number[]): number {
    // Calculate trend strength using ADX-like logic
    const plusDM = highs.slice(1).map((high, i) => 
      Math.max(high - highs[i], 0)
    );
    
    const minusDM = lows.slice(1).map((low, i) => 
      Math.max(lows[i] - low, 0)
    );
    
    const trueRanges = closes.slice(1).map((close, i) => {
      const tr1 = highs[i + 1] - lows[i + 1];
      const tr2 = Math.abs(highs[i + 1] - closes[i]);
      const tr3 = Math.abs(lows[i + 1] - closes[i]);
      return Math.max(tr1, tr2, tr3);
    });
    
    const avgTR = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
    const avgPlusDM = plusDM.reduce((sum, dm) => sum + dm, 0) / plusDM.length;
    const avgMinusDM = minusDM.reduce((sum, dm) => sum + dm, 0) / minusDM.length;
    
    if (avgTR === 0) return 0;
    
    const plusDI = (avgPlusDM / avgTR) * 100;
    const minusDI = (avgMinusDM / avgTR) * 100;
    
    return Math.abs(plusDI - minusDI) / (plusDI + minusDI);
  }

  private prepareTrainingData(rawData: RawDataPoint[]): TrainingData {
    try {
      if (!rawData || rawData.length < this.windowSize) {
        throw new Error(`Insufficient data: ${rawData?.length} samples, need at least ${this.windowSize}`);
      }

      const sequences: number[][][] = [];
      const labels: number[][] = [];

      // Calculate indicators first
      const indicators = this.calculateIndicators(rawData);
      
      // Log data preparation
      console.log('Preparing training data:', {
        totalSamples: rawData.length,
        windowSize: this.windowSize,
        features: this.features.length,
        calculatedIndicators: indicators.length
      });

      // Create sequences
      for (let i = this.windowSize; i < indicators.length - 1; i++) {
        const sequence = indicators.slice(i - this.windowSize, i);
        sequences.push(sequence);

        // Create label based on next candle
        const nextClose = rawData[i + 1].close;
        const currentClose = rawData[i].close;
        const priceChange = (nextClose - currentClose) / currentClose;

        // Create one-hot encoded label
        let label: number[];
        if (Math.abs(priceChange) < 0.001) {
          label = [0, 0, 1]; // NEUTRAL
        } else if (priceChange > 0) {
          label = [1, 0, 0]; // LONG
        } else {
          label = [0, 1, 0]; // SHORT
        }
        labels.push(label);
      }

      console.log('Training data prepared:', {
        sequences: sequences.length,
        labels: labels.length
      });

      return {
        features: tf.tensor3d(sequences),
        labels: tf.tensor2d(labels)
      };

    } catch (error) {
      console.error('Error preparing training data:', error);
      throw error;
    }
  }

  private async prepareFeatures(data: RawDataPoint[]): Promise<tf.Tensor3D> {
    return tf.tidy(() => {
      // Calculate indicators for the data window
      const enrichedData = this.calculateIndicators(data);
      
      // Create sequences for the model
      const sequences: number[][][] = [];
      for (let i = this.windowSize; i < enrichedData.length; i++) {
        const sequence = enrichedData.slice(i - this.windowSize, i);
        sequences.push(sequence);
      }

      // Convert to tensor with proper shape
      return tf.tensor3d(sequences);
    });
  }

  public getLatestStats(): TrainingStats | null {
    return this.currentStats;
  }

  private async updateMetrics(epoch: number, logs: tf.Logs): Promise<TrainingStats> {
    try {
      console.log('Updating metrics for epoch:', epoch + 1);
      
      // Add explicit async/await for predictions and trade generation
      const predictions = await this.getPredictions();
      console.log('Generated predictions:', predictions.length);
      
      const trades = this.generateTrades(predictions);
      console.log('Generated trades:', trades.length);
      
      // Store trades in history for metrics calculation
      this.tradeHistory = [];
      
      // Process trades sequentially to avoid race conditions
      for (const trade of trades) {
        const simulatedTrade = await this.tradeSimulator.simulateTrade(
          trade.type,
          trade.entryPrice,
          trade.stopLoss,
          trade.takeProfit,
          trade.size,
          trade.confidence,
          this.latestData.slice(this.latestData.length - 100)
        );

        if (simulatedTrade && typeof simulatedTrade.pnl === 'number' && !isNaN(simulatedTrade.pnl)) {
          this.tradeHistory.push(simulatedTrade); // Add to trade history
          await this.balanceTracker.updateBalance(
            simulatedTrade.pnl,
            'TRADE',
            `${simulatedTrade.type} ${simulatedTrade.status} at ${simulatedTrade.exitPrice}`
          );
        }
      }

      // Get metrics after updating trade history
      const profitMetrics = await this.calculateProfitMetrics(this.tradeHistory);
      const riskMetrics = await this.calculateRiskMetrics();
      const tradeMetrics = await this.calculateTradeMetrics();
      const balanceMetrics = this.balanceTracker.getMetrics();

      const stats = {
        epoch: epoch + 1,
        accuracy: logs?.acc || 0,
        loss: logs?.loss || 0,
        profitMetrics: {
          ...profitMetrics,
          currentBalance: balanceMetrics.currentBalance,
          peakBalance: balanceMetrics.peakBalance,
          percentageReturn: balanceMetrics.percentageReturn
        },
        riskMetrics: {
          ...riskMetrics,
          maxDrawdown: balanceMetrics.maxDrawdown
        },
        tradeMetrics,
        performance: {
          accuracy: logs?.acc || 0,
          loss: logs?.loss || 0,
          validationAccuracy: logs?.val_acc,
          validationLoss: logs?.val_loss
        }
      };

      console.log('Updated metrics:', {
        trades: this.tradeHistory.length,
        pnl: profitMetrics.totalPnL,
        winRate: profitMetrics.winRate,
        accuracy: stats.performance.accuracy
      });

      // Update model if performance improves
      if (this.isPerformanceBetter(stats)) {
        await this.saveCheckpoint(epoch);
      }

      this.currentStats = stats;
      return stats;
    } catch (error) {
      console.error('Update metrics error:', error);
      throw error;
    }
  }

  private async calculateProfitMetrics(trades: any[]): Promise<ProfitabilityMetrics> {
    const totalPnL = trades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);
    
    const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;
    const avgWin = winningTrades.length > 0 ? 
      winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? 
      Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0)) / losingTrades.length : 0;

    const profitFactor = losingTrades.length > 0 ? 
      (winningTrades.reduce((sum, t) => sum + t.pnl, 0) / 
       Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0))) : 0;

    return {
      totalPnL,
      winRate,
      averageWin: avgWin,
      averageLoss: avgLoss,
      profitFactor,
      expectedValue: (winRate * avgWin) - ((1 - winRate) * avgLoss)
    };
  }

  private async calculateRiskMetrics(): Promise<RiskMetrics> {
    return {
      maxDrawdown: this.calculateMaxDrawdown(),
      sharpeRatio: this.calculateSharpeRatio(),
      sortinoRatio: this.calculateSortinoRatio(),
      calmarRatio: this.calculateCalmarRatio(),
      riskAdjustedReturn: this.calculateRiskAdjustedReturn(),
      valueAtRisk: this.calculateValueAtRisk()
    };
  }

  private async calculateTradeMetrics(): Promise<TradeMetrics> {
    return {
      totalTrades: this.tradeHistory.length,
      winningTrades: this.tradeHistory.filter(t => t.pnl > 0).length,
      losingTrades: this.tradeHistory.filter(t => t.pnl < 0).length,
      averageHoldingTime: this.calculateAverageHoldingTime(),
      averageSlippage: this.calculateAverageSlippage(),
      fillRatio: this.calculateFillRatio()
    };
  }

  private async saveCheckpoint(epoch: number): Promise<void> {
    this.checkpoints.set(epoch, {
      weights: this.model ? await this.model.getWeights() : [],
      stats: this.currentStats,
      timestamp: new Date()
    });
  }

  private isPerformanceBetter(newStats: TrainingStats): boolean {
    if (!this.bestStats) return true;

    // Weight different metrics for overall performance score
    const getScore = (stats: TrainingStats) => {
      return (
        // Model accuracy (30% weight)
        (stats.performance.accuracy * 0.3) +
        // Profitability metrics (40% weight)
        (stats.profitMetrics.winRate * 0.15) +
        (stats.profitMetrics.profitFactor * 0.15) +
        (stats.profitMetrics.expectedValue * 0.1) +
        // Risk metrics (30% weight)
        (1 - stats.riskMetrics.maxDrawdown) * 0.1 +
        (stats.riskMetrics.sharpeRatio * 0.1) +
        (stats.riskMetrics.sortinoRatio * 0.1)
      );
    };

    const currentScore = getScore(newStats);
    const bestScore = getScore(this.bestStats);

    if (currentScore > bestScore) {
      this.bestStats = newStats;
      return true;
    }

    return false;
  }

  private async saveState(): Promise<void> {
    const state = {
      modelPath: this.modelPath,
      metrics: this.metrics,
      currentStats: this.currentStats,
      tradeHistory: this.tradeHistory,
      checkpoints: Array.from(this.checkpoints.entries()),
      bestStats: this.bestStats,
      balanceMetrics: this.balanceTracker.getMetrics(),
      timestamp: new Date().toISOString()
    };

    const db = await getDb();
    await db.run(`
      INSERT OR REPLACE INTO ml_state (
        id, state, timestamp
      ) VALUES (1, ?, datetime('now'))
    `, [JSON.stringify(state)]);

    // Also save model weights
    if (this.model) {
      await this.model.save(`file://${this.modelPath}/latest_weights`);
    }
  }

  private async loadState(): Promise<boolean> {
    try {
      const db = await getDb();
      const savedState = await db.get('SELECT state FROM ml_state WHERE id = 1');
      
      if (!savedState?.state) {
        console.log('No saved state found');
        return false;
      }

      const state = JSON.parse(savedState.state);
      console.log('Found saved state from:', state.timestamp);

      // Basic validation
      if (!state.timeframes?.[ML_CONFIG.TRAINING.TIME_WINDOWS.MAIN_TIMEFRAME]?.length) {
        console.log('Invalid saved state: missing timeframe data');
        return false;
      }

      // Restore state properties
      this.metrics = state.metrics || this.metrics;
      this.currentStats = state.currentStats;
      this.tradeHistory = state.tradeHistory || [];
      this.checkpoints = new Map(state.checkpoints || []);
      this.bestStats = state.bestStats;
      this.timeframes = state.timeframes;
      this.currentWindowIndex = state.currentWindowIndex || ML_CONFIG.TRAINING.TIME_WINDOWS.SLIDING_WINDOW.INITIAL_WAIT;
      this.windowCount = state.windowCount || 0;

      // Restore model weights if available
      if (state.modelWeights) {
        try {
          if (this.model) {
            await this.model.setWeights(state.modelWeights);
            console.log('✅ Restored model weights');
          } else {
            console.warn('⚠️ Cannot restore weights: model not initialized');
          }
        } catch (e) {
          console.warn('⚠️ Failed to restore model weights:', e);
        }
      }

      // Restore balance tracker
      if (state.balanceMetrics) {
        await this.balanceTracker.restoreState(state.balanceMetrics);
        console.log('✅ Restored balance state');
      }

      return true;

    } catch (error) {
      console.error('Failed to load state:', error);
      return false;
    }
  }

  private async initializeTrainingWindow(): Promise<void> {
    try {
      const config = ML_CONFIG.TRAINING.TIME_WINDOWS;
      console.log('\nInitializing training window');
      console.log(`Period: ${config.START_DATE} -> ${config.END_DATE}`);
      await this.moveTrainingWindow();
    } catch (error) {
      console.error('Window initialization error:', error);
      throw error;
    }
  }

  private async fetchDataWithRetry({ 
    symbol, 
    interval, 
    startTime, 
    endTime, 
    maxRetries = 3 
  }: {
    symbol: string;
    interval: string;
    startTime: number;
    endTime: number;
    maxRetries?: number;
  }): Promise<RawDataPoint[]> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const data = await DataManager.getTrainingData({
          symbol,
          interval,
          startTime,
          endTime,
          useStoredData: true
        });

        if (data?.length) {
          return data;
        }

        console.log(`Attempt ${attempt}: No data received, retrying...`);
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) throw error;
      }

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }

    throw new Error(`Failed to fetch data after ${maxRetries} attempts`);
  }

  private async moveTrainingWindow(): Promise<boolean> {
    const config = ML_CONFIG.TRAINING.TIME_WINDOWS;
    
    try {
      // Validate we have data and proper window bounds
      if (!this.timeframes[config.MAIN_TIMEFRAME] || 
          !this.timeframes[config.MAIN_TIMEFRAME].length) {
        console.error('No data available in main timeframe');
        return false;
      }

      // Check if we've reached the end of data
      if (this.currentWindowIndex >= this.timeframes[config.MAIN_TIMEFRAME].length) {
        console.log('Reached end of data');
        return false;
      }

      // Calculate window bounds with validation
      const windowStart = Math.max(0, this.currentWindowIndex - config.SLIDING_WINDOW.HISTORY_SIZE);
      const windowEnd = Math.min(
        this.currentWindowIndex,
        this.timeframes[config.MAIN_TIMEFRAME].length - 1
      );

      // Validate we have enough data for a window
      if (windowEnd - windowStart < this.windowSize) {
        console.error('Insufficient data for window');
        return false;
      }

      // Get timestamps for logging with null checks
      const startCandle = this.timeframes[config.MAIN_TIMEFRAME][windowStart];
      const endCandle = this.timeframes[config.MAIN_TIMEFRAME][windowEnd];

      if (!startCandle || !endCandle) {
        console.error('Invalid candle data at window bounds');
        return false;
      }

      const startTime = new Date(startCandle.timestamp);
      const endTime = new Date(endCandle.timestamp);

      console.log(`\n=== Processing Window ===`);
      console.log(`📅 Period: ${startTime.toISOString()} -> ${endTime.toISOString()}`);
      console.log(`📊 Candles: ${windowEnd - windowStart} (${windowStart} -> ${windowEnd})`);
      console.log(`💰 Window Balance: $${this.balanceTracker.getMetrics().currentBalance.toFixed(2)}`);

      // Prepare main timeframe data
      const mainData = this.timeframes[config.MAIN_TIMEFRAME].slice(windowStart, windowEnd + 1);
      
      // Validate mainData
      if (!mainData.length) {
        console.error('No data in window slice');
        return false;
      }

      // Enrich with sub-timeframe data if enabled
      let enrichedData = mainData;
      if (ML_CONFIG.TRAINING.DATA_ENRICHMENT.USE_SUB_TIMEFRAMES) {
        enrichedData = await this.enrichDataWithSubTimeframes(mainData);
      }

      // Update latest data for predictions
      this.latestData = enrichedData;

      // Move window forward
      this.currentWindowIndex += config.SLIDING_WINDOW.STEP_SIZE;

      return true;

    } catch (error) {
      console.error('Error in moveTrainingWindow:', error);
      return false;
    }
  }

  private async enrichDataWithSubTimeframes(mainData: RawDataPoint[]): Promise<RawDataPoint[]> {
    const config = ML_CONFIG.TRAINING.DATA_ENRICHMENT;
    const enriched = [...mainData];

    for (const tf of ML_CONFIG.TRAINING.TIME_WINDOWS.SUB_TIMEFRAMES) {
      const subData = this.timeframes[tf];
      const candlesPerPeriod = config.CANDLES_PER_PERIOD[tf as keyof typeof config.CANDLES_PER_PERIOD];
      
      // Find corresponding sub-timeframe data for each main timeframe candle
      for (let i = 0; i < mainData.length; i++) {
        const mainCandle = mainData[i];
        const subCandles = this.findMatchingSubCandles(mainCandle, subData, candlesPerPeriod);
        
        // Calculate additional features from sub-timeframe data
        const subFeatures = this.calculateSubTimeframeFeatures(subCandles);
        
        // Add weighted sub-timeframe features to main candle
        enriched[i] = {
          ...enriched[i],
          subFeatures: {
            ...enriched[i].subFeatures,
            [tf]: subFeatures
          }
        };
      }
    }

    return enriched;
  }

  private findMatchingSubCandles(mainCandle: RawDataPoint, subData: RawDataPoint[], candlesPerPeriod: number): RawDataPoint[] {
    const mainStart = mainCandle.timestamp;
    const mainEnd = mainStart + (60 * 60 * 1000); // 1 hour in milliseconds

    return subData.filter(candle => 
      candle.timestamp >= mainStart && 
      candle.timestamp < mainEnd
    ).slice(0, candlesPerPeriod);
  }

  private calculateSubTimeframeFeatures(subCandles: RawDataPoint[]): any {
    if (!subCandles.length) return null;

    // Calculate statistics from sub-timeframe candles
    const closes = subCandles.map(c => c.close);
    const highs = subCandles.map(c => c.high);
    const lows = subCandles.map(c => c.low);
    const volumes = subCandles.map(c => c.volume);

    return {
      priceVolatility: this.calculateVolatility(closes),
      volumeProfile: this.calculateVolumeProfile(volumes),
      priceMovement: this.calculatePriceMovement(closes, highs, lows),
      momentum: this.calculateMomentumIndicators(closes)
    };
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    const returns = prices.slice(1).map((price, i) => 
      (price - prices[i]) / prices[i]
    );
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    return Math.sqrt(
      returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length
    );
  }

  private calculateVolumeProfile(volumes: number[]): { 
    averageVolume: number;
    volumeChange: number;
    volumeTrend: number;
  } {
    const avg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const firstHalf = volumes.slice(0, Math.floor(volumes.length / 2));
    const secondHalf = volumes.slice(Math.floor(volumes.length / 2));
    const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    return {
      averageVolume: avg,
      volumeChange: (volumes[volumes.length - 1] - volumes[0]) / volumes[0],
      volumeTrend: (secondHalfAvg - firstHalfAvg) / firstHalfAvg
    };
  }

  private calculatePriceMovement(closes: number[], highs: number[], lows: number[]): {
    trend: number;
    strength: number;
    volatility: number;
  } {
    const priceChange = (closes[closes.length - 1] - closes[0]) / closes[0];
    const highLowRange = Math.max(...highs) - Math.min(...lows);
    const avgPrice = closes.reduce((a, b) => a + b, 0) / closes.length;
    
    return {
      trend: priceChange,
      strength: Math.abs(priceChange) / (highLowRange / avgPrice),
      volatility: highLowRange / avgPrice
    };
  }

  private calculateMomentumIndicators(prices: number[]): {
    roc: number;
    acceleration: number;
  } {
    const roc = (prices[prices.length - 1] - prices[0]) / prices[0];
    const midPoint = Math.floor(prices.length / 2);
    const firstHalfRoc = (prices[midPoint] - prices[0]) / prices[0];
    const secondHalfRoc = (prices[prices.length - 1] - prices[midPoint]) / prices[midPoint];
    
    return {
      roc,
      acceleration: secondHalfRoc - firstHalfRoc
    };
  }

  async train(symbol: string, interval: string): Promise<void> {
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('Invalid symbol provided');
    }
    
    this.symbol = symbol.toUpperCase().trim();
    await tf.ready();
    
    try {
      // Load or create model first
      this.model = await this.loadOrCreateModel();
      if (!this.model) {
        throw new Error('Failed to initialize model');
      }
      console.log('Model initialized successfully');
      
      // Initialize sliding window system
      await this.initializeTrainingWindow();
      
      // Training loop
      let windowCount = 0;
      while (await this.moveTrainingWindow()) {
        console.log(`Processing window ${++windowCount}`);
        
        // Prepare current window data
        const trainingData = this.prepareTrainingData(this.latestData);
        const { features, labels } = tf.tidy(() => ({
          features: trainingData.features,
          labels: trainingData.labels
        }));

        console.log('Training data prepared:', {
          features: features.shape,
          labels: labels.shape
        });

        // Run simulation before training
        await this.simulateTrading();

        // Train on current window
        try {
          const history = await this.model.fit(features, labels, {
            epochs: ML_CONFIG.TRAINING.EPOCHS.COUNT,
            batchSize: ML_CONFIG.TRAINING.BATCH_SIZE,
            validationSplit: 0.2,
            callbacks: {
              onEpochEnd: async (epoch, logs) => {
                const stats = await this.updateMetrics(epoch, logs ?? { acc: 0, loss: 0 });
                await this.logProgress(stats);
              }
            }
          });

          console.log('Window training completed:', history.history);
        } catch (trainError) {
          console.error('Training error in window:', trainError);
          // Continue with next window instead of stopping completely
          continue;
        }

        // Save progress periodically
        if (windowCount % 10 === 0) {
          await this.saveState();
        }

        // Cleanup tensors
        tf.dispose([features, labels]);
      }

      await this.notifyFinalResults();
      
    } catch (error) {
      console.error("Training error:", error);
      throw error;
    }
  }

  private async notifyProgress(stats: TrainingStats): Promise<void> {
    const message = `📊 Training Progress - Epoch ${stats.epoch}/${ML_CONFIG.TRAINING.EPOCHS}

🎯 Performance:
Accuracy: ${(stats.performance.accuracy * 100).toFixed(2)}%
Loss: ${stats.performance.loss.toFixed(4)}

💰 Profitability:
Total PnL: $${stats.profitMetrics.totalPnL.toFixed(2)}
Win Rate: ${(stats.profitMetrics.winRate * 100).toFixed(2)}%
Profit Factor: ${stats.profitMetrics.profitFactor.toFixed(2)}

⚠️ Risk Metrics:
Max Drawdown: ${(stats.riskMetrics.maxDrawdown * 100).toFixed(2)}%
Sharpe Ratio: ${stats.riskMetrics.sharpeRatio.toFixed(2)}
Value at Risk: $${stats.riskMetrics.valueAtRisk.toFixed(2)}

📈 Trading Activity:
Total Trades: ${stats.tradeMetrics.totalTrades}
Avg Slippage: ${(stats.tradeMetrics.averageSlippage * 100).toFixed(2)}%
Fill Ratio: ${(stats.tradeMetrics.fillRatio * 100).toFixed(2)}%`;

    await notifyBot(message);
  }

  private async notifyFinalResults(): Promise<void> {
    try {
      if (!this.currentStats) {
        console.warn('No stats available for final results');
        await notifyBot(`⚠️ Training Completed
Note: No performance statistics available.
Model saved to: ${this.modelPath}`);
        return;
      }

      const stats = this.currentStats;
      
      // Helper function to format numbers safely
      const format = (value: number | undefined | null, decimals = 2): string => {
        if (value === undefined || value === null || isNaN(value)) return 'N/A';
        return value.toFixed(decimals);
      };

      const metrics = {
        winRate: stats.profitMetrics?.winRate && format(stats.profitMetrics.winRate * 100),
        totalPnL: format(stats.profitMetrics?.totalPnL),
        profitFactor: format(stats.profitMetrics?.profitFactor),
        expectedValue: format(stats.profitMetrics?.expectedValue),
        maxDrawdown: format((stats.riskMetrics?.maxDrawdown || 0) * 100),
        sharpeRatio: format(stats.riskMetrics?.sharpeRatio),
        riskAdjustedReturn: format((stats.riskMetrics?.riskAdjustedReturn || 0) * 100),
        totalTrades: stats.tradeMetrics?.totalTrades || 'N/A',
        winningTrades: stats.tradeMetrics?.winningTrades || 'N/A',
        losingTrades: stats.tradeMetrics?.losingTrades || 'N/A',
        avgHoldingTime: format(stats.tradeMetrics?.averageHoldingTime),
        avgSlippage: format((stats.tradeMetrics?.averageSlippage || 0) * 100)
      };

      const message = `✅ Training Completed

🏆 Final Results:
Win Rate: ${metrics.winRate}%
Total PnL: $${metrics.totalPnL}
Profit Factor: ${metrics.profitFactor}
Expected Value: $${metrics.expectedValue}

📊 Risk Analysis:
Max Drawdown: ${metrics.maxDrawdown}%
Sharpe Ratio: ${metrics.sharpeRatio}
Risk-Adjusted Return: ${metrics.riskAdjustedReturn}%

📈 Trading Summary:
Total Trades: ${metrics.totalTrades}
Winning Trades: ${metrics.winningTrades}
Losing Trades: ${metrics.losingTrades}
Avg Holding Time: ${metrics.avgHoldingTime}h
Avg Slippage: ${metrics.avgSlippage}%

Model saved to: ${this.modelPath}`;

      await notifyBot(message);

    } catch (error) {
      console.error('Error sending final results:', error);
      await notifyBot('⚠️ Error generating final results notification');
    }
  }

  private calculateWinRate(): number {
    if (this.tradeHistory.length === 0) return 0;
    const winningTrades = this.tradeHistory.filter(trade => trade.pnl > 0).length;
    return winningTrades / this.tradeHistory.length;
  }

  private calculateAverageWin(): number {
    const winningTrades = this.tradeHistory.filter(trade => trade.pnl > 0);
    if (winningTrades.length === 0) return 0;
    const totalWins = winningTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    return totalWins / winningTrades.length;
  }

  private calculateAverageLoss(): number {
    const losingTrades = this.tradeHistory.filter(trade => trade.pnl < 0);
    if (losingTrades.length === 0) return 0;
    const totalLosses = losingTrades.reduce((sum, trade) => sum + Math.abs(trade.pnl), 0);
    return totalLosses / losingTrades.length;
  }

  private calculateProfitFactor(): number {
    const grossProfit = this.tradeHistory
      .filter(trade => trade.pnl > 0)
      .reduce((sum, trade) => sum + trade.pnl, 0);
    
    const grossLoss = Math.abs(this.tradeHistory
      .filter(trade => trade.pnl < 0)
      .reduce((sum, trade) => sum + trade.pnl, 0));

    return grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
  }

  private calculateExpectedValue(): number {
    const winRate = this.calculateWinRate();
    const avgWin = this.calculateAverageWin();
    const avgLoss = this.calculateAverageLoss();
    return (winRate * avgWin) - ((1 - winRate) * avgLoss);
  }

  private calculateMaxDrawdown(): number {
    let peak = -Infinity;
    let maxDrawdown = 0;
    let balance = ML_CONFIG.TRADING.POSITION_SIZING.INITIAL_MARGIN;

    for (const trade of this.tradeHistory) {
      balance += trade.pnl;
      peak = Math.max(peak, balance);
      const drawdown = (peak - balance) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    return maxDrawdown;
  }

  private calculateSharpeRatio(): number {
    const returns = this.tradeHistory.map(trade => trade.pnl);
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length
    );
    
    return stdDev === 0 ? 0 : (meanReturn / stdDev) * Math.sqrt(252); // Annualized
  }

  private calculateSortinoRatio(): number {
    const returns = this.tradeHistory.map(trade => trade.pnl);
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const negativeReturns = returns.filter(r => r < 0);
    const downstdDev = Math.sqrt(
      negativeReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / negativeReturns.length
    );
    
    return downstdDev === 0 ? 0 : (meanReturn / downstdDev) * Math.sqrt(252); // Annualized
  }

  private calculateCalmarRatio(): number {
    const annualizedReturn = this.calculateAnnualizedReturn();
    const maxDrawdown = this.calculateMaxDrawdown();
    return maxDrawdown === 0 ? 0 : annualizedReturn / maxDrawdown;
  }

  private calculateRiskAdjustedReturn(): number {
    const totalReturn = this.tradeHistory.reduce((sum, trade) => sum + trade.pnl, 0);
    const maxDrawdown = this.calculateMaxDrawdown();
    return maxDrawdown === 0 ? 0 : totalReturn / maxDrawdown;
  }

  private calculateValueAtRisk(): number {
    const returns = this.tradeHistory.map(trade => trade.pnl);
    returns.sort((a, b) => a - b);
    const index = Math.floor(returns.length * 0.05); // 95% confidence level
    return returns[index] || 0;
  }

  private calculateAverageHoldingTime(): number {
    if (this.tradeHistory.length === 0) return 0;
    const holdingTimes = this.tradeHistory.map(trade => 
      (trade.closeTime - trade.openTime) / (1000 * 60 * 60) // Convert to hours
    );
    return holdingTimes.reduce((sum, time) => sum + time, 0) / this.tradeHistory.length;
  }

  private calculateAverageSlippage(): number {
    if (this.tradeHistory.length === 0) return 0;
    const slippages = this.tradeHistory.map(trade => 
      Math.abs(trade.executedPrice - trade.intendedPrice) / trade.intendedPrice
    );
    return slippages.reduce((sum, slip) => sum + slip, 0) / this.tradeHistory.length;
  }

  private calculateFillRatio(): number {
    if (this.tradeHistory.length === 0) return 0;
    const filledOrders = this.tradeHistory.filter(trade => trade.status === 'filled').length;
    return filledOrders / this.tradeHistory.length;
  }

  private calculateAnnualizedReturn(): number {
    if (this.tradeHistory.length === 0) return 0;
    
    const totalReturn = this.tradeHistory.reduce((sum, trade) => sum + trade.pnl, 0);
    const firstTradeDate = new Date(this.tradeHistory[0].openTime);
    const lastTradeDate = new Date(this.tradeHistory[this.tradeHistory.length - 1].closeTime);
    const yearFraction = (lastTradeDate.getTime() - firstTradeDate.getTime()) / (365 * 24 * 60 * 60 * 1000);
    
    return yearFraction === 0 ? 0 : Math.pow(1 + totalReturn, 1 / yearFraction) - 1;
  }

  private logProgress(stats: TrainingStats): void {
    // Simplified progress logging
    console.log('\nProgress:', {
      accuracy: (stats.performance.accuracy * 100).toFixed(1) + '%',
      pnl: `$${stats.profitMetrics.totalPnL.toFixed(2)}`,
      trades: stats.tradeMetrics.totalTrades,
      winRate: (stats.profitMetrics.winRate * 100).toFixed(1) + '%'
    });
  }

  private calculatePnLPenalty(yTrue: tf.Tensor, yPred: tf.Tensor): tf.Tensor {
    // Calculate simulated PnL based on predictions
    return tf.tidy(() => {
      const trades = this.simulateTradesFromPredictions(yPred);
      const pnlScore = this.calculatePnLScore(trades);
      return tf.scalar(1 - pnlScore);
    });
  }

  private calculateRiskPenalty(yPred: tf.Tensor): tf.Tensor {
    return tf.tidy(() => {
      const consecutiveLosses = this.calculateConsecutiveLosses(yPred);
      const drawdown = this.calculateDrawdown(yPred);
      return tf.add(
        tf.mul(consecutiveLosses, 0.5),
        tf.mul(drawdown, 0.5)
      );
    });
  }

  private async getPredictions(): Promise<ModelOutput[]> {
    const features = await this.prepareFeatures(this.latestData);
    if (!this.model) {
      throw new Error('Model not initialized');
    }
    const predictions = this.model.predict(features) as tf.Tensor;
    
    return tf.tidy(() => {
      const probs = predictions.arraySync() as number[][];
      
      // Log prediction distributions
      console.log('Raw predictions distribution:');
      probs.forEach((prob, i) => {
        console.log(`Prediction ${i}:`, {
          long: (prob[0] * 100).toFixed(2) + '%',
          short: (prob[1] * 100).toFixed(2) + '%',
          neutral: (prob[2] * 100).toFixed(2) + '%',
          confidence: (Math.max(...prob) * 100).toFixed(2) + '%'
        });
      });

      return probs.map(prob => {
        const signal = this.interpretPrediction(prob);
        const confidence = Math.max(...prob);
        const price = this.latestData[this.latestData.length - 1].close;
        
        return {
          signal,
          confidence,
          suggestedEntry: price,
          stopLoss: this.calculateStopLoss(signal, price, confidence),
          takeProfit: this.calculateTakeProfit(signal, price, confidence)
        };
      });
    });
  }

  private generateTrades(predictions: ModelOutput[]): any[] {
    const filteredPredictions = predictions.filter(p => {
      // Add validation for price values
      if (!p.suggestedEntry || !p.stopLoss || !p.takeProfit || 
          isNaN(p.suggestedEntry) || isNaN(p.stopLoss) || isNaN(p.takeProfit)) {
        console.error('Invalid prediction values:', p);
        return false;
      }

      // Fix signal strength calculation
      const probs = [p.confidence];
      const maxProb = Math.max(...probs);
      const otherProbs = probs.filter(prob => prob !== maxProb);
      const secondMaxProb = otherProbs.length > 0 ? Math.max(...otherProbs) : 0;
      
      // Calculate signal strength as relative difference from random (0.33)
      const signalStrength = (maxProb - 0.33) / 0.33;

      const meetsConfidence = p.confidence > ML_CONFIG.TRADING.RISK_CONTROLS.MIN_CONFIDENCE;
      const meetsSignalStrength = signalStrength > ML_CONFIG.TRADING.RISK_CONTROLS.MIN_SIGNAL_STRENGTH;
      const isDirectional = p.signal !== 'NEUTRAL';

      console.log('Trade prediction:', {
        signal: p.signal,
        confidence: (p.confidence * 100).toFixed(2) + '%',
        signalStrength: (signalStrength * 100).toFixed(2) + '%',
        relativeDiff: ((maxProb - secondMaxProb) * 100).toFixed(2) + '%',
        meetsConfidence,
        meetsSignalStrength,
        isDirectional
      });

      // Only take directional trades with sufficient confidence and signal strength
      return meetsConfidence && meetsSignalStrength && isDirectional;
    });

    return filteredPredictions.map(p => {
      const size = this.calculatePositionSize(
        p.suggestedEntry,
        p.stopLoss,
        ML_CONFIG.TRADING.POSITION_SIZING.RISK_PER_TRADE
      );

      // Log trade parameters
      console.log('Trade parameters:', {
        type: p.signal,
        entry: p.suggestedEntry,
        stop: p.stopLoss,
        target: p.takeProfit,
        size,
        confidence: p.confidence
      });

      return {
        type: p.signal,
        entryPrice: p.suggestedEntry,
        stopLoss: p.stopLoss,
        takeProfit: p.takeProfit,
        size,
        timestamp: new Date(),
        confidence: p.confidence,
        expectedValue: this.calculateTradeExpectedValue(
          p.suggestedEntry,
          p.stopLoss,
          p.takeProfit,
          p.confidence
        )
      };
    });
  }

  private calculateTradeExpectedValue(
    entry: number,
    stop: number,
    target: number,
    confidence: number
  ): number {
    const riskAmount = Math.abs(entry - stop);
    const rewardAmount = Math.abs(target - entry);
    const winProbability = confidence;
    return (rewardAmount * winProbability) - (riskAmount * (1 - winProbability));
  }

  private interpretPrediction(probabilities: number[]): 'LONG' | 'SHORT' | 'NEUTRAL' {
    const maxIndex = probabilities.indexOf(Math.max(...probabilities));
    switch (maxIndex) {
      case 0: return 'LONG';
      case 1: return 'SHORT';
      default: return 'NEUTRAL';
    }
  }

  private calculateStopLoss(signal: 'LONG' | 'SHORT' | 'NEUTRAL', price: number, confidence: number): number {
    if (!price || typeof price !== 'number') {
        console.error('Invalid price:', price);
        return 0;
    }

    // Use fixed stop loss distances based on $500 account
    const stopAmount = ML_CONFIG.TRADING.EXITS.STOP_LOSS.NORMAL * price; // 2% of price
    return signal === 'LONG' ? 
        price - stopAmount : 
        price + stopAmount;
  }

  private calculateTakeProfit(signal: 'LONG' | 'SHORT' | 'NEUTRAL', price: number, confidence: number): number {
    if (!price || typeof price !== 'number') {
        console.error('Invalid price:', price);
        return 0;
    }

    // Use fixed take profit distances
    const tpAmount = ML_CONFIG.TRADING.EXITS.PROFIT_TARGETS.MODERATE * price; // 3% of price
    return signal === 'LONG' ? 
        price + tpAmount : 
        price - tpAmount;
  }

  private calculatePositionSize(entry: number, stop: number, riskPerTrade: number): number {
    try {
      // Validate inputs
      if (!entry || !stop || !riskPerTrade || 
          isNaN(entry) || isNaN(stop) || isNaN(riskPerTrade)) {
        console.error('Invalid position size parameters:', { entry, stop, riskPerTrade });
        return ML_CONFIG.TRADING.POSITION_SIZING.MIN_POSITION_SIZE;
      }

      const stopDistance = Math.abs(entry - stop);
      if (stopDistance === 0) {
        console.error('Stop distance cannot be zero');
        return ML_CONFIG.TRADING.POSITION_SIZING.MIN_POSITION_SIZE;
      }

      // Calculate risk amount in USD
      const riskAmount = ML_CONFIG.TRADING.POSITION_SIZING.INITIAL_MARGIN * riskPerTrade;
      
      // Calculate position size
      let positionSize = riskAmount / stopDistance;

      // Log calculation for debugging
      console.log('Position size calculation:', {
        entry,
        stop,
        stopDistance,
        riskAmount,
        calculatedSize: positionSize
      });

      // Apply size limits
      positionSize = Math.min(
        Math.max(positionSize, ML_CONFIG.TRADING.POSITION_SIZING.MIN_POSITION_SIZE),
        ML_CONFIG.TRADING.POSITION_SIZING.MAX_POSITION_SIZE
      );

      return positionSize;

    } catch (error) {
      console.error('Position size calculation error:', error);
      return ML_CONFIG.TRADING.POSITION_SIZING.MIN_POSITION_SIZE;
    }
  }

  private simulateTradesFromPredictions(yPred: tf.Tensor): any[] {
    return tf.tidy(() => {
      const predictions = yPred.arraySync() as number[][];
      const trades = [];
      
      for (let i = 0; i < predictions.length; i++) {
        const signal = this.interpretPrediction(predictions[i]);
        const confidence = Math.max(...predictions[i]);
        const currentPrice = this.latestData[i + this.windowSize].close;
        
        if (signal !== 'NEUTRAL' && confidence > ML_CONFIG.TRADING.RISK_CONTROLS.MIN_CONFIDENCE) {
          trades.push({
            type: signal,
            entryPrice: currentPrice,
            stopLoss: this.calculateStopLoss(signal, currentPrice, confidence),
            takeProfit: this.calculateTakeProfit(signal, currentPrice, confidence),
            confidence,
            timestamp: this.latestData[i + this.windowSize].timestamp
          });
        }
      }
      
      return trades;
    });
  }

  private calculatePnLScore(trades: any[]): number {
    if (!trades.length) return 0;
    
    let totalPnL = 0;
    let totalRisk = 0;
    
    trades.forEach(trade => {
      const entryPrice = trade.entryPrice;
      const stopDistance = Math.abs(entryPrice - trade.stopLoss);
      const profitDistance = Math.abs(trade.takeProfit - entryPrice);
      
      // Normalize PnL by risk
      const riskAmount = stopDistance * ML_CONFIG.TRADING.POSITION_SIZING.RISK_PER_TRADE;
      const potentialProfit = profitDistance * ML_CONFIG.TRADING.POSITION_SIZING.RISK_PER_TRADE;
      
      totalRisk += riskAmount;
      
      // Simulate outcome based on confidence
      const outcome = Math.random() < trade.confidence ? potentialProfit : -riskAmount;
      totalPnL += outcome;
    });
    
    // Return risk-adjusted score between 0 and 1
    return totalRisk > 0 ? Math.max(0, Math.min(1, (totalPnL / totalRisk + 1) / 2)) : 0;
  }

  private async simulateTrading(): Promise<void> {
    try {
      const predictions = await this.getPredictions();
      console.log('Generated predictions:', predictions.length);
      
      // Clear existing trade history for this window
      this.tradeHistory = [];
      
      // Generate and simulate trades
      const trades = this.generateTrades(predictions);
      console.log('Generated trades:', trades.length);

      for (const trade of trades) {
        const simulatedTrade = await this.tradeSimulator.simulateTrade(
          trade.type,
          trade.entryPrice,
          trade.stopLoss,
          trade.takeProfit,
          trade.size,
          trade.confidence,
          this.latestData.slice(-100)
        );

        if (simulatedTrade && typeof simulatedTrade.pnl === 'number' && !isNaN(simulatedTrade.pnl)) {
          this.tradeHistory.push(simulatedTrade);
          
          // Update balance and log trade
          await this.balanceTracker.updateBalance(
            simulatedTrade.pnl,
            'TRADE',
            `${simulatedTrade.type} ${simulatedTrade.status} PnL: $${simulatedTrade.pnl.toFixed(2)}`
          );
        }
      }

      // Log simulation results
      console.log('Simulation completed:', {
        trades: this.tradeHistory.length,
        totalPnL: this.tradeHistory.reduce((sum, t) => sum + (t.pnl || 0), 0),
        winRate: this.calculateWinRate()
      });

    } catch (error) {
      console.error('Trade simulation error:', error);
    }
  }

  // Add missing method to track consecutive losses
  private calculateConsecutiveLosses(yPred: tf.Tensor): tf.Tensor {
    return tf.tidy(() => {
      const predictions = yPred.arraySync() as number[][];
      let maxConsecutiveLosses = 0;
      let currentLosses = 0;
      
      predictions.forEach(pred => {
        const outcome = Math.random() < Math.max(...pred);
        if (!outcome) {
          currentLosses++;
          maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
        } else {
          currentLosses = 0;
        }
      });
      
      return tf.scalar(maxConsecutiveLosses / ML_CONFIG.TRADING.RISK_CONTROLS.MAX_CONSECUTIVE_LOSSES);
    });
  }

  // Add missing method to calculate drawdown
  private calculateDrawdown(yPred: tf.Tensor): tf.Tensor {
    return tf.tidy(() => {
      const predictions = yPred.arraySync() as number[][];
      let peak = ML_CONFIG.TRADING.POSITION_SIZING.INITIAL_MARGIN;
      let currentBalance = peak;
      let maxDrawdown = 0;
      
      predictions.forEach(pred => {
        const outcome = Math.random() < Math.max(...pred);
        const change = outcome ? 10 : -10; // Simplified P&L calculation
        currentBalance += change;
        peak = Math.max(peak, currentBalance);
        const drawdown = (peak - currentBalance) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      });
      
      return tf.scalar(maxDrawdown);
    });
  }
}
