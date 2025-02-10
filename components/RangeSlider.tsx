// anal_front/components/RangeSlider.tsx
"use client";

import React from "react";

interface RangeSliderProps {
  initialValue: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}

export default function RangeSlider({
  initialValue,
  onChange,
  min,
  max,
}: RangeSliderProps) {
  return (
    <input
      type="range"
      value={initialValue}
      min={min}
      max={max}
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="leverage-slider"
    />
  );
}
