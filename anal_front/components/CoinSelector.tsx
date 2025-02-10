// anal_front/components/CoinSelector.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";

interface Coin {
  id: string;
  symbol: string;
  name: string;
}

interface CoinSelectorProps {
  selectedCoin: string;
  onCoinChange: (coin: string) => void;
}

const coinIcons: Record<string, string> = {
  BTCUSDT: "₿",
  ETHUSDT: "Ξ",
  XRPUSDT: "✕",
};

export default function CoinSelector({ selectedCoin, onCoinChange }: CoinSelectorProps) {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchCoins() {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false"
        );
        const data = await response.json();
        const coinsData: Coin[] = data.map((coin: any) => ({
          id: coin.id,
          symbol: coin.symbol.toUpperCase() + "USDT",
          name: coin.name,
        }));
        setCoins(coinsData);
      } catch (error) {
        console.error("Error fetching coins:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchCoins();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) {
    return <div className="text-gray-400">Loading...</div>;
  }

  const selectedIcon = coinIcons[selectedCoin] || selectedCoin;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen((prev) => !prev)}
        className="w-10 h-10 flex items-center justify-center bg-gray-700 border border-gray-600 rounded-full focus:outline-none"
      >
        <span className="text-xl font-bold">{selectedIcon}</span>
        <svg
          className="absolute bottom-0 right-0 w-3 h-3 fill-current text-gray-300"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
        >
          <path d="M5.23 7.21a.75.75 0 011.06 0L10 10.91l3.71-3.7a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.23 8.27a.75.75 0 010-1.06z" />
        </svg>
      </button>
      {dropdownOpen && (
        <ul className="absolute z-10 mt-1 w-48 bg-gray-700 border border-gray-600 rounded shadow-lg max-h-60 overflow-auto">
          {coins.map((coin) => (
            <li
              key={coin.id}
              onClick={() => {
                onCoinChange(coin.symbol);
                setDropdownOpen(false);
              }}
              className={`p-2 cursor-pointer hover:bg-gray-600 ${
                coin.symbol === selectedCoin ? "bg-blue-600" : ""
              }`}
            >
              {coin.name} ({coinIcons[coin.symbol] || coin.symbol})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
