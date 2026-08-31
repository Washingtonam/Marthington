import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeTransactionStatus } from '../src/modules/transactions/transaction.controller.js';
import salesController, { buildInvoiceCounterUpdate } from '../src/modules/sales/sales.controller.js';
import { isDuplicateKeyError, isTransactionAbortedError, normalizeSaleErrorMessage } from '../src/modules/sales/sales.utils.js';

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

test('Sales controller exposes a bulk status update handler for multiple sale records', () => {
  assert.equal(typeof salesController.bulkUpdateSaleStatus, 'function');
});

test('Transaction-aborted Mongo errors are normalized to a user-facing sale retry message', () => {
  assert.equal(isTransactionAbortedError('Transaction with { txnNumber: 1 } has been aborted.'), true);
  assert.equal(normalizeSaleErrorMessage(new Error('Transaction with { txnNumber: 1 } has been aborted.')), 'The sale transaction was aborted by the database. Please retry the sale.');
});

test('Duplicate-key Mongo errors are not mistaken for transaction aborts', () => {
  const duplicate = { code: 11000, message: 'E11000 duplicate key error collection: marthington.sales index: receiptId_1 dup key: { receiptId: "ABC123" }' };

  assert.equal(isDuplicateKeyError(duplicate), true);
  assert.equal(isTransactionAbortedError(duplicate), false);
  assert.equal(normalizeSaleErrorMessage(duplicate), duplicate.message);
});

test('NoSuchTransaction errors are treated as aborted Mongo transactions', () => {
  const aborted = {
    code: 251,
    codeName: 'NoSuchTransaction',
    message: 'Transaction with { txnNumber: 9 } has been aborted.'
  };

  assert.equal(isTransactionAbortedError(aborted), true);
  assert.equal(normalizeSaleErrorMessage(aborted), 'The sale transaction was aborted by the database. Please retry the sale.');
});

test('Invoice counter update avoids setting and incrementing lastNumber in the same Mongo operator', () => {
  const update = buildInvoiceCounterUpdate({ businessId: '64d27f4f11d24e0000000001' });

  assert.deepEqual(update.$setOnInsert, { business: '64d27f4f11d24e0000000001', prefix: 'INV' });
  assert.equal(update.$setOnInsert.lastNumber, undefined);
  assert.deepEqual(update.$inc, { lastNumber: 1 });
});
