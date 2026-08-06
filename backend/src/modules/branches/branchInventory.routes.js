import express from "express";
import protect from "../../middlewares/auth.middleware.js";
import checkPermission from "../../middlewares/permission.middleware.js";
import branchInventoryController from "./branchInventory.controller.js";

const router = express.Router();

router.get(
  "/",
  protect,
  checkPermission("canViewProducts"),
  branchInventoryController.getBranchInventory
);

router.post(
  "/import",
  protect,
  checkPermission("canManageProducts"),
  branchInventoryController.importProductToBranch
);

router.get(
  "/import/:id",
  protect,
  checkPermission("canManageProducts"),
  branchInventoryController.getImportStatus
);

router.put(
  "/",
  protect,
  checkPermission("canManageProducts"),
  branchInventoryController.updateBranchInventory
);

export default router;
