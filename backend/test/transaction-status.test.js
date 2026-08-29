import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeTransactionStatus } from '../src/modules/transactions/transaction.controller.js';
import salesController from '../src/modules/sales/sales.controller.js';

test('Transaction status normalizer accepts valid states and maps legacy aliases', () => {
  assert.equal(normalizeTransactionStatus('posted'), 'posted');
  assert.equal(normalizeTransactionStatus('PENDING'), 'pending');
  assert.equal(normalizeTransactionStatus('reversed'), 'reversed');
  assert.equal(normalizeTransactionStatus('completed'), 'posted');
  assert.equal(normalizeTransactionStatus('paid'), 'posted');
  assert.equal(normalizeTransactionStatus('invalid'), null);
  assert.equal(normalizeTransactionStatus(undefined), null);
});

test('Sales controller exposes a dedicated status update handler for sale records', () => {
  assert.equal(typeof salesController.updateSaleStatus, 'function');
});
