import express from "express";
import checkPermission from "../../middlewares/permission.middleware.js";
import protect from "../../middlewares/auth.middleware.js";

import reportsController from "./reports.controller.js";

const router = express.Router();

router.get(
  "/",
  protect,
  checkPermission("canViewReports"),
  reportsController.getReports
);

router.get(
  "/overview",
  protect,
  checkPermission("canViewReports"),
  reportsController.getOverviewReport
);

router.get(
  "/sales",
  protect,
  checkPermission("canViewReports"),
  reportsController.getSalesReport
);

router.get(
  "/staff",
  protect,
  checkPermission("canViewReports"),
  reportsController.getStaffReport
);

router.get(
  "/inventory",
  protect,
  checkPermission("canViewReports"),
  reportsController.getInventoryReport
);

router.get(
  "/financial",
  protect,
  checkPermission("canViewReports"),
  reportsController.getFinancialReport
);

export default router;