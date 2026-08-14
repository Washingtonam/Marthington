import BudgetAlert from "./budgetAlert.model.js";
import {
  getPendingBudgetAlerts,
  acknowledgeBudgetAlert,
  getCategoryAlertHistory
} from "./budgetAlert.utils.js";

/**
 * Get pending budget alerts for the user's business
 */
export const getPendingAlerts = async (req, res) => {
  try {
    const { businessId } = req.user;

    if (!businessId) {
      return res.status(400).json({ message: "Business ID not found in user context" });
    }

    const alerts = await getPendingBudgetAlerts(businessId);

    res.status(200).json(alerts);
  } catch (error) {
    console.error("Error fetching pending alerts:", error);
    res.status(500).json({ message: error.message || "Failed to fetch alerts" });
  }
};

/**
 * Acknowledge a budget alert
 */
export const acknowledgeAlert = async (req, res) => {
  try {
    const { alertId } = req.params;
    const { userId } = req.user;

    if (!alertId) {
      return res.status(400).json({ message: "Alert ID is required" });
    }

    const alert = await acknowledgeBudgetAlert(alertId, userId);

    res.status(200).json({
      message: "Alert acknowledged",
      alert
    });
  } catch (error) {
    console.error("Error acknowledging alert:", error);
    res.status(500).json({ message: error.message || "Failed to acknowledge alert" });
  }
};

/**
 * Get alert history for a specific category
 */
export const getAlertHistory = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { category } = req.params;
    const { months = 3 } = req.query;

    if (!businessId) {
      return res.status(400).json({ message: "Business ID not found in user context" });
    }

    const alerts = await getCategoryAlertHistory(businessId, category, parseInt(months));

    res.status(200).json(alerts);
  } catch (error) {
    console.error("Error fetching alert history:", error);
    res.status(500).json({ message: error.message || "Failed to fetch alert history" });
  }
};

/**
 * Get all alerts for the month
 */
export const getMonthAlerts = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { year, month } = req.query;

    if (!businessId) {
      return res.status(400).json({ message: "Business ID not found in user context" });
    }

    const currentDate = new Date();
    const queryYear = year ? parseInt(year) : currentDate.getFullYear();
    const queryMonth = month ? parseInt(month) : currentDate.getMonth();

    const alerts = await BudgetAlert.find({
      business: businessId,
      year: queryYear,
      month: queryMonth
    })
      .populate("alertedTo", "email name")
      .populate("acknowledgedBy", "email name")
      .sort({ sentAt: -1 });

    res.status(200).json(alerts);
  } catch (error) {
    console.error("Error fetching month alerts:", error);
    res.status(500).json({ message: error.message || "Failed to fetch alerts" });
  }
};

export default {
  getPendingAlerts,
  acknowledgeAlert,
  getAlertHistory,
  getMonthAlerts
};
