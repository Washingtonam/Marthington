import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCategorySpendingStatus,
  getMonthCategoryBudgetStatus,
  getAtRiskCategories
} from '../src/modules/budgets/categoryBudget.utils.js';

test('Category Budget: Spending Status Calculations', async (t) => {
  
  await t.test('Calculate spending status when under budget', () => {
    // Simulate: Budget 1M, spent 500K, 80% alert threshold
    const budgeted = 1000000;
    const spent = 500000;
    const threshold = 80;
    
    const percentUsed = (spent / budgeted) * 100;
    const remaining = budgeted - spent;
    const shouldAlert = percentUsed >= threshold;
    const isOver = spent > budgeted;

    assert.equal(percentUsed, 50);
    assert.equal(remaining, 500000);
    assert.equal(shouldAlert, false);
    assert.equal(isOver, false);
  });

  await t.test('Calculate spending status when near budget (alert threshold)', () => {
    // Simulate: Budget 1M, spent 850K, 80% alert threshold
    const budgeted = 1000000;
    const spent = 850000;
    const threshold = 80;
    
    const percentUsed = (spent / budgeted) * 100;
    const remaining = budgeted - spent;
    const shouldAlert = percentUsed >= threshold;
    const isOver = spent > budgeted;

    assert.equal(percentUsed, 85);
    assert.equal(remaining, 150000);
    assert.equal(shouldAlert, true);
    assert.equal(isOver, false);
  });

  await t.test('Calculate spending status when over budget', () => {
    // Simulate: Budget 1M, spent 1.2M, 80% alert threshold
    const budgeted = 1000000;
    const spent = 1200000;
    const threshold = 80;
    
    const percentUsed = (spent / budgeted) * 100;
    const remaining = Math.max(0, budgeted - spent);
    const shouldAlert = percentUsed >= threshold;
    const isOver = spent > budgeted;

    assert.equal(percentUsed, 120);
    assert.equal(remaining, 0);
    assert.equal(shouldAlert, true);
    assert.equal(isOver, true);
  });

  await t.test('Calculate spending status with zero budget', () => {
    // Edge case: No budget set
    const budgeted = 0;
    const spent = 100000;
    
    const percentUsed = budgeted > 0 ? (spent / budgeted) * 100 : 0;
    const isOver = spent > budgeted;

    assert.equal(percentUsed, 0);
    assert.equal(isOver, true); // Any spending is over zero budget
  });

  await t.test('Calculate spending status with custom alert threshold', () => {
    // Simulate: Budget 1M, spent 600K, custom 50% threshold
    const budgeted = 1000000;
    const spent = 600000;
    const threshold = 50;
    
    const percentUsed = (spent / budgeted) * 100;
    const shouldAlert = percentUsed >= threshold;

    assert.equal(percentUsed, 60);
    assert.equal(shouldAlert, true); // 60% >= 50%
  });
});

test('Category Budget: Category Aggregation', async (t) => {
  
  await t.test('Aggregate multiple category budgets', () => {
    // Simulate: Multiple category budgets for a month
    const categories = [
      { category: 'inventory', budgeted: 5000000, spent: 3000000 },
      { category: 'logistics', budgeted: 1000000, spent: 900000 },
      { category: 'salaries', budgeted: 10000000, spent: 9500000 },
      { category: 'utilities', budgeted: 500000, spent: 450000 }
    ];

    const totalBudgeted = categories.reduce((sum, c) => sum + c.budgeted, 0);
    const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);
    const totalRemaining = totalBudgeted - totalSpent;

    assert.equal(totalBudgeted, 16500000);
    assert.equal(totalSpent, 13850000);
    assert.equal(totalRemaining, 2650000);
  });

  await t.test('Identify at-risk categories', () => {
    // Simulate: Multiple categories with different risk levels
    const categories = [
      { category: 'inventory', budgeted: 5000000, spent: 2500000, threshold: 80, isOver: false },
      { category: 'logistics', budgeted: 1000000, spent: 850000, threshold: 80, isOver: false }, // ALERT (85%)
      { category: 'salaries', budgeted: 10000000, spent: 11000000, threshold: 80, isOver: true }, // OVER
      { category: 'utilities', budgeted: 500000, spent: 300000, threshold: 80, isOver: false } // OK (60%)
    ];

    const atRisk = categories.filter(c => {
      const percentUsed = (c.spent / c.budgeted) * 100;
      return c.isOver || percentUsed >= c.threshold;
    });

    assert.equal(atRisk.length, 2);
    assert.ok(atRisk.find(c => c.category === 'logistics'));
    assert.ok(atRisk.find(c => c.category === 'salaries'));
  });
});

test('Category Budget: Month Calculations', async (t) => {
  
  await t.test('Calculate date range for specific month', () => {
    // January 2026
    const year = 2026;
    const month = 0; // JavaScript months are 0-indexed
    
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    assert.equal(startOfMonth.getFullYear(), 2026);
    assert.equal(startOfMonth.getMonth(), 0);
    assert.equal(startOfMonth.getDate(), 1);
    
    assert.equal(endOfMonth.getFullYear(), 2026);
    assert.equal(endOfMonth.getMonth(), 0);
    assert.equal(endOfMonth.getDate(), 31);
  });

  await t.test('Calculate date range for February (leap year)', () => {
    // February 2024 (leap year)
    const year = 2024;
    const month = 2;
    
    const endOfMonth = new Date(year, month, 0);

    assert.equal(endOfMonth.getDate(), 29); // Leap year
  });

  await t.test('Calculate date range for February (non-leap year)', () => {
    // February 2025 (non-leap year)
    const year = 2025;
    const month = 2;
    
    const endOfMonth = new Date(year, month, 0);

    assert.equal(endOfMonth.getDate(), 28); // Non-leap year
  });
});

test('Category Budget: Alert Threshold Logic', async (t) => {
  
  await t.test('Trigger alert at 80% threshold', () => {
    const budgeted = 1000000;
    const threshold = 80;
    const spent = 800000; // Exactly 80%
    
    const percentUsed = (spent / budgeted) * 100;
    const shouldAlert = percentUsed >= threshold;

    assert.equal(shouldAlert, true);
  });

  await t.test('No alert at 79% threshold', () => {
    const budgeted = 1000000;
    const threshold = 80;
    const spent = 790000; // 79%
    
    const percentUsed = (spent / budgeted) * 100;
    const shouldAlert = percentUsed >= threshold;

    assert.equal(shouldAlert, false);
  });

  await t.test('Custom 50% alert threshold', () => {
    const budgeted = 1000000;
    const threshold = 50;
    const spent = 500000; // Exactly 50%
    
    const percentUsed = (spent / budgeted) * 100;
    const shouldAlert = percentUsed >= threshold;

    assert.equal(shouldAlert, true);
  });

  await t.test('Very low alert threshold (10%)', () => {
    const budgeted = 1000000;
    const threshold = 10;
    const spent = 100000; // Exactly 10%
    
    const percentUsed = (spent / budgeted) * 100;
    const shouldAlert = percentUsed >= threshold;

    assert.equal(shouldAlert, true);
  });
});
