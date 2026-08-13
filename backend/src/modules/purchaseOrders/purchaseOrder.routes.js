import express from "express";
import protect from "../../middlewares/auth.middleware.js";
import purchaseOrderController from "./purchaseOrder.controller.js";

const router = express.Router();

router.get("/", protect, purchaseOrderController.getPurchaseOrders);
router.post("/", protect, purchaseOrderController.createPurchaseOrder);
router.put("/:id", protect, purchaseOrderController.updatePurchaseOrder);

export default router;
