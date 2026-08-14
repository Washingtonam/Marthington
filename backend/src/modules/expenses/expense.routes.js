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

// 🔥 APPROVE EXPENSE (OWNER/ADMIN ONLY)
router.post(
  "/:id/approve",
  protect,
  checkPermission("canManageExpenses"),
  expenseController.approveExpense
);

// 🔥 REJECT EXPENSE (OWNER/ADMIN ONLY)
router.post(
  "/:id/reject",
  protect,
  checkPermission("canManageExpenses"),
  expenseController.rejectExpense
);

// 🔥 GET EXPENSE TRENDS
router.get(
  "/trends/analysis",
  protect,
  checkPermission("canViewExpenses"),
  expenseController.getExpenseTrends
);

// 🔥 GET RECONCILIATION REPORT
router.get(
  "/reconciliation/report",
  protect,
  checkPermission("canViewExpenses"),
  expenseController.getReconciliationReport
);

// 🔥 GET BUDGET VS ACTUAL
router.get(
  "/budget/analysis",
  protect,
  checkPermission("canViewExpenses"),
  expenseController.getBudgetVsActual
);

// 🔥 LINK SUPPLIER INVOICE TO EXPENSE
router.post(
  "/:id/link-invoice",
  protect,
  checkPermission("canManageExpenses"),
  expenseController.linkInvoice
);

// ===== PHASE 1 ENHANCEMENT: PROCUREMENT EXPENSE APPROVAL =====

// 🔥 GET PENDING PROCUREMENT EXPENSES
router.get(
  "/procurement/pending",
  protect,
  checkPermission("canViewExpenses"),
  expenseController.getPendingProcurementExpenses
);

// 🔥 APPROVE PROCUREMENT EXPENSE (ENHANCED)
router.post(
  "/:id/approve-procurement",
  protect,
  checkPermission("canManageExpenses"),
  expenseController.approveProcurementExpense
);

// 🔥 BATCH APPROVE PROCUREMENT EXPENSES
router.post(
  "/procurement/batch-approve",
  protect,
  checkPermission("canManageExpenses"),
  expenseController.batchApproveProcurementExpenses
);

export default router;
