# ANALyzer Trading Bot

Cryptocurrency trading bot with web interface and Telegram notifications.

## Features
- Real-time trading with MACD strategy
- Telegram notifications for trades
- Web dashboard
- Position management
- Automatic trade execution

## Setup
1. Install dependencies:
```bash
cd anal_front
npm install
```

2. Set up environment variables - create `.env.local`:
```env
NEXT_PUBLIC_TELEGRAM_BOT_TOKEN=your_token
NEXT_PUBLIC_TELEGRAM_CHAT_ID=your_chat_id
```

3. Run development server:
```bash
npm run dev
```

## Deployment
The project is deployed on Vercel. Push to main branch to trigger automatic deployment.
