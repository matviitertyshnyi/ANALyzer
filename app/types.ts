// anal_front/app/types.ts
export interface Position {
  id: string;
  type: "Long" | "Short";
  coin: string;
  leverage: number;
  percentage: number;  // risk percentage
  initialMargin: number;
  exposure: number;
  size: number;          // Add size field
  entryPrice: number;
  liquidationPrice: number;
  exitPrice?: number;    // Optional for closed positions
  profit?: number;       // Optional for closed positions
  timestamp: number;
  originalPositions?: Position[]; // Add field for combined positions
}
