import { RawDataPoint } from '../interfaces';

interface SimulatedTrade {
  type: 'LONG' | 'SHORT' | 'NEUTRAL';
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  size: number;
  pnl: number;
  openTime: Date;
  closeTime: Date;
  status: 'filled' | 'closed' | 'stopped';
  confidence: number;
  slippage: number;
  expectedValue: number;
  executedPrice: number;
  intendedPrice: number;
}

export class TradeSimulator {
  private replayBuffer: SimulatedTrade[] = [];
  private maxReplaySize = 10000;

  simulateTrade(
    signal: string,
    entry: number,
    stop: number,
    target: number,
    size: number,
    confidence: number,
    priceData: RawDataPoint[]
  ): SimulatedTrade | null {
    // Enhanced validation
    if (!entry || !stop || !target || !size || !priceData?.length || 
        isNaN(entry) || isNaN(stop) || isNaN(target) || isNaN(size)) {
      console.error('Invalid trade parameters:', { 
        signal, entry, stop, target, size,
        dataPoints: priceData?.length 
      });
      return null;
    }

    // Validate price differences
    const stopDistance = Math.abs(entry - stop);
    const targetDistance = Math.abs(target - entry);
    if (stopDistance < 1 || targetDistance < 1) {
      console.error('Invalid price distances:', { stopDistance, targetDistance });
      return null;
    }

    const openTime = new Date(priceData[0].timestamp);
    let exitPrice = entry;
    let status: 'filled' | 'closed' | 'stopped' = 'filled';
    let closeTime = openTime;
    let slippage = this.calculateSlippage(entry);

    try {
      // Simulate price movement and find exit point
      for (let i = 1; i < priceData.length; i++) {
        const candle = priceData[i];
        const high = Number(candle.high);
        const low = Number(candle.low);

        if (signal === 'LONG') {
          if (low <= stop) {
            exitPrice = stop;
            status = 'stopped';
            closeTime = new Date(candle.timestamp);
            break;
          } else if (high >= target) {
            exitPrice = target;
            status = 'closed';
            closeTime = new Date(candle.timestamp);
            break;
          }
        } else if (signal === 'SHORT') {
          if (high >= stop) {
            exitPrice = stop;
            status = 'stopped';
            closeTime = new Date(candle.timestamp);
            break;
          } else if (low <= target) {
            exitPrice = target;
            status = 'closed';
            closeTime = new Date(candle.timestamp);
            break;
          }
        }
      }

      // Validate PnL calculation
      const pnl = this.calculatePnL(signal, entry, exitPrice, size, slippage);
      if (isNaN(pnl)) {
        console.error('Invalid PnL calculation:', { signal, entry, exitPrice, size, slippage });
        return null;
      }

      const trade: SimulatedTrade = {
        type: signal as 'LONG' | 'SHORT' | 'NEUTRAL',
        entryPrice: entry,
        exitPrice,
        stopLoss: stop,
        takeProfit: target,
        size,
        pnl,
        openTime,
        closeTime,
        status,
        confidence,
        slippage,
        expectedValue: this.calculateExpectedValue(entry, stop, target, confidence),
        executedPrice: entry + slippage,
        intendedPrice: entry
      };

      console.log('Simulated trade:', {
        type: trade.type,
        entry: trade.entryPrice,
        exit: trade.exitPrice,
        pnl: trade.pnl,
        status: trade.status
      });

      // Add to replay buffer
      this.addToReplayBuffer(trade);

      return trade;
    } catch (error) {
      console.error('Trade simulation error:', error);
      return null;
    }
  }

  private calculateSlippage(price: number): number {
    // Simulate realistic slippage (0.01% - 0.1%)
    return price * (0.0001 + Math.random() * 0.0009);
  }

  private calculatePnL(
    signal: string,
    entry: number,
    exit: number,
    size: number,
    slippage: number
  ): number {
    if (!entry || !exit || !size || isNaN(slippage)) {
      console.error('Invalid PnL parameters:', { signal, entry, exit, size, slippage });
      return 0;
    }

    const direction = signal === 'LONG' ? 1 : -1;
    const pnl = direction * (exit - entry - slippage) * size;
    return isNaN(pnl) ? 0 : pnl;
  }

  private calculateExpectedValue(
    entry: number,
    stop: number,
    target: number,
    confidence: number
  ): number {
    const risk = Math.abs(entry - stop);
    const reward = Math.abs(target - entry);
    return (reward * confidence) - (risk * (1 - confidence));
  }

  private addToReplayBuffer(trade: SimulatedTrade): void {
    this.replayBuffer.push(trade);
    if (this.replayBuffer.length > this.maxReplaySize) {
      this.replayBuffer.shift();
    }
  }

  getReplayBuffer(): SimulatedTrade[] {
    return this.replayBuffer;
  }

  sampleReplayBatch(batchSize: number): SimulatedTrade[] {
    const batch: SimulatedTrade[] = [];
    for (let i = 0; i < batchSize; i++) {
      const randomIndex = Math.floor(Math.random() * this.replayBuffer.length);
      batch.push(this.replayBuffer[randomIndex]);
    }
    return batch;
  }
}
