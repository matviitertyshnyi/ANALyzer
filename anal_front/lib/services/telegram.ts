const TELEGRAM_BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

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
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
  }
};

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
