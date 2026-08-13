import test from "node:test";
import assert from "node:assert/strict";

import { buildGLPostingFromExpense } from "../src/modules/transactions/transaction.utils.js";

test("buildGLPostingFromExpense creates a ledger-ready expense posting", () => {
  const expense = {
    _id: "exp_123",
    business: "biz_456",
    amount: 25000,
    description: "Office rent",
    category: "rent",
    branch: "branch_789",
    date: new Date("2026-08-01T00:00:00.000Z"),
    status: "approved"
  };

  const posting = buildGLPostingFromExpense(expense);

  assert.equal(posting.businessId.toString(), "biz_456");
  assert.equal(posting.transactionType, "expense");
  assert.equal(posting.sourceModel, "Expense");
  assert.equal(posting.sourceId.toString(), "exp_123");
  assert.equal(posting.amount, 25000);
  assert.equal(posting.category, "rent");
  assert.equal(posting.description, "Office rent");
  assert.equal(posting.accountName, "Operating Expenses");
  assert.equal(posting.postingType, "debit");
  assert.equal(posting.status, "posted");
});
