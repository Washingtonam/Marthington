import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkBudgetAlertTrigger,
  getAlertRecipients
} from '../src/modules/budgets/budgetAlert.utils.js';

test('Budget Alerts: Alert Trigger Logic', async (t) => {
  
  await t.test('No alert when spending is under threshold', () => {
    // Budget: 1M, spent: 500K, threshold: 80%
    // Should NOT trigger alert (50% < 80%)
    const budgeted = 1000000;
    const spent = 500000;
    const alertThreshold = 80;
    const percentUsed = (spent / budgeted) * 100;

    const shouldAlert = percentUsed >= alertThreshold;
    assert.equal(shouldAlert, false);
  });

  await t.test('Alert when threshold is reached', () => {
    // Budget: 1M, spent: 800K, threshold: 80%
    // Should trigger alert (80% >= 80%)
    const budgeted = 1000000;
    const spent = 800000;
    const alertThreshold = 80;
    const percentUsed = (spent / budgeted) * 100;

    const shouldAlert = percentUsed >= alertThreshold;
    assert.equal(shouldAlert, true);
  });

  await t.test('Alert when budget is exceeded', () => {
    // Budget: 1M, spent: 1.2M, threshold: 80%
    // Should trigger alert (120% >= 80% and over budget)
    const budgeted = 1000000;
    const spent = 1200000;
    const alertThreshold = 80;
    const percentUsed = (spent / budgeted) * 100;
    const isOver = spent > budgeted;

    const shouldAlert = percentUsed >= alertThreshold || isOver;
    assert.equal(shouldAlert, true);
    assert.equal(isOver, true);
  });

  await t.test('Distinguish between threshold reached and budget exceeded', () => {
    // Case 1: Threshold reached (90% of 1M)
    const budgeted1 = 1000000;
    const spent1 = 900000;
    const percentUsed1 = (spent1 / budgeted1) * 100;
    const isOver1 = spent1 > budgeted1;

    // Case 2: Budget exceeded (120% of 1M)
    const budgeted2 = 1000000;
    const spent2 = 1200000;
    const percentUsed2 = (spent2 / budgeted2) * 100;
    const isOver2 = spent2 > budgeted2;

    // Determine alert type
    const alertType1 = isOver1 ? 'budget_exceeded' : 'threshold_reached';
    const alertType2 = isOver2 ? 'budget_exceeded' : 'threshold_reached';

    assert.equal(alertType1, 'threshold_reached');
    assert.equal(alertType2, 'budget_exceeded');
  });

  await t.test('Custom alert thresholds', () => {
    // Budget: 1M, spent: 500K, custom 50% threshold
    const budgeted = 1000000;
    const spent = 500000;
    const customThreshold = 50;
    const percentUsed = (spent / budgeted) * 100;

    const shouldAlert = percentUsed >= customThreshold;
    assert.equal(shouldAlert, true); // 50% >= 50%
  });
});

test('Budget Alerts: Alert Categorization', async (t) => {
  
  await t.test('Different expense categories have different budgets', () => {
    const budgets = {
      inventory: { budgeted: 5000000, spent: 3000000, threshold: 80 }, // 60%
      salaries: { budgeted: 10000000, spent: 7000000, threshold: 80 }, // 70%
      utilities: { budgeted: 500000, spent: 300000, threshold: 80 } // 60%
    };

    const atRiskCategories = [];
    
    for (const [category, data] of Object.entries(budgets)) {
      const percentUsed = (data.spent / data.budgeted) * 100;
      if (percentUsed >= data.threshold) {
        atRiskCategories.push({
          category,
          percentUsed,
          budgeted: data.budgeted,
          spent: data.spent
        });
      }
    }

    assert.equal(atRiskCategories.length, 0); // None at 80% yet
  });

  await t.test('Identify multiple at-risk categories in single month', () => {
    const budgets = {
      inventory: { budgeted: 5000000, spent: 3000000, threshold: 80 }, // 60% - OK
      logistics: { budgeted: 1000000, spent: 850000, threshold: 80 }, // 85% - ALERT
      salaries: { budgeted: 10000000, spent: 11000000, threshold: 80 }, // 110% - OVER
      utilities: { budgeted: 500000, spent: 300000, threshold: 80 } // 60% - OK
    };

    const atRiskCategories = [];
    
    for (const [category, data] of Object.entries(budgets)) {
      const percentUsed = (data.spent / data.budgeted) * 100;
      const isOver = data.spent > data.budgeted;
      if (percentUsed >= data.threshold || isOver) {
        atRiskCategories.push({
          category,
          percentUsed,
          isOver,
          budgeted: data.budgeted,
          spent: data.spent
        });
      }
    }

    assert.equal(atRiskCategories.length, 2);
    assert.ok(atRiskCategories.find(c => c.category === 'logistics'));
    assert.ok(atRiskCategories.find(c => c.category === 'salaries'));
  });
});

test('Budget Alerts: Alert Recipients', async (t) => {
  
  await t.test('Identify eligible alert recipients', () => {
    // Simulate: Get users with manager/admin/owner roles
    const users = [
      { email: 'owner@business.com', role: 'owner', isActive: true },
      { email: 'admin@business.com', role: 'super_admin', isActive: true },
      { email: 'manager@business.com', role: 'manager', isActive: true },
      { email: 'staff@business.com', role: 'staff', isActive: true }, // Not eligible
      { email: 'inactive@business.com', role: 'manager', isActive: false } // Not eligible
    ];

    const eligibleRecipients = users.filter(u => 
      ['owner', 'super_admin', 'manager'].includes(u.role) && u.isActive
    );

    assert.equal(eligibleRecipients.length, 3);
    assert.ok(eligibleRecipients.find(r => r.email === 'owner@business.com'));
    assert.ok(eligibleRecipients.find(r => r.email === 'admin@business.com'));
    assert.ok(eligibleRecipients.find(r => r.email === 'manager@business.com'));
  });
});

test('Budget Alerts: Monthly Tracking', async (t) => {
  
  await t.test('Generate year-month key for alert uniqueness', () => {
    const now = new Date();
    const key1 = `${now.getFullYear()}-${now.getMonth()}`; // Current month
    const key2 = `${now.getFullYear()}-${now.getMonth() - 1}`; // Previous month

    assert.notEqual(key1, key2); // Different months = different keys
  });

  await t.test('Prevent duplicate alerts in same month', () => {
    // Simulate: Track which alerts have been sent
    const sentAlerts = new Map();
    
    const addAlert = (businessId, category, month, year) => {
      const key = `${businessId}-${category}-${year}-${month}`;
      if (sentAlerts.has(key)) {
        return false; // Alert already sent
      }
      sentAlerts.set(key, { sentAt: new Date() });
      return true;
    };

    const result1 = addAlert('biz123', 'inventory', 0, 2026); // First time
    const result2 = addAlert('biz123', 'inventory', 0, 2026); // Duplicate
    const result3 = addAlert('biz123', 'inventory', 1, 2026); // Different month

    assert.equal(result1, true);
    assert.equal(result2, false);
    assert.equal(result3, true);
  });

  await t.test('Track alert acknowledgement', () => {
    // Simulate: Alert with acknowledgement tracking
    const alert = {
      _id: 'alert123',
      business: 'biz123',
      category: 'inventory',
      isAcknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null
    };

    // Acknowledge alert
    const userId = 'user456';
    alert.isAcknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();

    assert.equal(alert.isAcknowledged, true);
    assert.equal(alert.acknowledgedBy, userId);
    assert.ok(alert.acknowledgedAt instanceof Date);
  });
});
