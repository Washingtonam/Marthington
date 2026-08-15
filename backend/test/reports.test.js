import test from 'node:test';
import assert from 'node:assert/strict';

import { buildReportSnapshot } from '../src/modules/reports/reports.controller.js';

test('Reports: 30-day snapshot filters sales and costs to the selected period', () => {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const sales = [
    {
      _id: 'sale-1',
      totalAmount: 200,
      totalProfit: 50,
      createdAt: new Date(now - 5 * dayMs),
      createdBy: { _id: 'staff-1', name: 'Alice' },
      isDeleted: false,
    },
    {
      _id: 'sale-2',
      totalAmount: 300,
      totalProfit: 80,
      createdAt: new Date(now - 10 * dayMs),
      createdBy: { _id: 'staff-1', name: 'Alice' },
      isDeleted: false,
    },
    {
      _id: 'sale-3',
      totalAmount: 500,
      totalProfit: 100,
      createdAt: new Date(now - 70 * dayMs),
      createdBy: { _id: 'staff-2', name: 'Bob' },
      isDeleted: false,
    }
  ];

  const products = [
    { _id: 'p-1', name: 'Milk', price: 30, stock: 5 },
    { _id: 'p-2', name: 'Rice', price: 50, stock: 2 }
  ];

  const transactions = [
    {
      _id: 'tx-1',
      amount: 40,
      status: 'posted',
      transactionType: 'expense',
      occurredAt: new Date(now - 6 * dayMs),
      isDeleted: false,
    },
    {
      _id: 'tx-2',
      amount: 100,
      status: 'posted',
      transactionType: 'expense',
      occurredAt: new Date(now - 120 * dayMs),
      isDeleted: false,
    }
  ];

  const snapshot = buildReportSnapshot({ sales, products, transactions, period: '30' });

  assert.equal(snapshot.overview.periodRevenue, 500);
  assert.equal(snapshot.overview.periodGrossProfit, 130);
  assert.equal(snapshot.overview.periodOperatingExpenses, 40);
  assert.equal(snapshot.overview.periodProfit, 90);
  assert.equal(snapshot.recentSales.length, 2);
  assert.equal(snapshot.lowStockProducts.length, 2);
});
