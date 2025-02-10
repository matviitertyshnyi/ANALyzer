// anal_front/components/TISelectorModal.tsx
"use client";

import React, { useState } from "react";

interface Indicator {
  id: string;
  name: string;
}

const availableIndicators: Indicator[] = [
  { id: "sma", name: "Simple Moving Average" },
  { id: "ema", name: "Exponential Moving Average" },
  { id: "bb", name: "Bollinger Bands" },
  // You can add more indicators here as needed.
];

interface TISelectorModalProps {
  onConfirm: (selected: string[]) => void;
  onCancel: () => void;
  initialSelected: string[]; // Add this prop
}

export default function TISelectorModal({ onConfirm, onCancel, initialSelected }: TISelectorModalProps) {
  const [selected, setSelected] = useState<string[]>(initialSelected); // Initialize with current state

  const toggleIndicator = (id: string) => {
    setSelected((prev) => {
      return prev.includes(id) 
        ? prev.filter(x => x !== id) // Allow deselection
        : [...prev, id];
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Dimmed overlay */}
      <div className="absolute inset-0 bg-black opacity-50"></div>
      {/* Modal container */}
      <div className="relative bg-[#121212] rounded-lg shadow-lg p-8 z-10 w-11/12 max-w-lg border border-gray-700">
        <h2 className="text-3xl font-bold text-white mb-6">Select Technical Indicators</h2>
        <input
          type="text"
          placeholder="Search indicators..."
          className="w-full p-2 mb-4 rounded bg-gray-700 text-white placeholder-gray-400"
          // (Optional: You could implement search filtering here)
        />
        <ul>
          {availableIndicators.map((indicator) => (
            <li
              key={indicator.id}
              className="flex items-center justify-between py-2 border-b border-gray-700"
            >
              <span className="text-white">{indicator.name}</span>
              <button
                onClick={() => toggleIndicator(indicator.id)}
                className={`px-3 py-1 rounded border border-gray-600 bg-transparent ${
                  selected.includes(indicator.id) ? "text-blue-500" : "text-gray-400"
                } hover:text-white hover:border-white focus:outline-none`}
              >
                {selected.includes(indicator.id) ? "On" : "Off"}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end space-x-4 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-600 bg-transparent text-gray-600 rounded hover:text-white hover:border-white focus:outline-none text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selected)}
            className="px-4 py-2 border border-gray-600 bg-transparent text-gray-600 rounded hover:text-white hover:border-white focus:outline-none text-sm"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
