// anal_front/components/BalanceAdjuster.tsx
"use client";

import { useState } from "react";

interface BalanceAdjusterProps {
  balance: number;
  onAdjust: (newBalance: number) => void;
}

export default function BalanceAdjuster({ balance, onAdjust }: BalanceAdjusterProps) {
  const [amount, setAmount] = useState<number>(0);

  const handleDeposit = () => {
    if (amount <= 0) {
      alert("Please enter a positive amount to deposit.");
      return;
    }
    onAdjust(balance + amount);
    setAmount(0);
  };

  const handleWithdraw = () => {
    if (amount <= 0) {
      alert("Please enter a positive amount to withdraw.");
      return;
    }
    if (amount > balance) {
      alert("Insufficient balance for this withdrawal.");
      return;
    }
    onAdjust(balance - amount);
    setAmount(0);
  };

  return (
    <div className="mb-4 p-4 bg-gray-800 rounded-lg shadow-lg">
      <p className="text-lg font-semibold text-gray-300">
        Current Balance: {balance.toFixed(2)} USDC
      </p>
      <div className="flex space-x-2 mt-2 items-center">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(parseFloat(e.target.value))}
          className="p-2 rounded bg-gray-700 text-gray-200 w-32"
          placeholder="Amount"
          min="0"
        />
        <button
          onClick={handleDeposit}
          className="bg-green-600 hover:bg-green-700 text-white p-2 rounded"
        >
          Deposit
        </button>
        <button
          onClick={handleWithdraw}
          className="bg-red-600 hover:bg-red-700 text-white p-2 rounded"
        >
          Withdraw
        </button>
      </div>
    </div>
  );
}
