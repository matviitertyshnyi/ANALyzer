declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT: string;
      ALLOWED_ORIGIN: string;
      API_KEY: string;
      DATABASE_URL: string;
      TELEGRAM_BOT_TOKEN?: string;
      TELEGRAM_CHAT_ID?: string;
    }
  }
}

export {};
