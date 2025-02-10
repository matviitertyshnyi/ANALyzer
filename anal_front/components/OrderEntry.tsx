// anal_front/components/OrderEntry.tsx
"use client";

import React, { useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { Position } from "../app/types";
import RangeSlider from "./RangeSlider";
import LeverageModal from "./LeverageModal";

const formatPrice = (price: number): string =>
  price >= 1 ? price.toFixed(2) : price.toFixed(8);

interface OrderEntryProps {
  selectedCoin: string;
  currentPrice: number;
  balance: number;
  onSubmit: (position: Position) => void;
  ref?: React.RefObject<{
    placeLongOrder: (amount: number, leverage: number) => void;
    placeShortOrder: (amount: number, leverage: number) => void;
  }>;
  disabled?: boolean;
}

const OrderEntry = forwardRef<{
  placeLongOrder: (amount: number, leverage: number) => void;
  placeShortOrder: (amount: number, leverage: number) => void;
}, OrderEntryProps>(({ selectedCoin, currentPrice, balance, onSubmit, disabled }, ref) => {
  const [percentage, setPercentage] = useState<number>(5);
  const [stopLoss, setStopLoss] = useState<number>(0);
  const [takeProfit, setTakeProfit] = useState<number>(0);

  const [leverage, setLeverage] = useState<number>(1);
  const [showLeverageModal, setShowLeverageModal] = useState<boolean>(false);

  if (percentage < 1) setPercentage(1);

  const initialMargin = (balance * percentage) / 100;
  const exposure = initialMargin * leverage;

  const computeLiquidationPrice = (type: "Long" | "Short") => {
    const factor = (percentage / 100) * leverage;
    if (factor === 0) return currentPrice;
    return type === "Long"
      ? currentPrice - currentPrice / factor
      : currentPrice + currentPrice / factor;
  };

  const createPosition = (type: "Long" | "Short", amount: number, leverageValue: number) => {
    if (!currentPrice || disabled) {
      console.error("Cannot create position: Price data not available");
      return;
    }

    if (amount <= 0 || leverageValue <= 0) {
      console.error("Invalid position parameters:", { amount, leverageValue });
      return;
    }

    const marginAmount = amount;
    const exposureAmount = marginAmount * leverageValue;
    const positionSize = exposureAmount / currentPrice; // Calculate actual position size in coins
    
    // Calculate liquidation price based on leverage and position type
    const liquidationDistance = currentPrice * (1 / leverageValue);
    const liquidationPrice = type === "Long" 
      ? currentPrice - liquidationDistance
      : currentPrice + liquidationDistance;

    console.log("Creating position:", {
      type,
      margin: marginAmount,
      exposure: exposureAmount,
      size: positionSize,
      entry: currentPrice,
      liquidation: liquidationPrice,
      leverage: leverageValue
    });

    const newPosition: Position = {
      id: Date.now().toString(),
      type,
      coin: selectedCoin,
      leverage: leverageValue,
      percentage: (marginAmount / balance) * 100,
      initialMargin: marginAmount,
      exposure: exposureAmount,
      size: positionSize,           // Add position size in coins
      entryPrice: currentPrice,
      liquidationPrice,
      timestamp: Date.now(),
    };

    onSubmit(newPosition);
  };

  const submitPosition = (type: "Long" | "Short") => {
    if (initialMargin > balance) {
      alert("Insufficient balance for this position.");
      return;
    }
    if (stopLoss < 0 || takeProfit < 0) {
      alert("Stop loss and take profit must be non-negative.");
      return;
    }
    const liquidationPrice = computeLiquidationPrice(type);
    const newPosition: Position = {
      id: Date.now().toString(),
      type,
      coin: selectedCoin,
      leverage,
      percentage,
      initialMargin,
      exposure,
      entryPrice: currentPrice,
      liquidationPrice,
      timestamp: Date.now(),
    };
    onSubmit(newPosition);
    setLeverage(1);
    setPercentage(5);
    setStopLoss(0);
    setTakeProfit(0);
  };

  const placeLongOrder = useCallback((amount: number, leverage: number) => {
    createPosition("Long", amount, leverage);
  }, [selectedCoin, currentPrice, balance]);

  const placeShortOrder = useCallback((amount: number, leverage: number) => {
    createPosition("Short", amount, leverage);
  }, [selectedCoin, currentPrice, balance]);

  useImperativeHandle(ref, () => ({
    placeLongOrder,
    placeShortOrder
  }));

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="text-2xl font-mono mb-2">
        {currentPrice ? currentPrice.toFixed(2) : "Loading..."} USDC
      </div>

      <form onSubmit={submitPosition} className="flex flex-col gap-4">
        <div>
          <button
            type="button"
            onClick={() => setShowLeverageModal(true)}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white p-2 rounded"
          >
            Set Leverage (Current: {leverage}x)
          </button>
        </div>
        <div>
          <RangeSlider
            initialValue={percentage}
            min={0}
            max={100}
            onChange={(value) => setPercentage(Math.round(value))}
          />
          <label className="block text-sm mt-1">
            Risk % of Balance: {Math.round(percentage)}%
          </label>
          <div className="text-sm text-gray-300 mt-1">
            Initial Margin: {initialMargin.toFixed(2)} USDC, Exposure:{" "}
            {exposure.toFixed(2)} USDC
          </div>
        </div>
        <div className="flex space-x-4">
          <div className="flex-1">
            <label className="block text-sm mb-1">Stop Loss (USDC)</label>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(parseFloat(e.target.value))}
              className="w-full p-2 bg-gray-700 rounded"
              min="0"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm mb-1">Take Profit (USDC)</label>
            <input
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(parseFloat(e.target.value))}
              className="w-full p-2 bg-gray-700 rounded"
              min="0"
            />
          </div>
        </div>
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => submitPosition("Long")}
            disabled={disabled}
            className={`w-1/2 p-3 rounded font-semibold ${
              disabled 
                ? "bg-gray-600 cursor-not-allowed" 
                : "bg-green-600 hover:bg-green-700"
            } text-white`}
          >
            {disabled ? "Price Loading..." : "Open Long"}
            <br />
            {!disabled && `(Market @ ${formatPrice(currentPrice)} USDC)`}
          </button>
          <button
            type="button"
            onClick={() => submitPosition("Short")}
            disabled={disabled}
            className={`w-1/2 p-3 rounded font-semibold ${
              disabled 
                ? "bg-gray-600 cursor-not-allowed" 
                : "bg-red-600 hover:bg-red-700"
            } text-white`}
          >
            {disabled ? "Price Loading..." : "Open Short"}
            <br />
            {!disabled && `(Market @ ${formatPrice(currentPrice)} USDC)`}
          </button>
        </div>
      </form>

      <div className="mt-auto pt-4 border-t border-gray-700">
        <div className="text-xs text-gray-400 mt-2">
          Liquidation Price (Long):{" "}
          {computeLiquidationPrice("Long").toFixed(6)} USDC
          <br />
          Liquidation Price (Short):{" "}
          {computeLiquidationPrice("Short").toFixed(6)} USDC
        </div>
      </div>

      {showLeverageModal && (
        <LeverageModal
          initialLeverage={leverage}
          onConfirm={(newLeverage) => {
            setLeverage(newLeverage);
            setShowLeverageModal(false);
          }}
          onCancel={() => setShowLeverageModal(false)}
        />
      )}
    </div>
  );
});

OrderEntry.displayName = 'OrderEntry';  // Add display name for dev tools

export default OrderEntry;
