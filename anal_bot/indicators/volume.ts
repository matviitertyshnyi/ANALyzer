import { MarketData } from '../types';

export function calculateVolumeProfile(data: MarketData[]): Map<number, number> {
  const priceVolumes = new Map<number, number>();
  const priceLevels = 100;

  const minPrice = Math.min(...data.map(d => d.low));
  const maxPrice = Math.max(...data.map(d => d.high));
  const priceStep = (maxPrice - minPrice) / priceLevels;

  data.forEach(candle => {
    const priceLevel = Math.floor((candle.close - minPrice) / priceStep);
    priceVolumes.set(
      priceLevel, 
      (priceVolumes.get(priceLevel) || 0) + candle.volume
    );
  });

  return priceVolumes;
}
