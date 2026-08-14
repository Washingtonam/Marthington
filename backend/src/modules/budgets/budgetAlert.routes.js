import express from "express";
import protect from "../../middlewares/auth.middleware.js";
import budgetAlertController from "./budgetAlert.controller.js";

const router = express.Router();

// Get pending alerts for user's business
router.get("/pending", protect, budgetAlertController.getPendingAlerts);

// Get alerts for specific month
router.get("/month", protect, budgetAlertController.getMonthAlerts);

// Get alert history for specific category
router.get("/history/:category", protect, budgetAlertController.getAlertHistory);

// Acknowledge an alert
router.put("/:alertId/acknowledge", protect, budgetAlertController.acknowledgeAlert);

export default router;
