import { Command } from 'commander';
import inquirer from 'inquirer';
import { TRADING_CONFIG } from '../anal_back/config/tradingConfig';
import axios from 'axios';
import ora from 'ora';

const program = new Command();

program
  .name('train')
  .description('Start ML model training')
  .option('-q, --quick', 'Quick start with default settings')
  .parse(process.argv);

async function startTraining() {
  const spinner = ora();
  try {
    const options = program.opts();
    let config;

    if (options.quick) {
      config = {
        symbol: 'BTCUSDT',
        interval: '1h',
        lookback: 180,
        epochs: 100,
        autoRetrain: true
      };
    } else {
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'symbol',
          message: 'Select trading pair:',
          choices: [
            TRADING_CONFIG.TRADING_PAIRS.PRIMARY.symbol,
            ...TRADING_CONFIG.TRADING_PAIRS.SECONDARY.map(p => p.symbol)
          ]
        },
        {
          type: 'list',
          name: 'interval',
          message: 'Select timeframe:',
          choices: TRADING_CONFIG.STRATEGY.TIMEFRAMES
        },
        {
          type: 'number',
          name: 'lookback',
          message: 'Days of historical data (30-365):',
          default: 180,
          validate: (value) => value >= 30 && value <= 365
        },
        {
          type: 'number',
          name: 'epochs',
          message: 'Number of training epochs:',
          default: 100
        },
        {
          type: 'confirm',
          name: 'autoRetrain',
          message: 'Enable auto-retraining?',
          default: true
        }
      ]);

      config = answers;
    }

    spinner.start('Starting training...');

    const response = await axios.post('http://localhost:5001/api/train', config);
    
    if (response.data.success) {
      spinner.succeed('Training started successfully');
      console.log('\nMonitor progress:');
      console.log('1. Check Telegram for updates');
      console.log('2. Visit http://localhost:3000/training');
      console.log('3. Check logs in /anal_back/logs/bot.log');
    }

  } catch (error: any) {
    spinner.fail('Training failed to start');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

startTraining();
