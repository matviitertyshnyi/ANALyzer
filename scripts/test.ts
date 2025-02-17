import { SimpleMACDStrategy } from '../anal_bot/strategies/SimpleMACDStrategy';
import { MonteCarloSimulator } from '../anal_bot/backtesting/MonteCarloSimulator';
import { fetchHistoricalData } from '../lib/services/binance';
import { MarketData } from '../anal_bot/types';

interface SimulationResults {
  winRate: number;
  maxDrawdown: number;
  expectedReturn: number;
  totalTrades: number;
  avgProfit: number;
  avgLoss: number;
  riskMetrics: {
    sharpeRatio: number;
    sortinoPatio: number;
    maxConsecutiveLosses: number;
  };
}

async function runTest() {
  try {
    // Increase historical data period for better training
    console.log('Fetching historical data...');
    const data = await fetchHistoricalData('BTCUSDT', '1h', 180); // 180 days instead of 90

    // Optimize strategy settings based on current metrics
    const strategy = new SimpleMACDStrategy({
      symbol: 'BTCUSDT',
      interval: '1h',
      maxLeverage: 3,        // Reduced leverage to minimize risk
      stopLoss: 0.8,         // Wider stop loss to avoid premature exits
      takeProfit: 1.5,       // Higher profit target
      riskPerTrade: 15       // Reduced risk per trade
    });

    console.log('Running simulation...\n');
    const simulator = new MonteCarloSimulator();
    const totalIterations = 20; // Define fixed number of iterations

    const results = await simulator.simulateStrategy(
      strategy, 
      data, 
      totalIterations,
      (progress: number) => {
        process.stdout.write(`Progress: ${Math.round(progress * 100)}%\r`);
      }
    );

    // Clear the progress line
    process.stdout.write('\n\n');

    // Log market conditions first
    console.log('\nMarket Conditions:');
    console.log('------------------');
    console.log(`Price Range: $${Math.min(...data.map(d => d.low))} - $${Math.max(...data.map(d => d.high))}`);
    console.log(`Time Period: ${new Date(data[0].time).toLocaleDateString()} - ${new Date(data[data.length-1].time).toLocaleDateString()}`);
    console.log(`Volatility: ${calculateVolatility(data).toFixed(2)}%`);

    // Add more detailed results
    console.log('\nSimulation Results:');
    console.log('------------------');
    console.log(`Win Rate: ${results.winRate.toFixed(2)}%`);
    console.log(`Expected Return: ${results.expectedReturn.toFixed(2)}%`);
    console.log(`Max Drawdown: ${results.maxDrawdown.toFixed(2)}%`);
    console.log(`Sharpe Ratio: ${results.riskMetrics.sharpeRatio.toFixed(2)}`);
    console.log(`Max Consecutive Losses: ${results.riskMetrics.maxConsecutiveLosses}`);
    console.log(`\nTrade Stats:`);
    console.log(`Total Trades: ${results.totalTrades || 0}`);
    console.log(`Average Profit: $${results.avgProfit?.toFixed(2) || '0.00'}`);
    console.log(`Average Loss: $${results.avgLoss?.toFixed(2) || '0.00'}`);

  } catch (error) {
    console.error('Test failed:', error);
  }
}

function calculateVolatility(data: MarketData[]): number {
  const returns = data.slice(1).map((d, i) => (d.close - data[i].close) / data[i].close * 100);
  return Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * Math.sqrt(365);
}

runTest();
