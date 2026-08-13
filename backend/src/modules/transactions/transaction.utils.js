import Transaction from "./transaction.model.js";

const EXPENSE_ACCOUNT_MAP = {
  inventory: "Cost of Goods Sold",
  logistics: "Operating Expenses",
  utilities: "Operating Expenses",
  salaries: "Operating Expenses",
  rent: "Operating Expenses",
  marketing: "Operating Expenses",
  miscellaneous: "General Expenses"
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

export const postExpenseToGL = async (expense) => {
  if (!expense || !expense.business) {
    return null;
  }

  const posting = buildGLPostingFromExpense(expense);

  const existing = await Transaction.findOne({
    businessId: posting.businessId,
    sourceModel: posting.sourceModel,
    sourceId: posting.sourceId,
    transactionType: posting.transactionType
  }).lean();

  if (existing) {
    return existing;
  }

  return Transaction.create(posting);
};
