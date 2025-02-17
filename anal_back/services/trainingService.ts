import { MLModelService } from './MLModelService.js';
import { TRADING_CONFIG } from '../config/tradingConfig.js';

export async function startTraining(): Promise<void> {
  console.log("Starting ML model training...");
  
  const mlService = new MLModelService();
  
  try {
    const symbol = 'BTCUSDT'; // Hardcode for testing
    console.log(`Training service: Starting training for ${symbol}`);
    
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('Invalid symbol');
    }
    
    await mlService.train(symbol, '1h');
    console.log("Training completed successfully");
  } catch (error) {
    console.error("Training service error:", error);
    throw error;
  }
}
