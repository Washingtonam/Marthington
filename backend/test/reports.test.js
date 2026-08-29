import test from 'node:test';
import assert from 'node:assert/strict';

import reportsController from '../src/modules/reports/reports.controller.js';
import Sale from '../src/modules/sales/sale.model.js';
import Product from '../src/modules/products/product.model.js';
import Transaction from '../src/modules/transactions/transaction.model.js';
import { buildReportSnapshot, buildDailyAnalysisSnapshot } from '../src/modules/reports/reports.controller.js';

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

test('Reports: branch inventory uses branch quantities and prices', () => {
  const snapshot = buildReportSnapshot({
    products: [],
    inventory: [
      { quantity: 4, branchPrice: 25, product: { _id: 'p-1', name: 'Milk', price: 30 } },
      { quantity: 20, branchPrice: 50, product: { _id: 'p-2', name: 'Rice', price: 60 } }
    ],
    period: '30'
  });

  assert.equal(snapshot.overview.inventoryValue, 1100);
  assert.equal(snapshot.lowStockProducts.length, 1);
  assert.equal(snapshot.lowStockProducts[0].stock, 4);
});

test('Reports: daily analysis separates payment methods and subtracts expenses', () => {
  const date = '2026-08-25';
  const snapshot = buildDailyAnalysisSnapshot({
    date,
    sales: [
      { totalAmount: 500, paymentMethod: 'cash', createdAt: `${date}T10:00:00.000Z`, items: [{ costPrice: 200, quantity: 1 }] },
      { totalAmount: 300, paymentMethod: 'bank_transfer', createdAt: `${date}T12:00:00.000Z`, items: [{ costPrice: 100, quantity: 1 }] },
      { totalAmount: 900, paymentMethod: 'cash', createdAt: '2026-08-24T12:00:00.000Z', items: [] },
    ],
    transactions: [{ amount: 150, category: 'transport', occurredAt: `${date}T15:00:00.000Z` }],
  });

  assert.deepEqual(snapshot.summary, { salesCount: 2, revenue: 800, cogs: 300, grossProfit: 500, expenses: 150, netProfit: 350 });
  assert.deepEqual(snapshot.paymentMethods, [
    { method: 'cash', count: 1, amount: 500 },
    { method: 'bank_transfer', count: 1, amount: 300 },
  ]);
});

test('Reports: sales query includes the sale status in the projection', async () => {
  const originalSaleFind = Sale.find;
  const originalProductFind = Product.find;
  const originalTransactionFind = Transaction.find;

  const sale = {
    _id: 'sale-123',
    totalAmount: 300,
    createdAt: new Date(),
    status: 'posted',
    items: [],
    paymentMethod: 'cash',
    createdBy: { _id: 'staff-1', name: 'Alice' },
  };

  try {
    Sale.find = () => ({
      select: (projection) => {
        assert.match(projection, /status/);
        return {
          populate: () => ({
            sort: () => [sale],
          }),
        };
      },
    });

    Product.find = () => [];
    Transaction.find = () => ({ lean: () => [] });

    const req = {
      user: { businessId: 'biz-1', role: 'owner' },
      query: {},
    };

    const res = {
      json: (payload) => {
        assert.ok(Array.isArray(payload.sales));
        assert.equal(payload.sales[0].status, 'posted');
      },
      status: () => res,
    };

    await reportsController.getReports(req, res);
  } finally {
    Sale.find = originalSaleFind;
    Product.find = originalProductFind;
    Transaction.find = originalTransactionFind;
  }
});
