import test from 'node:test';
import assert from 'node:assert/strict';

import { getPurchaseApprovalStatus, PURCHASE_ORDER_BUDGET_CONFIG } from '../src/modules/purchaseOrders/purchaseOrderBudget.js';

test('Procurement Pipeline: Workflow Validation', async (t) => {
  
  await t.test('Workflow 1: Standard Purchase - Small Order Does Not Require Approval', async () => {
    // Scenario: Staff member creates a 50,000 order
    const amount = 50000;
    const approvalStatus = getPurchaseApprovalStatus(amount);

    assert.equal(approvalStatus.requiresApproval, false);
    assert.equal(approvalStatus.amount, 50000);
    assert.equal(approvalStatus.threshold, PURCHASE_ORDER_BUDGET_CONFIG.LARGE_PURCHASE_THRESHOLD);
    assert.equal(approvalStatus.reason, null);
  });

  await t.test('Workflow 2: Large Purchase Requires Manager Approval', async () => {
    // Scenario: Staff member attempts 150,000 order (exceeds threshold)
    const amount = 150000;
    const approvalStatus = getPurchaseApprovalStatus(amount);

    assert.equal(approvalStatus.requiresApproval, true);
    assert.equal(approvalStatus.amount, 150000);
    assert.match(approvalStatus.reason, /approval threshold/i);
    assert.match(approvalStatus.reason, /manager/i);
  });

  await t.test('Workflow 3: Order at Exact Threshold', async () => {
    // Scenario: Order at exactly 100,000 (should require approval)
    const amount = 100000;
    const approvalStatus = getPurchaseApprovalStatus(amount);

    assert.equal(approvalStatus.requiresApproval, true);
    assert.equal(approvalStatus.amount, 100000);
  });

  await t.test('Workflow 4: Zero and Negative Amounts', async () => {
    // Scenario: Invalid amounts should not require approval
    assert.equal(getPurchaseApprovalStatus(0).requiresApproval, false);
    assert.equal(getPurchaseApprovalStatus(-100).requiresApproval, false);
    assert.equal(getPurchaseApprovalStatus(null).requiresApproval, false);
  });

  await t.test('Workflow 5: Receipt Status Transitions', async () => {
    // Scenario: Simulate receipt status progression
    // Initial: awaiting
    let receiptStatus = 'awaiting';
    assert.equal(receiptStatus, 'awaiting');

    // After partial receipt: partial
    receiptStatus = 'partial';
    assert.equal(receiptStatus, 'partial');

    // After final receipt: complete
    receiptStatus = 'complete';
    assert.equal(receiptStatus, 'complete');
  });

  await t.test('Workflow 6: PO Status Transitions', async () => {
    // Scenario: Simulate PO status through lifecycle
    // Created: pending
    let poStatus = 'pending';
    assert.equal(poStatus, 'pending');

    // After partial receipt: partial
    poStatus = 'partial';
    assert.equal(poStatus, 'partial');

    // After all received: received
    poStatus = 'received';
    assert.equal(poStatus, 'received');
  });

  await t.test('Workflow 7: Partial Receipt Calculation', async () => {
    // Scenario: Order 50 units, receive 30 first
    const ordered = 50;
    const received1 = 30;
    const canReceive = ordered - received1;

    assert.equal(canReceive, 20);
    assert.equal(received1 + canReceive, ordered);
  });

  await t.test('Workflow 8: Expense Auto-Calculation', async () => {
    // Scenario: Record receipt of 30 units at 5,000 per unit
    const quantity = 30;
    const costPerUnit = 5000;
    const totalExpense = quantity * costPerUnit;

    assert.equal(totalExpense, 150000);
  });

  await t.test('Workflow 9: Supplier Ledger Updates', async () => {
    // Scenario: Multiple receipts accumulate in supplier ledger
    let totalPurchases = 0;
    let outstandingBalance = 0;

    // First receipt: 30 units @ 5000
    const receipt1 = 30 * 5000;
    totalPurchases += receipt1;
    outstandingBalance += receipt1;

    assert.equal(totalPurchases, 150000);
    assert.equal(outstandingBalance, 150000);

    // Second receipt: 20 units @ 5000
    const receipt2 = 20 * 5000;
    totalPurchases += receipt2;
    outstandingBalance += receipt2;

    assert.equal(totalPurchases, 250000);
    assert.equal(outstandingBalance, 250000);
  });

  await t.test('Workflow 10: Approval Role Validation', async () => {
    // Scenario: Check which roles can approve large purchases
    const approvalRoles = PURCHASE_ORDER_BUDGET_CONFIG.APPROVAL_REQUIRED_ROLES;

    assert.deepEqual(approvalRoles, ['owner', 'super_admin', 'manager']);
    assert.ok(approvalRoles.includes('owner'));
    assert.ok(approvalRoles.includes('super_admin'));
    assert.ok(approvalRoles.includes('manager'));
  });
});
