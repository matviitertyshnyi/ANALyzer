import { Trade, Order } from '../types';

export class OrderQueueManager {
  private orderQueue: Order[] = [];
  private isProcessing = false;

  public async addOrder(order: Order): Promise<void> {
    this.orderQueue.push(order);
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    this.isProcessing = true;
    while (this.orderQueue.length > 0) {
      const order = this.orderQueue.shift();
      try {
        // Process order with rate limiting and error handling
        await this.executeOrder(order);
        await this.sleep(300); // Rate limit
      } catch (error) {
        console.error(`Order execution failed: ${error}`);
      }
    }
    this.isProcessing = false;
  }
}
