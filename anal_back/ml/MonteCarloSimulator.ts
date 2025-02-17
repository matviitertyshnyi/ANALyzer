import * as tf from '@tensorflow/tfjs';

export class MonteCarloSimulator {
  static async simulateTrading(
    model: tf.LayersModel,
    historicalData: number[][],
    config: {
      initialCapital: number;
      simulations: number;
      horizon: number;
      riskPerTrade: number;
      maxLeverage: number;
    }
  ) {
    const results = [];
    
    for (let i = 0; i < config.simulations; i++) {
      let capital = config.initialCapital;
      let position = null;
      
      // Run one simulation path
      for (let t = 0; t < config.horizon; t++) {
        // Get random market conditions from historical data
        const randomIndex = Math.floor(Math.random() * (historicalData.length - 60));
        const windowData = historicalData.slice(randomIndex, randomIndex + 60);
        
        // Get model prediction
        const tensor = tf.tensor3d([windowData]);
        const prediction = await model.predict(tensor) as tf.Tensor;
        const confidence = (await prediction.data())[0];
        
        // Cleanup tensors
        tensor.dispose();
        prediction.dispose();
        
        // Trading logic
        if (!position && confidence > 0.7) { // Open long
          const amount = capital * (config.riskPerTrade / 100);
          position = {
            type: 'LONG',
            entry: windowData[windowData.length - 1][0],
            size: (amount * config.maxLeverage) / windowData[windowData.length - 1][0]
          };
          capital -= amount;
        }
        else if (position && (confidence < 0.3 || t === config.horizon - 1)) { // Close position
          const exitPrice = windowData[windowData.length - 1][0];
          const pnl = position.type === 'LONG' 
            ? (exitPrice - position.entry) * position.size
            : (position.entry - exitPrice) * position.size;
          
          capital += pnl;
          position = null;
        }
      }
      
      results.push({
        finalCapital: capital,
        returns: (capital - config.initialCapital) / config.initialCapital * 100,
        maxDrawdown: this.calculateMaxDrawdown(results)
      });
    }
    
    // Calculate metrics
    const averageReturn = results.reduce((sum, r) => sum + r.returns, 0) / config.simulations;
    const successRate = results.filter(r => r.returns > 0).length / config.simulations;
    const worstCase = Math.min(...results.map(r => r.returns));
    const bestCase = Math.max(...results.map(r => r.returns));
    
    return {
      averageReturn,
      successRate,
      worstCase,
      bestCase,
      results
    };
  }

  private static calculateMaxDrawdown(equityCurve: number[]): number {
    let peak = -Infinity;
    let maxDrawdown = 0;
    
    for (const equity of equityCurve) {
      if (equity > peak) peak = equity;
      const drawdown = (peak - equity) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    return maxDrawdown;
  }
}
