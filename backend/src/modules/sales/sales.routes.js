import express from "express";
import protect from "../../middlewares/auth.middleware.js";
import checkPermission from "../../middlewares/permission.middleware.js";
import checkSubscription from "../../middlewares/subscription.middleware.js"; // 🔥 NEW
import salesController from "./sales.controller.js";

const router = express.Router();

// 🔥 CREATE SALE (PROTECTED + SUBSCRIPTION AWARE)
router.post(
  "/",
  protect,
  checkSubscription, // 🔥 MUST COME BEFORE CONTROLLER
  checkPermission("canMakeSale"),
  salesController.createSale
);

// 🔥 GET ALL SALES
router.get(
  "/",
  protect,
  checkPermission("canViewSales"),
  salesController.getSales
);

// 🔥 DELETE SALE (OWNER ONLY)
router.delete(
  "/:id",
  protect,
  salesController.deleteSale
);

// 🔥 PUBLIC RECEIPT (NO AUTH — GROWTH ENGINE)
router.get(
  "/public/:id",
  salesController.getPublicSale
);

// 🔥 RESTORE SALE (OWNER ONLY)
router.post(
  "/:id/restore",
  protect,
  salesController.restoreSale
);

// 🔥 GET DELETED SALES (OWNER ONLY)
router.get(
  "/archive",
  protect,
  salesController.getDeletedSales
);

// 🔥 GET SINGLE SALE (PRIVATE)
router.get(
  "/:id",
  protect,
  checkPermission("canViewSales"),
  salesController.getSaleById
);

router.patch(
  "/:id/status",
  protect,
  checkPermission("canManagePayments"),
  salesController.updateSaleStatus
);

router.patch(
  "/:id/payment",
  protect,
  salesController.updatePaymentMethod
);

export default router;