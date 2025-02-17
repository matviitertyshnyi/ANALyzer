export abstract class BaseStrategy {
  protected takeProfit: number = 0;
  protected stopLoss: number = 0;

  abstract execute(): Promise<void>;
  
  setTakeProfit(value: number): void {
    this.takeProfit = value;
  }

  setStopLoss(value: number): void {
    this.stopLoss = value;
  }

  onOrderFilled(order: any): void {
    // Implement base order filled logic
    console.log('Order filled:', order);
  }
}
