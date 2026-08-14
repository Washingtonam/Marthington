import express from "express";
import protect from "../../middlewares/auth.middleware.js";
import purchaseOrderController from "./purchaseOrder.controller.js";

const router = express.Router();

router.get("/", protect, purchaseOrderController.getPurchaseOrders);
router.post("/", protect, purchaseOrderController.createPurchaseOrder);
router.put("/:id", protect, purchaseOrderController.updatePurchaseOrder);

// PHASE 1: New endpoints for receipt & supplier ledger
router.post("/:id/record-receipt", protect, purchaseOrderController.recordReceipt);
router.get("/supplier/:supplierId/ledger", protect, purchaseOrderController.getSupplierLedger);

export default router;
