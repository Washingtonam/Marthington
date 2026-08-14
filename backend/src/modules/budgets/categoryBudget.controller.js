import CategoryBudget from "./categoryBudget.model.js";
import {
  initializeDefaultCategoryBudgets,
  getCategorySpendingStatus,
  getMonthCategoryBudgetStatus,
  getAtRiskCategories
} from "./categoryBudget.utils.js";

/**
 * Get all category budgets for business
 */
const getCategoryBudgets = async (req, res) => {
  try {
    const budgets = await CategoryBudget.find({
      business: req.user.businessId,
      isActive: true
    }).sort({ category: 1 });

    return res.json(budgets);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to load category budgets" });
  }
};

/**
 * Get category budget by category name
 */
const getCategoryBudget = async (req, res) => {
  try {
    const { category } = req.params;

    const budget = await CategoryBudget.findOne({
      business: req.user.businessId,
      category
    });

    if (!budget) {
      return res.status(404).json({ message: `No budget found for category: ${category}` });
    }

    return res.json(budget);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to load budget" });
  }
};

/**
 * Create or update category budget
 */
const upsertCategoryBudget = async (req, res) => {
  try {
    const { category, monthlyBudget, alertThresholdPercent, notes } = req.body;

    if (!category || monthlyBudget === undefined) {
      return res.status(400).json({ message: "Category and monthlyBudget are required" });
    }

    if (monthlyBudget < 0) {
      return res.status(400).json({ message: "Monthly budget must be non-negative" });
    }

    if (alertThresholdPercent !== undefined && (alertThresholdPercent < 0 || alertThresholdPercent > 100)) {
      return res.status(400).json({ message: "Alert threshold must be between 0 and 100" });
    }

    let budget = await CategoryBudget.findOne({
      business: req.user.businessId,
      category
    });

    if (budget) {
      budget.monthlyBudget = monthlyBudget;
      if (alertThresholdPercent !== undefined) {
        budget.alertThresholdPercent = alertThresholdPercent;
      }
      if (notes !== undefined) {
        budget.notes = notes;
      }
      budget.updatedBy = req.user.id;
    } else {
      budget = await CategoryBudget.create({
        business: req.user.businessId,
        category,
        monthlyBudget,
        alertThresholdPercent: alertThresholdPercent || 80,
        notes: notes || "",
        createdBy: req.user.id
      });
    }

    await budget.save();
    return res.json({ message: "Budget saved", budget });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to save budget" });
  }
};

/**
 * Delete category budget
 */
const deleteCategoryBudget = async (req, res) => {
  try {
    const { category } = req.params;

    const budget = await CategoryBudget.findOneAndDelete({
      business: req.user.businessId,
      category
    });

    if (!budget) {
      return res.status(404).json({ message: `No budget found for category: ${category}` });
    }

    return res.json({ message: "Budget deleted" });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to delete budget" });
  }
};

/**
 * Get spending status for a category in a specific month
 */
const getCategorySpendingStatusEndpoint = async (req, res) => {
  try {
    const { category } = req.params;
    const { year, month } = req.query;

    const currentDate = new Date();
    const queryYear = year ? Number(year) : currentDate.getFullYear();
    const queryMonth = month ? Number(month) : currentDate.getMonth() + 1;

    const status = await getCategorySpendingStatus(req.user.businessId, category, queryYear, queryMonth);

    return res.json(status);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to load spending status" });
  }
};

/**
 * Get all category spending statuses for current month
 */
const getMonthlyBudgetOverview = async (req, res) => {
  try {
    const { year, month } = req.query;

    const currentDate = new Date();
    const queryYear = year ? Number(year) : currentDate.getFullYear();
    const queryMonth = month ? Number(month) : currentDate.getMonth() + 1;

    const statuses = await getMonthCategoryBudgetStatus(req.user.businessId, queryYear, queryMonth);
    const atRisk = statuses.filter(s => s.isOver || s.shouldAlert);

    return res.json({
      year: queryYear,
      month: queryMonth,
      overview: statuses,
      summary: {
        totalBudgeted: statuses.reduce((sum, s) => sum + s.budgeted, 0),
        totalSpent: statuses.reduce((sum, s) => sum + s.spent, 0),
        totalRemaining: statuses.reduce((sum, s) => sum + s.remaining, 0),
        categoriesOverBudget: statuses.filter(s => s.isOver).length,
        categoriesNearBudget: atRisk.filter(s => !s.isOver).length
      },
      atRisk
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to load budget overview" });
  }
};

/**
 * Initialize default category budgets for new business
 */
const initializeDefaults = async (req, res) => {
  try {
    const existing = await CategoryBudget.findOne({ business: req.user.businessId });
    if (existing) {
      return res.status(400).json({ message: "Category budgets already initialized" });
    }

    const budgets = await initializeDefaultCategoryBudgets(req.user.businessId);
    return res.json({ message: "Default budgets created", budgets });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to initialize budgets" });
  }
};

export default {
  getCategoryBudgets,
  getCategoryBudget,
  upsertCategoryBudget,
  deleteCategoryBudget,
  getCategorySpendingStatusEndpoint,
  getMonthlyBudgetOverview,
  initializeDefaults
};
