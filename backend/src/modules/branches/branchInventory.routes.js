import express from "express";
import protect from "../../middlewares/auth.middleware.js";
import checkPermission from "../../middlewares/permission.middleware.js";
import branchInventoryController from "./branchInventory.controller.js";

const router = express.Router();

router.get(
  "/",
  protect,
  checkPermission("canViewBranchInventory"),
  branchInventoryController.getBranchInventory
);

router.post(
  "/import",
  protect,
  checkPermission("canManageBranchInventory"),
  branchInventoryController.importProductToBranch
);

router.get(
  "/import/:id",
  protect,
  checkPermission("canManageBranchInventory"),
  branchInventoryController.getImportStatus
);

router.put(
  "/",
  protect,
  checkPermission("canManageBranchInventory"),
  branchInventoryController.updateBranchInventory
);

export default router;
