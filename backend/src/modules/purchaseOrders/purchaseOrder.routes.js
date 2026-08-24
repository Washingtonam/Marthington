import express from "express";
import protect from "../../middlewares/auth.middleware.js";
import checkPermission from "../../middlewares/permission.middleware.js";
import purchaseOrderController from "./purchaseOrder.controller.js";

const router = express.Router();

router.get("/", protect, checkPermission("canViewPurchaseOrders"), purchaseOrderController.getPurchaseOrders);
router.post("/", protect, checkPermission("canManagePurchaseOrders"), purchaseOrderController.createPurchaseOrder);
router.put("/:id", protect, checkPermission("canManagePurchaseOrders"), purchaseOrderController.updatePurchaseOrder);

// PHASE 1: New endpoints for receipt & supplier ledger
router.post("/:id/record-receipt", protect, checkPermission("canReceiveInventory"), purchaseOrderController.recordReceipt);
router.get("/supplier/:supplierId/ledger", protect, checkPermission("canViewPurchaseOrders"), purchaseOrderController.getSupplierLedger);

export default router;
