import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldAutoApproveExpense } from '../src/modules/expenses/expenseApproval.utils.js';

test('Expense Auto Approval: under threshold auto-approves', () => {
  const decision = shouldAutoApproveExpense({
    amount: 15000,
    category: 'inventory',
    businessSettings: {
      autoApproveEnabled: true,
      maxAutoApproveAmount: 20000,
      exemptCategories: ['inventory', 'utilities'],
      trustedSuppliers: []
    }
  });

  assert.equal(decision.shouldAutoApprove, true);
  assert.equal(decision.status, 'approved');
  assert.ok(decision.reason.includes('auto-approved'));
});

test('Expense Auto Approval: over threshold stays pending', () => {
  const decision = shouldAutoApproveExpense({
    amount: 25000,
    category: 'inventory',
    businessSettings: {
      autoApproveEnabled: true,
      maxAutoApproveAmount: 20000,
      exemptCategories: ['inventory'],
      trustedSuppliers: []
    }
  });

  assert.equal(decision.shouldAutoApprove, false);
  assert.equal(decision.status, 'pending');
  assert.ok(decision.reason.includes('exceeds'));
});

test('Expense Auto Approval: category not exempt stays pending', () => {
  const decision = shouldAutoApproveExpense({
    amount: 10000,
    category: 'marketing',
    businessSettings: {
      autoApproveEnabled: true,
      maxAutoApproveAmount: 20000,
      exemptCategories: ['inventory', 'utilities'],
      trustedSuppliers: []
    }
  });

  assert.equal(decision.shouldAutoApprove, false);
  assert.equal(decision.status, 'pending');
  assert.ok(decision.reason.includes('not exempt'));
});

test('Expense Auto Approval: trusted supplier auto-approves', () => {
  const decision = shouldAutoApproveExpense({
    amount: 35000,
    category: 'logistics',
    supplierId: 'supplier-123',
    businessSettings: {
      autoApproveEnabled: true,
      maxAutoApproveAmount: 20000,
      exemptCategories: ['inventory'],
      trustedSuppliers: ['supplier-123']
    }
  });

  assert.equal(decision.shouldAutoApprove, true);
  assert.equal(decision.status, 'approved');
  assert.ok(decision.reason.includes('trusted supplier'));
});

test('Expense Auto Approval: disabled feature keeps pending', () => {
  const decision = shouldAutoApproveExpense({
    amount: 5000,
    category: 'inventory',
    businessSettings: {
      autoApproveEnabled: false,
      maxAutoApproveAmount: 20000,
      exemptCategories: ['inventory'],
      trustedSuppliers: []
    }
  });

  assert.equal(decision.shouldAutoApprove, false);
  assert.equal(decision.status, 'pending');
  assert.ok(decision.reason.includes('disabled'));
});
