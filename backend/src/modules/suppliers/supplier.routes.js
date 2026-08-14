import express from "express";
import protect from "../../middlewares/auth.middleware.js";
import supplierController from "./supplier.controller.js";

const router = express.Router();

router.get("/", protect, supplierController.getSuppliers);
router.post("/", protect, supplierController.createSupplier);
router.get("/performance/summary", protect, supplierController.getSupplierPerformanceSummary);
router.get("/:id", protect, supplierController.getSupplierById);
router.get("/:id/metrics", protect, supplierController.getSupplierMetrics);
router.put("/:id", protect, supplierController.updateSupplier);
router.delete("/:id", protect, supplierController.deleteSupplier);

export default router;
