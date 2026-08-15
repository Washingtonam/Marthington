import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import request from "../api/client.js";
import { formatCurrency } from "../utils/formatters.js";

const BudgetAlerts = () => {
  const { user } = useAuth();
  const [pendingAlerts, setPendingAlerts] = useState([]);
  const [monthAlerts, setMonthAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [tabActive, setTabActive] = useState("pending"); // pending or history

  useEffect(() => {
    loadAlerts();
  }, [selectedMonth, selectedYear]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);

      const [pendingRes, monthRes] = await Promise.all([
        request("/budget-alerts/pending"),
        request(`/budget-alerts/month?year=${selectedYear}&month=${selectedMonth}`)
      ]);

      setPendingAlerts(pendingRes || []);
      setMonthAlerts(monthRes || []);
    } catch (err) {
      console.error("Error loading alerts:", err);
      setError(err.message || "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alertId) => {
    try {
      setError(null);
      await request(`/budget-alerts/${alertId}/acknowledge`, {
        method: "PUT",
        body: JSON.stringify({})
      });
      await loadAlerts();
    } catch (err) {
      console.error("Error acknowledging alert:", err);
      setError(err.message || "Failed to acknowledge alert");
    }
  };

  const getAlertColor = (alertType) => {
    if (alertType === "budget_exceeded") {
      return "border-red-500 bg-red-50 dark:bg-red-900/20";
    }
    return "border-amber-500 bg-amber-50 dark:bg-amber-900/20";
  };

  const getAlertIcon = (alertType) => {
    if (alertType === "budget_exceeded") {
      return "🔴";
    }
    return "⚠️";
  };

  const getAlertTitle = (alertType) => {
    if (alertType === "budget_exceeded") {
      return "Budget Exceeded";
    }
    return "Alert Threshold Reached";
  };

  const formatMonth = (month, year) => {
    const date = new Date(year, month);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Budget Alerts
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor your category spending and budget alerts
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Pending Alerts
            </p>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">
              {pendingAlerts.length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              This Month
            </p>
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {monthAlerts.length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Budget Exceeded
            </p>
            <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {
                monthAlerts.filter((a) => a.alertType === "budget_exceeded")
                  .length
              }
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setTabActive("pending")}
            className={`px-4 py-3 font-medium transition ${
              tabActive === "pending"
                ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            Pending ({pendingAlerts.length})
          </button>
          <button
            onClick={() => setTabActive("history")}
            className={`px-4 py-3 font-medium transition ${
              tabActive === "history"
                ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            History
          </button>
        </div>

        {/* Pending Alerts Tab */}
        {tabActive === "pending" && (
          <div className="space-y-4">
            {pendingAlerts.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  ✓ No pending budget alerts
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  All your categories are within budget
                </p>
              </div>
            ) : (
              pendingAlerts.map((alert) => (
                <div
                  key={alert._id}
                  className={`border-l-4 rounded-lg p-4 ${getAlertColor(
                    alert.alertType
                  )}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-2xl">{getAlertIcon(alert.alertType)}</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white capitalize">
                          {alert.category} - {getAlertTitle(alert.alertType)}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {formatMonth(alert.month, alert.year)}
                        </p>

                        {/* Alert Details */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">
                              Budget
                            </p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(alert.budgeted)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">
                              Spent
                            </p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(alert.spent)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">
                              % Used
                            </p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {alert.percentUsed.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">
                              Threshold
                            </p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {alert.threshold}%
                            </p>
                          </div>
                        </div>

                        {/* Alert Recipients */}
                        {alert.alertedTo && alert.alertedTo.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                              Alerted To:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {alert.alertedTo.map((user) => (
                                <span
                                  key={user._id}
                                  className="text-xs bg-white dark:bg-gray-700 px-2 py-1 rounded"
                                >
                                  {user.name || user.email}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Acknowledge Button */}
                    <button
                      onClick={() => handleAcknowledge(alert._id)}
                      className="ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition whitespace-nowrap"
                    >
                      Acknowledge
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* History Tab */}
        {tabActive === "history" && (
          <div className="space-y-4">
            {/* Month Selector */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex gap-4">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {new Date(2024, i).toLocaleDateString("en-US", {
                      month: "long"
                    })}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const year = new Date().getFullYear() - i;
                  return (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* History Alerts */}
            {monthAlerts.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
                <p className="text-gray-600 dark:text-gray-400">
                  No alerts for {formatMonth(selectedMonth, selectedYear)}
                </p>
              </div>
            ) : (
              monthAlerts.map((alert) => (
                <div
                  key={alert._id}
                  className={`border-l-4 rounded-lg p-4 ${getAlertColor(
                    alert.alertType
                  )}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-2xl">{getAlertIcon(alert.alertType)}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white capitalize">
                            {alert.category} - {getAlertTitle(alert.alertType)}
                          </h3>
                          {alert.isAcknowledged && (
                            <span className="text-xs bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-300 px-2 py-1 rounded">
                              ✓ Acknowledged
                            </span>
                          )}
                        </div>

                        {/* Alert Details */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">
                              Budget
                            </p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(alert.budgeted)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">
                              Spent
                            </p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(alert.spent)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">
                              % Used
                            </p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {alert.percentUsed.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">
                              Date
                            </p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {new Date(alert.sentAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        {/* Acknowledgement Info */}
                        {alert.isAcknowledged && alert.acknowledgedBy && (
                          <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                            <p>
                              Acknowledged by{" "}
                              <span className="font-semibold">
                                {alert.acknowledgedBy.name || alert.acknowledgedBy.email}
                              </span>{" "}
                              on{" "}
                              <span className="font-semibold">
                                {new Date(alert.acknowledgedAt).toLocaleDateString()}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetAlerts;
