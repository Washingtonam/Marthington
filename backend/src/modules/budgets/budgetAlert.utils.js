import CategoryBudget from "./categoryBudget.model.js";
import BudgetAlert from "./budgetAlert.model.js";
import User from "../users/user.model.js";
import { getCategorySpendingStatus } from "./categoryBudget.utils.js";

/**
 * Check if budget alert should be triggered for a category
 * Returns { shouldAlert, alertType, threshold, percentUsed } or null
 */
export const checkBudgetAlertTrigger = async (businessId, category, year, month) => {
  try {
    const budget = await CategoryBudget.findOne({
      business: businessId,
      category,
      isActive: true
    });

    if (!budget) return null;

    const status = await getCategorySpendingStatus(businessId, category, year, month);
    if (!status) return null;

    // Check if alert already sent for this month
    const existingAlert = await BudgetAlert.findOne({
      business: businessId,
      category,
      month,
      year
    });

    if (existingAlert) {
      // Alert already sent this month
      return null;
    }

    // Determine alert type
    let alertType = null;
    let triggerThreshold = null;

    if (status.isOver) {
      // Budget exceeded
      alertType = "budget_exceeded";
      triggerThreshold = 100;
    } else if (status.shouldAlert && status.percentUsed >= budget.alertThresholdPercent) {
      // Threshold reached
      alertType = "threshold_reached";
      triggerThreshold = budget.alertThresholdPercent;
    }

    if (alertType) {
      return {
        shouldAlert: true,
        alertType,
        threshold: triggerThreshold,
        percentUsed: status.percentUsed,
        budgeted: budget.monthlyBudget,
        spent: status.spent
      };
    }

    return null;
  } catch (error) {
    console.error("Error checking budget alert trigger:", error);
    return null;
  }
};

/**
 * Create and send budget alert
 */
export const createAndSendBudgetAlert = async (
  businessId,
  category,
  year,
  month,
  alertInfo,
  alertedUsers = []
) => {
  try {
    // Create alert record
    const budgetAlert = new BudgetAlert({
      business: businessId,
      category,
      month,
      year,
      alertType: alertInfo.alertType,
      threshold: alertInfo.threshold,
      budgeted: alertInfo.budgeted,
      spent: alertInfo.spent,
      percentUsed: alertInfo.percentUsed,
      alertedTo: alertedUsers
    });

    const savedAlert = await budgetAlert.save();

    // TODO: Send email notification to alertedUsers
    // sendBudgetAlertEmail(alertedUsers, budgetAlert);

    return savedAlert;
  } catch (error) {
    console.error("Error creating budget alert:", error);
    throw error;
  }
};

/**
 * Get pending budget alerts for a business
 */
export const getPendingBudgetAlerts = async (businessId) => {
  try {
    const alerts = await BudgetAlert.find({
      business: businessId,
      isAcknowledged: false
    })
      .populate("alertedTo", "email name")
      .populate("acknowledgedBy", "email name")
      .sort({ sentAt: -1 });

    return alerts;
  } catch (error) {
    console.error("Error getting pending budget alerts:", error);
    return [];
  }
};

/**
 * Acknowledge a budget alert
 */
export const acknowledgeBudgetAlert = async (alertId, userId) => {
  try {
    const alert = await BudgetAlert.findByIdAndUpdate(
      alertId,
      {
        isAcknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date()
      },
      { new: true }
    );

    return alert;
  } catch (error) {
    console.error("Error acknowledging budget alert:", error);
    throw error;
  }
};

/**
 * Get alert history for a category
 */
export const getCategoryAlertHistory = async (businessId, category, months = 3) => {
  try {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - months, 1);

    const alerts = await BudgetAlert.find({
      business: businessId,
      category,
      sentAt: { $gte: threeMonthsAgo }
    })
      .populate("alertedTo", "email name")
      .populate("acknowledgedBy", "email name")
      .sort({ sentAt: -1 });

    return alerts;
  } catch (error) {
    console.error("Error getting category alert history:", error);
    return [];
  }
};

/**
 * Get managers/admins to alert (users with sufficient permissions)
 */
export const getAlertRecipients = async (businessId) => {
  try {
    const recipients = await User.find({
      business: businessId,
      role: { $in: ["manager", "super_admin", "owner"] },
      isActive: true
    }).select("_id email name");

    return recipients;
  } catch (error) {
    console.error("Error getting alert recipients:", error);
    return [];
  }
};
