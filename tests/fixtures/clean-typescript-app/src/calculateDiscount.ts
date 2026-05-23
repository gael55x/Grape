export interface DiscountInput {
  subtotalCents: number;
  memberDiscountPercent: number;
}

export function calculateDiscount(input: DiscountInput): number {
  if (input.subtotalCents <= 0) {
    return 0;
  }

  const normalizedPercent = Math.max(0, Math.min(input.memberDiscountPercent, 100));
  return Math.round(input.subtotalCents * (normalizedPercent / 100));
}
