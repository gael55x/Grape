import { calculateDiscount } from "./calculateDiscount";

describe("calculateDiscount", () => {
  it("returns the configured member discount for a positive subtotal", () => {
    expect(calculateDiscount({ subtotalCents: 10000, memberDiscountPercent: 15 })).toBe(1500);
  });

  it("returns zero for non-positive subtotals", () => {
    expect(calculateDiscount({ subtotalCents: 0, memberDiscountPercent: 15 })).toBe(0);
  });
});
