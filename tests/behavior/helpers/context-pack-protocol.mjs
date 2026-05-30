import assert from "node:assert/strict";

import { contextInputKinds, contextPackItemKinds, diffStates } from "../../../.tmp/build/src/shared/index.js";

const dependencyKey = (input) => `${input.kind}:${input.ref}:${input.hash}`;

export function assertProtocolPackItems(items, artifactInputRefs) {
  assert.ok(items.length > 0, "contextPackItems should not be empty");
  const artifactInputKeys = new Set(artifactInputRefs.map((inputRef) => dependencyKey(inputRef)));

  for (const item of items) {
    for (const field of ["id", "itemRef", "title", "contentHash"]) {
      assert.equal(typeof item[field], "string");
      assert.ok(item[field].length > 0, `contextPackItem.${field} should not be empty`);
    }
    assert.ok(diffStates.includes(item.state), `unexpected context pack state ${item.state}`);
    assert.ok(contextPackItemKinds.includes(item.itemKind), `unexpected context pack item kind ${item.itemKind}`);
    assert.equal(typeof item.content, "string");
    assert.equal("body" in item, false);
    assert.equal(typeof item.tokenCount, "number");
    assert.equal(typeof item.pinned, "boolean");
    assert.equal(typeof item.safetyCritical, "boolean");
    assert.ok(Array.isArray(item.inputRefs));
    assert.ok(item.inputRefs.length > 0, `context pack item ${item.id} should include input refs`);
    assert.ok(Array.isArray(item.warnings));

    if (item.state === "INVALIDATE_PREVIOUS") {
      assert.equal(typeof item.invalidatesSentItemId, "string");
      assert.ok(item.invalidatesSentItemId.length > 0, "INVALIDATE_PREVIOUS requires invalidatesSentItemId");
    }

    if (item.state === "RESTORE_AVAILABLE") {
      assert.equal(typeof item.restoreId, "string");
      assert.ok(item.restoreId.length > 0, "RESTORE_AVAILABLE requires restoreId");
    }

    for (const inputRef of item.inputRefs) {
      assert.ok(contextInputKinds.includes(inputRef.kind), `unexpected pack input kind ${inputRef.kind}`);
      for (const field of ["id", "ref", "hash"]) {
        assert.equal(typeof inputRef[field], "string");
        assert.ok(inputRef[field].length > 0, `contextPackItem.inputRef.${field} should not be empty`);
      }
      assert.ok(
        artifactInputKeys.has(dependencyKey(inputRef)),
        `pack item ${item.id} input should resolve to artifact input`
      );
    }
  }
}

export function assertSecondTurnOmissionProtocol(secondTurnItems) {
  assert.equal(secondTurnItems.some((item) => item.state === "OMIT_UNCHANGED"), true);
  assert.equal(secondTurnItems.some((item) => item.state === "RESTORE_AVAILABLE"), true);
}

export function assertInvalidationProtocol(secondTurnItems) {
  const invalidations = secondTurnItems.filter((item) => item.state === "INVALIDATE_PREVIOUS");
  assert.ok(invalidations.length > 0, "expected INVALIDATE_PREVIOUS items");
  for (const item of invalidations) {
    assert.equal(typeof item.invalidatesSentItemId, "string");
    assert.ok(item.invalidatesSentItemId.length > 0);
  }
}
