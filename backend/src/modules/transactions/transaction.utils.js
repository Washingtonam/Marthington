import Transaction from "./transaction.model.js";

const EXPENSE_ACCOUNT_MAP = {
  inventory: "Inventory / Cost of Goods Sold",
  logistics: "Logistics Expense",
  utilities: "Utilities Expense",
  salaries: "Salaries and Wages",
  rent: "Rent Expense",
  marketing: "Marketing Expense",
  miscellaneous: "General Expenses"
};

const PAYMENT_ACCOUNT_MAP = {
  cash: "Cash",
  bank_transfer: "Bank",
  card: "Card Clearing",
  store_credit: "Accounts Payable"
};

export const buildGLPostingFromExpense = (expense) => {
  const amount = Number(expense?.amount ?? 0);
  const businessId = expense?.business ?? expense?.businessId ?? null;
  const category = expense?.category || "miscellaneous";
  const accountName = EXPENSE_ACCOUNT_MAP[category] || "General Expenses";

  return {
    businessId,
    transactionType: "expense",
    category,
    description: expense?.description || "Expense",
    amount,
    profit: 0,
    accountName,
    postingType: "debit",
    sourceModel: "Expense",
    sourceId: expense?._id ?? null,
    branchId: expense?.branch ?? null,
    status: "posted",
    occurredAt: expense?.date ? new Date(expense.date) : new Date(),
    createdBy: expense?.createdBy ?? null
  };
};

export const buildGLPaymentPostingFromExpense = (expense) => {
  const posting = buildGLPostingFromExpense(expense);

  return {
    ...posting,
    accountName: PAYMENT_ACCOUNT_MAP[expense?.paymentMethod] || "Cash",
    postingType: "credit"
  };
};

export const postExpenseToGL = async (expense) => {
  if (!expense || !expense.business) {
    return null;
  }

  const posting = buildGLPostingFromExpense(expense);
  const paymentPosting = buildGLPaymentPostingFromExpense(expense);

  const existing = await Transaction.find({
    businessId: posting.businessId,
    sourceModel: posting.sourceModel,
    sourceId: posting.sourceId,
    transactionType: posting.transactionType
  });

  const debitEntry = existing.find(entry => entry.postingType === "debit") || null;
  const creditEntry = existing.find(entry => entry.postingType === "credit") || null;
  const restoreFields = {
    isDeleted: false,
    deletedAt: null,
    deletedBy: null
  };

  if (debitEntry) {
    Object.assign(debitEntry, posting, restoreFields);
    await debitEntry.save();
  } else {
    await Transaction.create(posting);
  }

  if (creditEntry) {
    Object.assign(creditEntry, paymentPosting, restoreFields);
    await creditEntry.save();
  } else {
    await Transaction.create(paymentPosting);
  }

  return debitEntry || Transaction.findOne({
    businessId: posting.businessId,
    sourceModel: posting.sourceModel,
    sourceId: posting.sourceId,
    transactionType: posting.transactionType,
    postingType: "debit"
  });
};

export const reverseExpenseGL = async (expense, deletedBy = null) => {
  if (!expense?.business || !expense?._id) {
    return null;
  }

  const transactions = await Transaction.find({
    businessId: expense.business,
    sourceModel: "Expense",
    sourceId: expense._id,
    transactionType: "expense"
  });

  if (transactions.length === 0) {
    return null;
  }

  const deletedAt = new Date();
  await Promise.all(transactions.map(transaction => {
    transaction.status = "reversed";
    transaction.isDeleted = true;
    transaction.deletedAt = deletedAt;
    transaction.deletedBy = deletedBy;
    return transaction.save();
  }));

  return transactions;
};
