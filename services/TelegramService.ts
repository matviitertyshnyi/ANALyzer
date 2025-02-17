import axios from 'axios';

const TELEGRAM_API_URL = `https://api.telegram.org/bot${process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN}`;

export async function notifyBot(message: string): Promise<void> {
  try {
    await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
      chat_id: process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID,
      text: message
    });
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
  }
}
