import express from "express";
import protect from "../../middlewares/auth.middleware.js";
import checkPermission from "../../middlewares/permission.middleware.js";
import transferController from "./branchTransfer.controller.js";

const router = express.Router();

router.post("/", protect, checkPermission("canManageBranchInventory"), transferController.requestTransfer);
router.get("/", protect, checkPermission("canViewBranchInventory"), transferController.listTransfers);
router.post("/:id/review", protect, checkPermission("canManageAllBranchInventory"), transferController.reviewTransfer);

export default router;