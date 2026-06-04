import { strict as assert } from "node:assert";
import { webCartSubtotal } from "./cart";

export function testWebCartSubtotal(): void {
  assert.equal(webCartSubtotal([20, 30]), 50);
}
