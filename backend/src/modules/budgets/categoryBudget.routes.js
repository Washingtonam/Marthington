import express from "express";
import protect from "../../middlewares/auth.middleware.js";
import categoryBudgetController from "./categoryBudget.controller.js";

const router = express.Router();

// Get all category budgets
router.get("/", protect, categoryBudgetController.getCategoryBudgets);

// Get monthly budget overview
router.get("/overview/monthly", protect, categoryBudgetController.getMonthlyBudgetOverview);

// Initialize default budgets
router.post("/initialize/defaults", protect, categoryBudgetController.initializeDefaults);

// Get spending status for specific category
router.get("/category/:category/status", protect, categoryBudgetController.getCategorySpendingStatusEndpoint);

// Get specific category budget
router.get("/category/:category", protect, categoryBudgetController.getCategoryBudget);

// Create/update category budget
router.put("/category/:category", protect, categoryBudgetController.upsertCategoryBudget);

// Delete category budget
router.delete("/category/:category", protect, categoryBudgetController.deleteCategoryBudget);

export default router;
