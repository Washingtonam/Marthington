import test from 'node:test';
import assert from 'node:assert/strict';

import { getPurchaseApprovalStatus, PURCHASE_ORDER_BUDGET_CONFIG } from '../src/modules/purchaseOrders/purchaseOrderBudget.js';

test('large purchases trigger approval requirement', () => {
  const result = getPurchaseApprovalStatus(250000);

  assert.equal(result.requiresApproval, true);
  assert.match(result.reason, /approval threshold/i);
  assert.equal(result.threshold, PURCHASE_ORDER_BUDGET_CONFIG.LARGE_PURCHASE_THRESHOLD);
});

test('smaller purchases do not require approval', () => {
  const result = getPurchaseApprovalStatus(50000);

  assert.equal(result.requiresApproval, false);
  assert.equal(result.reason, null);
});
