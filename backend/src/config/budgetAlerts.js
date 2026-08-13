/**
 * Budget Alert Configuration
 * Controls when and how budget alerts are triggered
 */

export const BUDGET_ALERT_CONFIG = {
  // Alert threshold - trigger alert when expenses exceed budget by this %
  ALERT_THRESHOLD_PERCENT: 5, // 5% over budget triggers alert
  
  // Budget overage levels for email subject urgency
  SEVERITY_LEVELS: {
    WARNING: {
      percent: 5,    // 5-10% over budget
      label: "warning",
      icon: "⚠️"
    },
    MODERATE: {
      percent: 10,   // 10-25% over budget
      label: "moderate",
      icon: "🔴"
    },
    CRITICAL: {
      percent: 25,   // 25%+ over budget
      label: "critical",
      icon: "🚨"
    }
  },

  // Email alert recipients by severity
  ALERT_RECIPIENTS: {
    WARNING: ["manager", "owner", "super_admin"],    // Managers and above
    MODERATE: ["owner", "super_admin"],               // Owners only
    CRITICAL: ["owner", "super_admin"]                // Owners only + escalate
  },

  // Categories that trigger immediate alerts (high priority)
  PRIORITY_CATEGORIES: [
    "salaries",      // Payroll overages need immediate attention
    "rent",          // Lease commitments are fixed
    "inventory"      // Major expense category
  ],

  // Minimum alert cooldown period (hours)
  // Prevents alert spam - don't send another alert for same category within N hours
  ALERT_COOLDOWN_HOURS: 24,

  // Maximum emails per business per day
  MAX_ALERTS_PER_DAY: 5,

  // Alert frequency settings
  FREQUENCY: {
    REAL_TIME: "immediate",      // Alert on expense creation if over budget
    DAILY_DIGEST: "daily",        // Daily summary at 8 AM
    WEEKLY_DIGEST: "weekly",      // Weekly summary on Fridays
    MANUAL: "manual"              // Only when requested
  }
};

/**
 * Get severity level based on variance percentage
 * @param {number} variancePercent - Percentage over budget (negative = over budget)
 * @returns {string} Severity level: "warning", "moderate", or "critical"
 */
export const getSeverityLevel = (variancePercent) => {
  const absVariance = Math.abs(variancePercent);
  
  if (absVariance >= 25) return "critical";
  if (absVariance >= 10) return "moderate";
  if (absVariance >= 5) return "warning";
  return null; // Not severe enough to alert
};

/**
 * Check if expense creates budget alert scenario
 * @param {number} budget - Budgeted amount
 * @param {number} actual - Actual spending
 * @returns {boolean} True if alert should be triggered
 */
export const shouldTriggerAlert = (budget, actual) => {
  if (!budget || budget <= 0) return false;
  
  const variance = actual - budget;
  const variancePercent = (variance / budget) * 100;
  
  return variancePercent >= BUDGET_ALERT_CONFIG.ALERT_THRESHOLD_PERCENT;
};

export default BUDGET_ALERT_CONFIG;
