import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProductCompensationEntries,
  buildSaleLedgerEntry
} from '../src/modules/sales/sales.utils.js';

test('sale compensation entries keep original unit cost and return type', () => {
  const entries = buildProductCompensationEntries({
    _id: 'sale-1',
    items: [
      { itemType: 'product', product: 'prod-1', quantity: 2, costPrice: 125, name: 'Widget' },
      { itemType: 'service', name: 'Setup', quantity: 1, costPrice: 0 }
    ]
  }, {
    businessId: 'biz-1',
    createdBy: 'user-1'
  });

  assert.deepEqual(entries, [{
    business: 'biz-1',
    product: 'prod-1',
    type: 'return',
    quantity: 2,
    unitCost: 125,
    note: 'Sale reversal sale-1',
    createdBy: 'user-1'
  }]);
});

test('sale ledger reversal entry keeps the original sale amount and source metadata', () => {
  const entry = buildSaleLedgerEntry({
    sale: {
      _id: 'sale-2',
      totalAmount: 2500,
      receiptId: 'RCPT-123',
      items: [{ quantity: 2, costPrice: 100, sellingPrice: 500, total: 1000 }]
    },
    businessId: 'biz-2',
    createdBy: 'user-2',
    status: 'reversed'
  });

  assert.equal(entry.transactionType, 'income');
  assert.equal(entry.postingType, 'credit');
  assert.equal(entry.status, 'reversed');
  assert.equal(entry.amount, 2500);
  assert.equal(entry.sourceModel, 'Sale');
  assert.equal(entry.sourceId, 'sale-2');
});
