import { Router } from 'express';
import { MLModelService } from '../services/MLModelService.js';
import { notifyBot } from '../../lib/services/telegram.js';

const router = Router();
let mlModelService: MLModelService | null = null;

router.post('/start', async (req, res) => {
  const { symbol, interval } = req.body;

  try {
    // Create new instance for each training session
    mlModelService = new MLModelService();
    
    // Send initial notification
    await notifyBot(`🚀 Starting new training session
Symbol: ${symbol}
Interval: ${interval}
Time: ${new Date().toISOString()}`);

    // Start training in background
    mlModelService.train(symbol, interval)
      .catch(error => {
        console.error('Training error:', error);
        notifyBot(`❌ Training failed: ${error.message}`);
      });

    res.status(200).json({ 
      message: 'Training started successfully',
      status: 'started' 
    });
  } catch (error) {
    console.error('Error starting training:', error);
    res.status(500).json({ error: 'Failed to start training' });
  }
});

router.get('/status', (req, res) => {
  if (!mlModelService) {
    res.json({ status: 'idle' });
    return;
  }

  const stats = mlModelService.getLatestStats();
  if (!stats) {
    res.json({ status: 'initializing' });
    return;
  }

  try {
    res.json({
      status: 'training',
      stats: {
        epoch: stats.epoch,
        accuracy: stats.performance?.accuracy ? 
          (stats.performance.accuracy * 100).toFixed(2) + '%' : '0%',
        loss: stats.performance?.loss ? 
          stats.performance.loss.toFixed(4) : '0',
        validationAccuracy: stats.performance?.validationAccuracy ? 
          (stats.performance.validationAccuracy * 100).toFixed(2) + '%' : undefined,
        validationLoss: stats.performance?.validationLoss?.toFixed(4),
        profitMetrics: {
          totalPnL: stats.profitMetrics?.totalPnL?.toFixed(2) || '0',
          winRate: stats.profitMetrics?.winRate ? 
            (stats.profitMetrics.winRate * 100).toFixed(2) + '%' : '0%',
          profitFactor: stats.profitMetrics?.profitFactor?.toFixed(2) || '0'
        },
        riskMetrics: {
          maxDrawdown: stats.riskMetrics?.maxDrawdown ? 
            (stats.riskMetrics.maxDrawdown * 100).toFixed(2) + '%' : '0%',
          sharpeRatio: stats.riskMetrics?.sharpeRatio?.toFixed(2) || '0'
        },
        tradeMetrics: {
          totalTrades: stats.tradeMetrics?.totalTrades || 0,
          winningTrades: stats.tradeMetrics?.winningTrades || 0,
          losingTrades: stats.tradeMetrics?.losingTrades || 0
        }
      }
    });
  } catch (error) {
    console.error('Error formatting training stats:', error);
    res.json({
      status: 'error',
      error: 'Failed to format training stats'
    });
  }
});

export default router;
