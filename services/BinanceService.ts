import Binance from 'node-binance-api';

const binance = new Binance().options({
  APIKEY: process.env.BINANCE_API_KEY,
  APISECRET: process.env.BINANCE_API_SECRET
});

export async function placeOrder(symbol: string, side: 'BUY' | 'SELL', quantity: number, price: number): Promise<void> {
  try {
    const order = await binance.futuresOrder(side, symbol, quantity, price);
    console.log('Order placed:', order);
  } catch (error) {
    console.error('Failed to place order:', error);
  }
}
