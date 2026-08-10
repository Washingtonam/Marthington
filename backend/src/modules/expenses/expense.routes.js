import express from "express";
import protect from "../../middlewares/auth.middleware.js";
import checkPermission from "../../middlewares/permission.middleware.js";
import checkSubscription from "../../middlewares/subscription.middleware.js";
import expenseController from "./expense.controller.js";

const router = express.Router();

// 🔥 CREATE EXPENSE (PROTECTED + PRO FEATURE)
router.post(
  "/",
  protect,
  checkSubscription,
  checkPermission("canManageExpenses"),
  expenseController.createExpense
);

// 🔥 GET ALL EXPENSES
router.get(
  "/",
  protect,
  checkPermission("canViewExpenses"),
  expenseController.getExpenses
);

// 🔥 GET EXPENSE SUMMARY (FOR DASHBOARD)
router.get(
  "/summary/metrics",
  protect,
  checkPermission("canViewExpenses"),
  expenseController.getExpenseSummary
);

// 🔥 GET SINGLE EXPENSE
router.get(
  "/:id",
  protect,
  checkPermission("canViewExpenses"),
  expenseController.getExpenseById
);

// 🔥 UPDATE EXPENSE
router.put(
  "/:id",
  protect,
  checkPermission("canManageExpenses"),
  expenseController.updateExpense
);

// 🔥 DELETE EXPENSE
router.delete(
  "/:id",
  protect,
  checkPermission("canManageExpenses"),
  expenseController.deleteExpense
);

// 🔥 BULK DELETE EXPENSES
router.post(
  "/bulk/delete",
  protect,
  checkPermission("canManageExpenses"),
  expenseController.bulkDeleteExpenses
);

export default router;
