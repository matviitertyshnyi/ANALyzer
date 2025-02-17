import { Position } from '../../types';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('Telegram environment variables are not set!');
}

const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

const TIMEOUT = 5000; // 5 seconds
const MAX_RETRIES = 3;

export async function notifyBot(message: string): Promise<void> {
  const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('Telegram configuration missing');
    return;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      await axios.post(url, {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      }, {
        timeout: TIMEOUT,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return;
    } catch (error) {
      if (i === MAX_RETRIES - 1) {
        console.error('Failed to send Telegram message after retries:', error);
      } else {
        console.warn(`Telegram notification attempt ${i + 1} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      }
    }
  }
}

export const sendTelegramMessage = async (message: string) => {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Telegram config missing');
    return;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );

    const data = await response.json();
    if (!data.ok) throw new Error(data.description);
    
    return data;
  } catch (error: unknown) {
    console.error('Failed to send Telegram message:', error);
  }
}

export const notifyNewPosition = (position: Position) => {
  const message = `
🆕 <b>New Position Opened</b>
Coin: ${position.coin}
Type: ${position.type}
Entry: ${position.entryPrice.toFixed(2)} USDC
Size: ${position.size.toFixed(8)}
Leverage: ${position.leverage}x
Initial Margin: ${position.initialMargin.toFixed(2)} USDC
`;
  return sendTelegramMessage(message);
};

export const notifyPositionClosed = (position: Position, profit: number) => {
  const message = `
💰 <b>Position Closed</b>
Coin: ${position.coin}
Type: ${position.type}
Entry: ${position.entryPrice.toFixed(2)} USDC
Exit: ${position.exitPrice?.toFixed(2)} USDC
Profit: ${profit.toFixed(2)} USDC (${((profit/position.initialMargin)*100).toFixed(2)}%)
`;
  return sendTelegramMessage(message);
};
