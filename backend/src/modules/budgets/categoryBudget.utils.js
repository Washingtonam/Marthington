import CategoryBudget from "./categoryBudget.model.js";
import Expense from "../expenses/expense.model.js";

/**
 * Get or create default category budgets for a business
 * Useful for new businesses to have reasonable defaults
 */
export const initializeDefaultCategoryBudgets = async (businessId) => {
  const categories = [
    "inventory",
    "logistics",
    "utilities",
    "salaries",
    "rent",
    "marketing",
    "miscellaneous"
  ];

  const defaults = {
    inventory: 5000000, // 5M
    logistics: 1000000, // 1M
    utilities: 500000, // 500K
    salaries: 10000000, // 10M
    rent: 2000000, // 2M
    marketing: 1000000, // 1M
    miscellaneous: 500000 // 500K
  };

  const budgets = [];
  for (const category of categories) {
    const existing = await CategoryBudget.findOne({ business: businessId, category });
    if (!existing) {
      const budget = await CategoryBudget.create({
        business: businessId,
        category,
        monthlyBudget: defaults[category],
        alertThresholdPercent: 80,
        isActive: true
      });
      budgets.push(budget);
    }
  }

  return budgets;
};

/**
 * Get category spending for a specific month
 * @param {String} businessId - Business ID
 * @param {String} category - Expense category
 * @param {Number} year - Year
 * @param {Number} month - Month (1-12)
 * @returns {Promise<Object>} Spending data with budget info
 */
export const getCategorySpendingStatus = async (businessId, category, year, month) => {
  // Get category budget
  const budget = await CategoryBudget.findOne({
    business: businessId,
    category,
    isActive: true
  });

  if (!budget) {
    return {
      category,
      budgeted: 0,
      spent: 0,
      remaining: 0,
      percentUsed: 0,
      isOver: false,
      alertThreshold: 80,
      shouldAlert: false,
      year,
      month
    };
  }

  // Get expenses for this category in the month
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  const expenses = await Expense.find({
    business: businessId,
    category,
    date: { $gte: startOfMonth, $lte: endOfMonth }
  });

  const spent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const budgeted = Number(budget.monthlyBudget || 0);
  const remaining = Math.max(0, budgeted - spent);
  const percentUsed = budgeted > 0 ? (spent / budgeted) * 100 : 0;
  const isOver = spent > budgeted;
  const shouldAlert = percentUsed >= budget.alertThresholdPercent;

  return {
    category,
    budgeted,
    spent,
    remaining,
    percentUsed: Math.round(percentUsed * 100) / 100,
    isOver,
    alertThreshold: budget.alertThresholdPercent,
    shouldAlert,
    year,
    month,
    budgetId: budget._id
  };
};

/**
 * Get all category spending statuses for the current month
 * @param {String} businessId - Business ID
 * @param {Number} year - Year
 * @param {Number} month - Month (1-12)
 * @returns {Promise<Array>} Array of category spending statuses
 */
export const getMonthCategoryBudgetStatus = async (businessId, year, month) => {
  const categories = [
    "inventory",
    "logistics",
    "utilities",
    "salaries",
    "rent",
    "marketing",
    "miscellaneous"
  ];

  const statuses = [];
  for (const category of categories) {
    const status = await getCategorySpendingStatus(businessId, category, year, month);
    statuses.push(status);
  }

  return statuses;
};

/**
 * Get categories that need attention (over/near budget)
 * @param {String} businessId - Business ID
 * @param {Number} year - Year
 * @param {Number} month - Month (1-12)
 * @returns {Promise<Array>} Categories exceeding or nearing budget
 */
export const getAtRiskCategories = async (businessId, year, month) => {
  const statuses = await getMonthCategoryBudgetStatus(businessId, year, month);
  return statuses.filter(s => s.isOver || s.shouldAlert);
};

export default {
  initializeDefaultCategoryBudgets,
  getCategorySpendingStatus,
  getMonthCategoryBudgetStatus,
  getAtRiskCategories
};
