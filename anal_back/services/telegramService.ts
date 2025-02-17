import axios from 'axios';
import { TRADING_CONFIG } from '../config/tradingConfig';

export class TelegramService {
  private static readonly BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
  private static readonly CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

  static async sendTrainingStart(params: any) {
    const message = `🤖 Training Started
Symbol: ${params.symbol}
Timeframe: ${params.interval}
Initial Balance: $${TRADING_CONFIG.CAPITAL.INITIAL_BALANCE}
Risk per Trade: ${TRADING_CONFIG.RISK_MANAGEMENT.MAX_RISK_PER_TRADE * 100}%
Max Leverage: ${TRADING_CONFIG.RISK_MANAGEMENT.LEVERAGE.MAX}x
Stop Loss: ${TRADING_CONFIG.RISK_MANAGEMENT.STOP_LOSS * 100}%
Take Profit: ${TRADING_CONFIG.RISK_MANAGEMENT.TAKE_PROFIT * 100}%
Training Data: ${params.lookback} days`;

    await this.sendMessage(message);
  }

  static async sendTrainingComplete(results: any) {
    const message = `✅ Training Complete
Duration: ${results.duration} minutes
Accuracy: ${(results.metrics.accuracy * 100).toFixed(1)}%
Win Rate: ${(results.metrics.winRate * 100).toFixed(1)}%
Sharpe Ratio: ${results.metrics.sharpeRatio.toFixed(2)}
Expected Monthly Return: ${(results.metrics.expectedReturn * 100).toFixed(1)}%
Max Drawdown: ${(results.metrics.maxDrawdown * 100).toFixed(1)}%`;

    await this.sendMessage(message);
  }

  static async sendTradeAlert(trade: any) {
    const message = `📊 Trade Signal
Type: ${trade.type}
Entry: $${trade.entry.toFixed(2)}
Size: $${trade.size}
Leverage: ${trade.leverage}x
Stop Loss: $${trade.stopLoss.toFixed(2)}
Take Profit: $${trade.takeProfit.toFixed(2)}
Confidence: ${(trade.confidence * 100).toFixed(1)}%`;

    await this.sendMessage(message);
  }

  private static async sendMessage(text: string) {
    try {
      const url = `https://api.telegram.org/bot${this.BOT_TOKEN}/sendMessage`;
      await axios.post(url, {
        chat_id: this.CHAT_ID,
        text,
        parse_mode: 'HTML'
      });
    } catch (error) {
      console.error('Telegram notification failed:', error);
    }
  }
}
