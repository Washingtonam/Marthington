import test from 'node:test';
import assert from 'node:assert/strict';
import { canDeleteSale, canRestoreSale, buildSalesQuery } from '../src/modules/sales/sales.utils.js';

test('owners and super admins can delete sales', () => {
  assert.equal(canDeleteSale({ role: 'owner' }), true);
  assert.equal(canDeleteSale({ role: 'super_admin' }), true);
  assert.equal(canDeleteSale({ role: 'manager' }), false);
});

test('owners and super admins can restore archived sales', () => {
  assert.equal(canRestoreSale({ role: 'owner' }), true);
  assert.equal(canRestoreSale({ role: 'super_admin' }), true);
  assert.equal(canRestoreSale({ role: 'manager' }), false);
});

test('sales queries exclude deleted records by default', () => {
  assert.deepEqual(buildSalesQuery({ businessId: 'business-1', isSuperAdmin: false }), {
    business: 'business-1',
    isDeleted: { $ne: true }
  });
});

test('archive queries include deleted records for owners', () => {
  assert.deepEqual(buildSalesQuery({ businessId: 'business-1', isSuperAdmin: false, includeDeleted: true, canAccessDeleted: true }), {
    business: 'business-1',
    isDeleted: true
  });
});
