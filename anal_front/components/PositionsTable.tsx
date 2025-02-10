// anal_front/components/PositionsTable.tsx
"use client";

import { Position } from "../app/types";

// Helper function to format price.
const formatPrice = (price: number): string =>
  price >= 1
    ? price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : price.toFixed(8);

interface PositionsTableProps {
  positions: Position[];
  pricesMapping: Record<string, number>;
  onClose: (id: string, profit: number, margin: number) => void;
  balance: number;  // Add balance prop
}

export default function PositionsTable({ positions, pricesMapping, onClose, balance }: PositionsTableProps) {
  // Aggregate positions by coin and type
  const aggregatePositions = (positions: Position[]) => {
    const groupedPositions = positions.reduce((acc, pos) => {
      const key = `${pos.coin}-${pos.type}`;
      if (!acc[key]) {
        acc[key] = {
          positions: [],
          combined: null as Position | null
        };
      }
      acc[key].positions.push(pos);
      return acc;
    }, {} as Record<string, { positions: Position[], combined: Position | null }>);

    // Calculate combined positions
    Object.values(groupedPositions).forEach(group => {
      if (group.positions.length === 1) {
        group.combined = group.positions[0];
        return;
      }

      const first = group.positions[0];
      const totalExposure = group.positions.reduce((sum, p) => sum + p.exposure, 0);
      const totalMargin = group.positions.reduce((sum, p) => sum + p.initialMargin, 0);
      const totalSize = group.positions.reduce((sum, p) => sum + p.size, 0);

      // Calculate weighted average entry price
      const avgEntryPrice = group.positions.reduce(
        (sum, p) => sum + (p.entryPrice * p.size),
        0
      ) / totalSize;

      // Calculate effective leverage
      const effectiveLeverage = totalExposure / totalMargin;

      // Calculate new liquidation price based on effective leverage
      const liquidationDistance = avgEntryPrice * (1 / effectiveLeverage);
      const liquidationPrice = first.type === "Long"
        ? avgEntryPrice - liquidationDistance
        : avgEntryPrice + liquidationDistance;

      group.combined = {
        id: `${first.coin}-${first.type}-combined`,
        type: first.type,
        coin: first.coin,
        leverage: effectiveLeverage,
        percentage: (totalMargin / balance) * 100,
        initialMargin: totalMargin,
        exposure: totalExposure,
        size: totalSize,
        entryPrice: avgEntryPrice,
        liquidationPrice,
        timestamp: Math.max(...group.positions.map(p => p.timestamp)),
        originalPositions: group.positions // Add reference to original positions
      };
    });

    return Object.values(groupedPositions).map(g => g.combined!);
  };

  const aggregatedPositions = aggregatePositions(positions);

  const calculatePnL = (position: Position): { profit: number; roi: number } => {
    const currentPrice = pricesMapping[position.coin] || position.entryPrice;
    const priceDiff = position.type === "Long" 
      ? currentPrice - position.entryPrice
      : position.entryPrice - currentPrice;
    
    const profit = priceDiff * position.size;
    const roi = (profit / position.initialMargin) * 100;

    return { profit, roi };
  };

  // Add function to close all positions in a combined position
  const handleClosePosition = (position: Position) => {
    if ('originalPositions' in position) {
      // Close all original positions in the combined position
      position.originalPositions.forEach(pos => {
        const { profit } = calculatePnL(pos);
        onClose(pos.id, profit, pos.initialMargin);
      });
    } else {
      // Close single position
      const { profit } = calculatePnL(position);
      onClose(position.id, profit, position.initialMargin);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-[#121212]">
          <tr>
            <th className="border px-4 py-2">Coin</th>
            <th className="border px-4 py-2">Type</th>
            <th className="border px-4 py-2">Entry (USDC)</th>
            <th className="border px-4 py-2">Current (USDC)</th>
            <th className="border px-4 py-2">Liquidation (USDC)</th>
            <th className="border px-4 py-2">Profit (USDC)</th>
            <th className="border px-4 py-2">ROI (%)</th>
            <th className="border px-4 py-2">Leverage</th>
            <th className="border px-4 py-2">Exposure (USDC)</th>
            <th className="border px-4 py-2">Timestamp</th>
            <th className="border px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {aggregatedPositions.map((position) => {
            const { profit, roi } = calculatePnL(position);
            const coinPrice = pricesMapping[position.coin] || position.entryPrice;
            const profitColor = profit >= 0 ? "text-green-500" : "text-red-500";
            const roiColor = roi >= 0 ? "text-green-500" : "text-red-500";

            return (
              <tr key={position.id} className="bg-gray-800 hover:bg-gray-700">
                <td className="border px-4 py-2">{position.coin}</td>
                <td className="border px-4 py-2">
                  {position.type}
                  {'originalPositions' in position && 
                    <span className="text-xs ml-1">({position.originalPositions.length})</span>
                  }
                </td>
                <td className="border px-4 py-2">{formatPrice(position.entryPrice)}</td>
                <td className="border px-4 py-2">{formatPrice(coinPrice)}</td>
                <td className="border px-4 py-2">
                  {position.liquidationPrice.toFixed(6)} USDC
                </td>
                <td className={`border px-4 py-2 ${profitColor}`}>
                  {profit.toFixed(2)} USDC
                </td>
                <td className={`border px-4 py-2 ${roiColor}`}>
                  {roi.toFixed(2)}%
                </td>
                <td className="border px-4 py-2">{position.leverage}x</td>
                <td className="border px-4 py-2">
                  {position.exposure.toFixed(2)} USDC
                </td>
                <td className="border px-4 py-2">
                  {new Date(position.timestamp).toLocaleString()}
                </td>
                <td className="border px-4 py-2">
                  <button
                    onClick={() => handleClosePosition(position)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs"
                  >
                    Close {('originalPositions' in position) ? 'All' : ''}
                  </button>
                </td>
              </tr>
            );
          })}
          {positions.length === 0 && (
            <tr>
              <td className="border px-4 py-2 text-center" colSpan={11}>
                No positions yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
