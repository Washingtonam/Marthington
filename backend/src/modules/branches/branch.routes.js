import express from "express";
import protect from "../../middlewares/auth.middleware.js";
import checkPermission from "../../middlewares/permission.middleware.js";
import branchController from "./branch.controller.js";

const router = express.Router();

router.get(
  "/",
  protect,
  checkPermission("canViewBranches"),
  branchController.getBranches
);
router.post(
  "/",
  protect,
  checkPermission("canManageBranches"),
  branchController.createBranch
);
router.put(
  "/:id",
  protect,
  checkPermission("canManageBranches"),
  branchController.updateBranch
);
router.delete(
  "/:id",
  protect,
  checkPermission("canManageBranches"),
  branchController.deleteBranch
);

export default router;
