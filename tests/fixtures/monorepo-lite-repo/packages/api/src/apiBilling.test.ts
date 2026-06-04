import { strict as assert } from "node:assert";
import { apiBillingTotal } from "./apiBilling";

export function testApiBillingTotalIncludesProFee(): void {
  assert.equal(apiBillingTotal({ subtotal: 100, plan: "pro" }), 120);
}
