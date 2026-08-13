import express from "express";
import protect from "../../middlewares/auth.middleware.js";
import supplierController from "./supplier.controller.js";

const router = express.Router();

router.get("/", protect, supplierController.getSuppliers);
router.post("/", protect, supplierController.createSupplier);
router.get("/:id", protect, supplierController.getSupplierById);
router.put("/:id", protect, supplierController.updateSupplier);
router.delete("/:id", protect, supplierController.deleteSupplier);

export default router;
