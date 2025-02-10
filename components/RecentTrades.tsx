// anal_front/components/RecentTrades.tsx
"use client";

import React from "react";
import { Position } from "../app/types";

const formatPrice = (price: number): string =>
  price >= 1
    ? price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : price.toFixed(8);

interface RecentTradesProps {
  closedTrades: Position[];
}

export default function RecentTrades({ closedTrades }: RecentTradesProps) {
  if (closedTrades.length === 0) {
    return <div className="text-gray-400">No closed trades yet.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-700">
          <tr>
            <th className="border px-2 py-1">Coin</th>
            <th className="border px-2 py-1">Type</th>
            <th className="border px-2 py-1">Entry</th>
            <th className="border px-2 py-1">Exit</th>
            <th className="border px-2 py-1">Profit (USDC)</th>
            <th className="border px-2 py-1">Closed Time</th>
          </tr>
        </thead>
        <tbody>
          {closedTrades.map((trade) => (
            <tr key={trade.id} className="bg-gray-800 hover:bg-gray-700">
              <td className="border px-2 py-1">{trade.coin}</td>
              <td className="border px-2 py-1">{trade.type}</td>
              <td className="border px-2 py-1">{formatPrice(trade.entryPrice)}</td>
              <td className="border px-2 py-1">
                {trade.exitPrice ? formatPrice(trade.exitPrice) : "-"}
              </td>
              <td className="border px-2 py-1">
                {trade.profit ? trade.profit.toFixed(2) : "-"}
              </td>
              <td className="border px-2 py-1">
                {new Date(trade.timestamp).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
