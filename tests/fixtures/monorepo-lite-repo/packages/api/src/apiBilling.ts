export interface ApiInvoice {
  subtotal: number;
  plan: "free" | "pro";
}

export function apiBillingTotal(invoice: ApiInvoice): number {
  if (invoice.subtotal <= 0) {
    return 0;
  }

  const platformFee = invoice.plan === "pro" ? 20 : 0;
  return invoice.subtotal + platformFee;
}
