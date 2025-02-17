'use client';

import { Position } from "@/app/types";

const formatPrice = (price: number): string =>
  price >= 1
    ? price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : price.toFixed(8);

interface PositionsTableProps {
  positions: Position[];
  pricesMapping: Record<string, number>;
  onClose: (id: string) => void;
  balance: number;
}

export default function PositionsTable({ positions, pricesMapping, onClose, balance }: PositionsTableProps) {
  // Group positions by type
  const groupPositions = (positions: Position[]) => {
    return positions.reduce((acc, pos) => {
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
  };

  // Combine positions of same type
  const getCombinedPositions = () => {
    const grouped = groupPositions(positions);

    return Object.entries(grouped).map(([key, group]) => {
      if (group.positions.length === 1) {
        return group.positions[0];
      }

      const first = group.positions[0];
      const totalSize = group.positions.reduce((sum, p) => sum + p.size, 0);
      const totalMargin = group.positions.reduce((sum, p) => sum + p.initialMargin, 0);

      // Calculate weighted average entry price
      const avgEntryPrice = group.positions.reduce(
        (sum, p) => sum + (p.entryPrice * p.size),
        0
      ) / totalSize;

      // Calculate effective leverage
      const effectiveLeverage = (totalSize * avgEntryPrice) / totalMargin;

      return {
        id: key,
        coin: first.coin,
        type: first.type,
        entryPrice: avgEntryPrice,
        size: totalSize,
        leverage: effectiveLeverage,
        initialMargin: totalMargin,
        liquidationPrice: first.liquidationPrice, // Use first position's liquidation price
        timestamp: Math.max(...group.positions.map(p => p.timestamp.getTime())),
        originalPositions: group.positions // Store original positions for closing
      };
    });
  };

  const handleClosePosition = (position: Position) => {
    if ('originalPositions' in position) {
      position.originalPositions.forEach(pos => onClose(pos.id));
    } else {
      onClose(position.id);
    }
  };

  const combinedPositions = getCombinedPositions();

  // Helper function to calculate position metrics
  const calculatePositionMetrics = (position: Position) => {
    const currentPrice = pricesMapping[position.coin] || position.entryPrice;
    const priceDiff = position.type === 'LONG' 
      ? currentPrice - position.entryPrice 
      : position.entryPrice - currentPrice;
    
    const profit = priceDiff * position.size;
    const roi = (profit / position.initialMargin) * 100;

    return {
      currentPrice,
      profit,
      roi,
      exposure: position.size * currentPrice,
      liquidationPrice: position.liquidationPrice,
      leverage: position.leverage
    };
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
          {combinedPositions.map((position) => {
            const metrics = calculatePositionMetrics(position);
            const profitColor = metrics.profit >= 0 ? "text-green-500" : "text-red-500";
            const roiColor = metrics.roi >= 0 ? "text-green-500" : "text-red-500";
            const isGrouped = 'originalPositions' in position;

            return (
              <tr key={position.id} className="bg-gray-800 hover:bg-gray-700">
                <td className="border px-4 py-2">{position.coin}</td>
                <td className="border px-4 py-2">
                  {position.type}
                  {isGrouped && (
                    <span className="ml-1 text-xs text-gray-400">
                      ({(position as any).originalPositions.length})
                    </span>
                  )}
                </td>
                <td className="border px-4 py-2">{formatPrice(position.entryPrice)}</td>
                <td className="border px-4 py-2">{formatPrice(metrics.currentPrice)}</td>
                <td className="border px-4 py-2">{formatPrice(metrics.liquidationPrice)} USDC</td>
                <td className={`border px-4 py-2 ${profitColor}`}>
                  {metrics.profit.toFixed(2)} USDC
                </td>
                <td className={`border px-4 py-2 ${roiColor}`}>
                  {metrics.roi.toFixed(2)}%
                </td>
                <td className="border px-4 py-2">{metrics.leverage}x</td>
                <td className="border px-4 py-2">
                  {metrics.exposure.toFixed(2)} USDC
                </td>
                <td className="border px-4 py-2">
                  {new Date(position.timestamp).toLocaleString()}
                </td>
                <td className="border px-4 py-2">
                  <button
                    onClick={() => handleClosePosition(position)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs"
                  >
                    Close {isGrouped ? 'All' : ''}
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
