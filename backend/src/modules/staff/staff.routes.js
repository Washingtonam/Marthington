import express from "express";

import protect from "../../middlewares/auth.middleware.js";
import checkPermission from "../../middlewares/permission.middleware.js";

import staffController from "./staff.controller.js";

const router = express.Router();

router.get(
  "/",
  protect,
  checkPermission("canManageStaff"),
  staffController.getStaff
);

router.post(
  "/",
  protect,
  checkPermission("canInviteStaff"),
  staffController.createStaff
);

router.put(
  "/:id",
  protect,
  checkPermission("canEditStaffPermissions"),
  staffController.updateStaff
);

router.delete(
  "/:id",
  protect,
  checkPermission("canDeactivateStaff"),
  staffController.deleteStaff
);

export default router;