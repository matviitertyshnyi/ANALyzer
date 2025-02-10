import { StrategyMetrics, TradeRecord } from '../types';

const STORAGE_KEY = 'bot_learning_data';

interface StoredBotData {
  metrics: StrategyMetrics;
  tradeHistory: TradeRecord[];
  macdPeriods: {
    fast: number;
    slow: number;
    signal: number;
  };
  lastUpdated: number;
}

export const saveBotData = (symbol: string, data: StoredBotData) => {
  try {
    const allData = getBotData();
    allData[symbol] = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allData));
  } catch (error) {
    console.error('Failed to save bot data:', error);
  }
};

export const getBotData = (): Record<string, StoredBotData> => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Failed to load bot data:', error);
    return {};
  }
};
