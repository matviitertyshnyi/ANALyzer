// anal_front/components/LeverageModal.tsx
"use client";

import React, { useState } from "react";
import RangeSlider from "./RangeSlider";

interface LeverageModalProps {
  initialLeverage: number;
  onConfirm: (newLeverage: number) => void;
  onCancel: () => void;
}

export default function LeverageModal({
  initialLeverage,
  onConfirm,
  onCancel,
}: LeverageModalProps) {
  const [leverage, setLeverage] = useState<number>(initialLeverage);

  const handleDecrement = () => {
    setLeverage((prev) => Math.max(prev - 1, 1));
  };

  const handleIncrement = () => {
    setLeverage((prev) => Math.min(prev + 1, 100));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val)) {
      setLeverage(Math.min(Math.max(val, 1), 100));
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setLeverage(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Dimmed overlay */}
      <div className="absolute inset-0 bg-black opacity-50"></div>
      {/* Modal container */}
      <div className="relative bg-[#121212] rounded-lg shadow-lg p-8 z-10 w-11/12 max-w-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">Adjust Leverage</h2>
          <button
            onClick={onCancel}
            className="text-white text-2xl leading-none focus:outline-none"
          >
            &times;
          </button>
        </div>
        {/* Unified leverage control readout (text only) */}
        <div className="mb-4">
          <p className="text-xl font-bold text-white">Leverage: {leverage}x</p>
        </div>
        {/* Leverage Slider */}
        <div className="mb-6">
          <input
            type="range"
            min="1"
            max="100"
            value={leverage}
            onChange={handleSliderChange}
            className="leverage-slider"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>1x</span>
            <span>15x</span>
            <span>30x</span>
            <span>45x</span>
            <span>60x</span>
            <span>75x</span>
            <span>100x</span>
          </div>
        </div>
        {/* Confirmation Buttons */}
        <div className="flex justify-end space-x-4 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-600 rounded text-gray-600 hover:text-white hover:border-white focus:outline-none bg-transparent"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(leverage)}
            className="px-4 py-2 border border-gray-600 rounded text-gray-600 hover:text-white hover:border-white focus:outline-none bg-transparent"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
