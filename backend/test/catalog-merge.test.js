import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeCatalogName,
  pickPreferredCatalogName,
  mergeCatalogValues
} from '../src/modules/catalog/catalogUtils.js';

test('normalizeCatalogName collapses spacing and punctuation', () => {
  assert.equal(normalizeCatalogName('  Blue  Tooth Mouse  '), 'blue tooth mouse');
  assert.equal(normalizeCatalogName('Dell-Laptop 15"'), 'dell laptop 15');
});

test('mergeCatalogValues prefers the more descriptive name and sums stock', () => {
  const merged = mergeCatalogValues(
    { name: 'Dell Laptop', stock: 8, price: 500000, costPrice: 410000 },
    { name: 'Dell Laptop 15 Inch', stock: 3, price: 550000, costPrice: 420000 }
  );

  assert.equal(merged.name, 'Dell Laptop 15 Inch');
  assert.equal(merged.stock, 11);
  assert.equal(merged.price, 550000);
  assert.equal(merged.costPrice, 410000);
  assert.equal(pickPreferredCatalogName('Dell Laptop', 'Dell Laptop 15 Inch'), 'Dell Laptop 15 Inch');
});
