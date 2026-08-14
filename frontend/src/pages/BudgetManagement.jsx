import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import request from "../api/request";
import { formatCurrency } from "../utils/formatCurrency";

const BudgetManagement = () => {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    monthlyBudget: 0,
    alertThresholdPercent: 80
  });
  const [showInitialize, setShowInitialize] = useState(false);

  const categories = [
    "inventory",
    "logistics",
    "utilities",
    "salaries",
    "rent",
    "marketing",
    "miscellaneous"
  ];

  useEffect(() => {
    loadBudgetData();
  }, []);

  const loadBudgetData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [budgetsRes, overviewRes] = await Promise.all([
        request.get("/api/category-budgets"),
        request.get("/api/category-budgets/overview/monthly")
      ]);

      setBudgets(budgetsRes || []);
      setOverview(overviewRes || null);
    } catch (err) {
      console.error("Error loading budgets:", err);
      setError(err.message || "Failed to load budgets");
    } finally {
      setLoading(false);
    }
  };

  const handleEditCategory = (category) => {
    const budget = budgets.find(b => b.category === category);
    if (budget) {
      setEditingCategory(category);
      setFormData({
        monthlyBudget: budget.monthlyBudget,
        alertThresholdPercent: budget.alertThresholdPercent
      });
    } else {
      setEditingCategory(category);
      setFormData({
        monthlyBudget: 0,
        alertThresholdPercent: 80
      });
    }
  };

  const handleSaveBudget = async () => {
    try {
      setError(null);
      await request.put(`/api/category-budgets/category/${editingCategory}`, {
        monthlyBudget: parseFloat(formData.monthlyBudget),
        alertThresholdPercent: parseFloat(formData.alertThresholdPercent)
      });
      
      setEditingCategory(null);
      setFormData({ monthlyBudget: 0, alertThresholdPercent: 80 });
      await loadBudgetData();
    } catch (err) {
      console.error("Error saving budget:", err);
      setError(err.message || "Failed to save budget");
    }
  };

  const handleDeleteBudget = async (category) => {
    if (!window.confirm(`Delete budget for ${category}?`)) return;

    try {
      setError(null);
      await request.delete(`/api/category-budgets/category/${category}`);
      await loadBudgetData();
    } catch (err) {
      console.error("Error deleting budget:", err);
      setError(err.message || "Failed to delete budget");
    }
  };

  const handleInitializeDefaults = async () => {
    try {
      setError(null);
      await request.post("/api/category-budgets/initialize/defaults", {});
      setShowInitialize(false);
      await loadBudgetData();
    } catch (err) {
      console.error("Error initializing defaults:", err);
      setError(err.message || "Failed to initialize defaults");
    }
  };

  const getCategoryStatus = (category) => {
    if (!overview) return null;
    return overview.categories?.find(c => c.category === category);
  };

  const getStatusColor = (status) => {
    if (!status) return "text-gray-500";
    if (status.isOver) return "text-red-600 dark:text-red-400";
    if (status.shouldAlert) return "text-amber-600 dark:text-amber-400";
    return "text-green-600 dark:text-green-400";
  };

  const getProgressColor = (percentUsed) => {
    if (percentUsed >= 100) return "bg-red-500";
    if (percentUsed >= 80) return "bg-amber-500";
    return "bg-green-500";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading budgets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Budget Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Configure monthly expense budgets by category and set alert thresholds
            </p>
          </div>
          <button
            onClick={() => setShowInitialize(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            Initialize Defaults
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Monthly Summary */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Budgeted</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(overview.summary?.totalBudgeted || 0)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Spent</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(overview.summary?.totalSpent || 0)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Remaining</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(overview.summary?.totalRemaining || 0)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">% Used</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {(overview.summary?.percentUsed || 0).toFixed(1)}%
              </p>
            </div>
          </div>
        )}

        {/* Budget Grid */}
        <div className="space-y-4">
          {categories.map((category) => {
            const budget = budgets.find(b => b.category === category);
            const status = getCategoryStatus(category);

            return (
              <div
                key={category}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
              >
                {editingCategory === category ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                        {category}
                      </h3>
                      <button
                        onClick={() => setEditingCategory(null)}
                        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xl"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Monthly Budget
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={formData.monthlyBudget}
                          onChange={(e) => setFormData({ ...formData, monthlyBudget: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Alert Threshold (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="5"
                          value={formData.alertThresholdPercent}
                          onChange={(e) => setFormData({ ...formData, alertThresholdPercent: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleSaveBudget}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingCategory(null)}
                        className="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg font-medium transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // Display Mode
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                        {category}
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditCategory(category)}
                          className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition text-sm font-medium"
                        >
                          Edit
                        </button>
                        {budget && (
                          <button
                            onClick={() => handleDeleteBudget(category)}
                            className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 transition text-sm font-medium"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {budget ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Budget</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(budget.monthlyBudget)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Spent</p>
                            <p className={`font-semibold ${getStatusColor(status)}`}>
                              {formatCurrency(status?.spent || 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Remaining</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(status?.remaining || 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">% Used</p>
                            <p className={`font-semibold ${getStatusColor(status)}`}>
                              {status?.percentUsed.toFixed(1) || 0}%
                            </p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600 dark:text-gray-400">
                              Alert at {budget.alertThresholdPercent}%
                            </span>
                            {status?.shouldAlert && (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                ⚠️ Alert
                              </span>
                            )}
                            {status?.isOver && (
                              <span className="text-red-600 dark:text-red-400 font-semibold">
                                🔴 Over Budget
                              </span>
                            )}
                          </div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${getProgressColor(
                                status?.percentUsed || 0
                              )}`}
                              style={{
                                width: `${Math.min(status?.percentUsed || 0, 100)}%`
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-400">
                        <p>No budget configured for this category</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Initialize Defaults Modal */}
      {showInitialize && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Initialize Default Budgets
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This will create sensible default monthly budgets for all expense categories. 
              You can adjust these values afterwards.
            </p>
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4 mb-6 text-sm space-y-1 text-gray-700 dark:text-gray-300">
              <p>• Inventory: 5,000,000</p>
              <p>• Logistics: 1,000,000</p>
              <p>• Salaries: 10,000,000</p>
              <p>• Utilities: 500,000</p>
              <p>• Rent: 2,000,000</p>
              <p>• Marketing: 1,000,000</p>
              <p>• Miscellaneous: 500,000</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleInitializeDefaults}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
              >
                Initialize
              </button>
              <button
                onClick={() => setShowInitialize(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg font-medium transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetManagement;
