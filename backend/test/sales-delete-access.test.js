import test from 'node:test';
import assert from 'node:assert/strict';
import { canDeleteSale, canRestoreSale, buildSalesQuery, getCustomerSaleImpact } from '../src/modules/sales/sales.utils.js';

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

test('customer sale impact subtracts totals and outstanding from deleted credit sale', () => {
  const impact = getCustomerSaleImpact({ paymentMethod: 'credit', totalAmount: 2500, action: 'delete' });

  assert.deepEqual(impact, {
    totalSpentDelta: -2500,
    totalOrdersDelta: -1,
    outstandingBalanceDelta: -2500
  });
});

test('customer sale impact restores totals and outstanding for restored credit sale', () => {
  const impact = getCustomerSaleImpact({ paymentMethod: 'credit', totalAmount: 2500, action: 'restore' });

  assert.deepEqual(impact, {
    totalSpentDelta: 2500,
    totalOrdersDelta: 1,
    outstandingBalanceDelta: 2500
  });
});

test('cash sales do not adjust outstanding balance when deleted or restored', () => {
  const deleted = getCustomerSaleImpact({ paymentMethod: 'cash', totalAmount: 1500, action: 'delete' });
  const restored = getCustomerSaleImpact({ paymentMethod: 'cash', totalAmount: 1500, action: 'restore' });

  assert.deepEqual(deleted, { totalSpentDelta: -1500, totalOrdersDelta: -1, outstandingBalanceDelta: 0 });
  assert.deepEqual(restored, { totalSpentDelta: 1500, totalOrdersDelta: 1, outstandingBalanceDelta: 0 });
});
