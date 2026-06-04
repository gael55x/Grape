export function webCartSubtotal(prices: number[]): number {
  return prices.reduce((total, price) => total + price, 0);
}
