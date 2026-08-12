import test from 'node:test';
import assert from 'node:assert/strict';

import Customer from '../src/modules/customers/customer.model.js';

test('customer phone normalization treats local and country-prefixed numbers as the same customer', () => {
  assert.equal(Customer.normalizePhoneNumber('08031234567'), '2348031234567');
  assert.equal(Customer.normalizePhoneNumber('+234 803 123 4567'), '2348031234567');
  assert.equal(Customer.normalizePhoneNumber('  +2348031234567  '), '2348031234567');
  assert.equal(Customer.normalizePhoneNumber('abc'), '');
});
