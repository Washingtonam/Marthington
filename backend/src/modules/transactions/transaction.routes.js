import express from "express";
import protect from "../../middlewares/auth.middleware.js";
import checkPermission from "../../middlewares/permission.middleware.js";
import transactionController from "./transaction.controller.js";

const router = express.Router();

const ownerOnly = (req, res, next) => {
  if (req.user.role !== "owner") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

router.get(
  "/",
  protect,
  checkPermission("canViewPayments"),
  transactionController.getTransactions
);

router.get(
  "/revenue-stats",
  protect,
  checkPermission("canViewPayments"),
  transactionController.getRevenueStats
);

router.get(
  "/profit-reports",
  protect,
  checkPermission("canViewPayments"),
  transactionController.getProfitReports
);

router.get(
  "/ledger",
  protect,
  checkPermission("canViewPayments"),
  transactionController.getLedgerEntries
);

router.get(
  "/deleted-records",
  protect,
  ownerOnly,
  transactionController.getDeletedRecords
);

router.patch(
  "/:id/status",
  protect,
  checkPermission("canManagePayments"),
  transactionController.updateTransactionStatus
);

router.delete(
  "/:id",
  protect,
  ownerOnly,
  transactionController.deleteTransaction
);

export default router;
