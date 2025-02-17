const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const apiClient = {
  async backtest(strategy: string, config: any) {
    const response = await fetch(`${API_BASE_URL}/backtest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy, config })
    });
    
    if (!response.ok) {
      throw new Error('Backtest request failed');
    }
    
    return response.json();
  },

  async getBalance() {
    const response = await fetch(`${API_BASE_URL}/balance`);
    if (!response.ok) throw new Error('Failed to fetch balance');
    return response.json();
  },

  async getBotState() {
    const response = await fetch(`${API_BASE_URL}/bot/state`);
    if (!response.ok) throw new Error('Failed to fetch bot state');
    return response.json();
  },

  async startBot() {
    const response = await fetch(`${API_BASE_URL}/bot/start`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to start bot');
    return response.json();
  },

  async stopBot() {
    const response = await fetch(`${API_BASE_URL}/bot/stop`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to stop bot');
    return response.json();
  }
};
