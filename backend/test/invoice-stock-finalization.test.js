import test from "node:test";
import assert from "node:assert/strict";

import {
  getOutgoingStockDelta,
  validateOutgoingStockAvailability
} from "../src/modules/invoices/invoice.stock.js";

test("getOutgoingStockDelta groups quantity by product for finalization", () => {
  const delta = getOutgoingStockDelta([
    { product: "p1", quantity: 2 },
    { product: "p1", quantity: 1 },
    { product: "p2", quantity: 3 }
  ]);

  assert.deepEqual(delta, [
    { product: "p1", quantity: 3 },
    { product: "p2", quantity: 3 }
  ]);
});

test("validateOutgoingStockAvailability rejects any negative stock situation", () => {
  const delta = getOutgoingStockDelta([
    { product: "p1", quantity: 5 },
    { product: "p2", quantity: 2 }
  ]);

  const result = validateOutgoingStockAvailability(
    { p1: 4, p2: 10 },
    delta
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.issues, [
    { product: "p1", required: 5, available: 4 }
  ]);
});

test("validateOutgoingStockAvailability accepts stock that is sufficient", () => {
  const delta = getOutgoingStockDelta([
    { product: "p1", quantity: 2 },
    { product: "p2", quantity: 1 }
  ]);

  const result = validateOutgoingStockAvailability(
    { p1: 10, p2: 5 },
    delta
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});
