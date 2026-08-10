import express from "express";
import protect from "../../middlewares/auth.middleware.js";
import {
  createStaff,
  getStaff,
  updateStaff,
  toggleStaffStatus
} from "./users.controller.js";

const router = express.Router();

router.get("/", protect, checkPermission("canManageStaff"), getStaff);
router.post("/staff", protect, checkPermission("canInviteStaff"), createStaff);
router.put("/:id", protect, checkPermission("canEditStaffPermissions"), updateStaff);
router.patch("/:id/status", protect, checkPermission("canDeactivateStaff"), toggleStaffStatus);

export default router;