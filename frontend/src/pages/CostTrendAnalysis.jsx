import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import request from "../api/client.js";
import { formatCurrency } from "../utils/formatCurrency.js";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const CostTrendAnalysis = () => {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState("6months");
  const [selectedCategories, setSelectedCategories] = useState([
    "inventory", "logistics", "salaries"
  ]);
  const [trendData, setTrendData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const categories = [
    "inventory", "logistics", "utilities", "salaries", "rent", "marketing", "miscellaneous"
  ];

  const colors = {
    inventory: "#3b82f6",
    logistics: "#10b981",
    utilities: "#f59e0b",
    salaries: "#ef4444",
    rent: "#8b5cf6",
    marketing: "#ec4899",
    miscellaneous: "#6b7280"
  };

  useEffect(() => {
    loadTrendData();
  }, [timeRange]);

  const loadTrendData = async () => {
    try {
      setLoading(true);
      setError(null);

      const months = timeRange === "3months" ? 3 : timeRange === "6months" ? 6 : 12;
      const res = await request(`/expenses/trends/analysis?months=${months}`);

      if (!res || !res.trend) {
        throw new Error("Invalid trend data returned");
      }

      // Transform backend data to match chart structure
      const monthlyData = res.trend.map(item => {
        const monthObj = { month: item.month };
        
        // Add category breakdowns if available
        if (res.categoryBreakdown) {
          res.categoryBreakdown.forEach(cat => {
            monthObj[cat.category] = cat.total || 0;
          });
        }
        
        return monthObj;
      });

      // Calculate statistics per category
      const stats = {};
      categories.forEach(cat => {
        const categoryExpenses = res.categoryBreakdown?.find(c => c.category === cat);
        const amounts = monthlyData.map(m => m[cat] || 0);
        const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const lastMonth = amounts[amounts.length - 1] || 0;
        const prevMonth = amounts[amounts.length - 2] || lastMonth;
        const monthOverMonth = prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth) * 100 : 0;

        stats[cat] = {
          average: avg,
          lastMonth,
          prevMonth,
          monthOverMonth,
          anomalies: amounts.filter(v => v > avg * 2).length
        };
      });

      const totalSpent = monthlyData.reduce((sum, m) => {
        return sum + categories.reduce((catSum, cat) => catSum + (m[cat] || 0), 0);
      }, 0);

      setTrendData({
        monthlyData,
        stats,
        categoryComparison: categories.map(cat => ({
          category: cat,
          total: stats[cat].lastMonth,
          average: stats[cat].average,
          variance: stats[cat].monthOverMonth,
          anomalies: stats[cat].anomalies
        })),
        totalSpent,
        averageMonthly: totalSpent / months
      });
    } catch (err) {
      console.error("Error loading trend data:", err);
      setError(err.message || "Failed to load trend data");
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryToggle = (category) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  const getVarianceBadge = (variance) => {
    if (variance > 10) return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
    if (variance > 5) return "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300";
    if (variance < -5) return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
    return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading trends...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Cost Trend Analysis
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track expense trends, identify anomalies, and analyze category spending patterns
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Time Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Time Range
              </label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="3months">Last 3 Months</option>
                <option value="6months">Last 6 Months</option>
                <option value="12months">Last 12 Months</option>
              </select>
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Categories to Display
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryToggle(cat)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                    selectedCategories.includes(cat)
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {trendData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Total Spent
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(trendData.totalSpent)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Monthly Average
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(trendData.averageMonthly)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Anomalies Detected
              </p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {Object.values(trendData.stats).reduce((sum, s) => sum + s.anomalies, 0)}
              </p>
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="space-y-6">
          {/* Monthly Trend Chart */}
          {trendData && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Monthly Spending Trend
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trendData.monthlyData}>
                  <defs>
                    {selectedCategories.map((cat) => (
                      <linearGradient key={cat} id={`color${cat}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={colors[cat]} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={colors[cat]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px"
                    }}
                  />
                  <Legend />
                  {selectedCategories.map((cat) => (
                    <Area
                      key={cat}
                      type="monotone"
                      dataKey={cat}
                      stackId="1"
                      stroke={colors[cat]}
                      fill={colors[cat]}
                      fillOpacity={0.6}
                      name={cat}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Category Comparison */}
          {trendData && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Category Comparison
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Category
                      </th>
                      <th className="text-right py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Last Month
                      </th>
                      <th className="text-right py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Average
                      </th>
                      <th className="text-right py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Variance
                      </th>
                      <th className="text-right py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Anomalies
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {trendData.categoryComparison.map((cat) => (
                      <tr key={cat.category} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <div
                              className="w-3 h-3 rounded-full mr-2"
                              style={{ backgroundColor: colors[cat.category] }}
                            ></div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {cat.category}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm text-gray-900 dark:text-white">
                            {formatCurrency(cat.total)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {formatCurrency(cat.average)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`text-sm font-medium px-2 py-1 rounded ${getVarianceBadge(cat.variance)}`}>
                            {cat.variance > 0 ? "+" : ""}{cat.variance.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {cat.anomalies}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CostTrendAnalysis;

const CostTrendAnalysis = () => {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState("6months"); // 3months, 6months, 12months
  const [viewType, setViewType] = useState("category"); // category, time
  const [selectedCategories, setSelectedCategories] = useState([
    "inventory", "logistics", "salaries"
  ]);
  const [trendData, setTrendData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const categories = [
    "inventory", "logistics", "utilities", "salaries", "rent", "marketing", "miscellaneous"
  ];

  const colors = {
    inventory: "#3b82f6",
    logistics: "#10b981",
    utilities: "#f59e0b",
    salaries: "#ef4444",
    rent: "#8b5cf6",
    marketing: "#ec4899",
    miscellaneous: "#6b7280"
  };

  useEffect(() => {
    loadTrendData();
  }, [timeRange]);

  const loadTrendData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Generate mock trend data based on time range
      const months = timeRange === "3months" ? 3 : timeRange === "6months" ? 6 : 12;
      const monthlyData = [];
      const categoryTotals = {};

      for (let i = months - 1; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStr = date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

        const monthEntry = { month: monthStr };

        categories.forEach((cat) => {
          // Generate realistic expense data with some variance
          const baseAmount = {
            inventory: 450000,
            logistics: 120000,
            utilities: 35000,
            salaries: 800000,
            rent: 150000,
            marketing: 75000,
            miscellaneous: 45000
          }[cat];

          const variance = (Math.random() - 0.5) * (baseAmount * 0.2);
          const amount = Math.max(baseAmount + variance, baseAmount * 0.7);
          monthEntry[cat] = Math.round(amount);

          if (!categoryTotals[cat]) {
            categoryTotals[cat] = { total: 0, months: 0, variance: 0 };
          }
          categoryTotals[cat].total += amount;
          categoryTotals[cat].months += 1;
        });

        monthlyData.push(monthEntry);
      }

      // Calculate statistics
      const stats = {};
      Object.entries(categoryTotals).forEach(([cat, data]) => {
        const avg = data.total / data.months;
        const monthlyVariances = monthlyData.map(m => m[cat]);
        const variance = monthlyVariances.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / monthlyVariances.length;
        const stdDev = Math.sqrt(variance);
        const lastMonth = monthlyData[monthlyData.length - 1][cat];
        const prevMonth = monthlyData[monthlyData.length - 2]?.[cat] || lastMonth;
        const monthOverMonth = ((lastMonth - prevMonth) / prevMonth) * 100;

        stats[cat] = {
          average: avg,
          stdDev,
          lastMonth,
          prevMonth,
          monthOverMonth,
          anomalies: monthlyVariances.filter(v => v > avg + stdDev * 2).length
        };
      });

      // Category comparison data
      const categoryComparison = categories.map(cat => ({
        category: cat,
        total: categoryTotals[cat].total,
        average: stats[cat].average,
        variance: stats[cat].monthOverMonth,
        anomalies: stats[cat].anomalies
      }));

      setTrendData({
        monthlyData,
        stats,
        categoryComparison,
        totalSpent: categories.reduce((sum, cat) => sum + categoryTotals[cat].total, 0),
        averageMonthly: categories.reduce((sum, cat) => sum + categoryTotals[cat].total, 0) / months
      });
    } catch (err) {
      console.error("Error loading trend data:", err);
      setError(err.message || "Failed to load trend data");
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryToggle = (category) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  const getVarianceColor = (variance) => {
    if (variance > 10) return "text-red-600 dark:text-red-400";
    if (variance > 5) return "text-amber-600 dark:text-amber-400";
    if (variance < -5) return "text-green-600 dark:text-green-400";
    return "text-gray-600 dark:text-gray-400";
  };

  const getVarianceBadge = (variance) => {
    if (variance > 10) return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
    if (variance > 5) return "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300";
    if (variance < -5) return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
    return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading trends...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Cost Trend Analysis
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track expense trends, identify anomalies, and analyze category spending patterns
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Time Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Time Range
              </label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="3months">Last 3 Months</option>
                <option value="6months">Last 6 Months</option>
                <option value="12months">Last 12 Months</option>
              </select>
            </div>

            {/* View Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                View
              </label>
              <select
                value={viewType}
                onChange={(e) => setViewType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="category">By Category</option>
                <option value="time">Time Series</option>
              </select>
            </div>
          </div>

          {/* Category Selection */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Categories to Display
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryToggle(cat)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                    selectedCategories.includes(cat)
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {trendData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Total Spent
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(trendData.totalSpent)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Monthly Average
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(trendData.averageMonthly)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Anomalies Detected
              </p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {Object.values(trendData.stats).reduce((sum, s) => sum + s.anomalies, 0)}
              </p>
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="space-y-6">
          {/* Monthly Trend Chart */}
          {trendData && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Monthly Spending Trend
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trendData.monthlyData}>
                  <defs>
                    {selectedCategories.map((cat) => (
                      <linearGradient key={cat} id={`color${cat}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={colors[cat]} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={colors[cat]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px"
                    }}
                  />
                  <Legend />
                  {selectedCategories.map((cat) => (
                    <Area
                      key={cat}
                      type="monotone"
                      dataKey={cat}
                      stackId="1"
                      stroke={colors[cat]}
                      fillOpacity={1}
                      fill={`url(#color${cat})`}
                      name={cat}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Category Comparison */}
          {trendData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Totals */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Category Totals
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={trendData.categoryComparison.filter(c =>
                      selectedCategories.includes(c.category)
                    )}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px"
                      }}
                    />
                    <Bar dataKey="total" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Month-Over-Month Change */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Month-Over-Month Change
                </h2>
                <div className="space-y-3">
                  {trendData.categoryComparison
                    .filter(c => selectedCategories.includes(c.category))
                    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
                    .map((cat) => (
                      <div key={cat.category}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="capitalize font-medium text-gray-900 dark:text-white">
                            {cat.category}
                          </span>
                          <span className={`${getVarianceColor(cat.variance)} font-semibold`}>
                            {cat.variance > 0 ? "+" : ""}{cat.variance.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <div
                            className={`flex-1 h-2 rounded ${getVarianceBadge(
                              cat.variance
                            ).split(" ")[0]}`}
                            style={{
                              width: `${Math.min(Math.abs(cat.variance) * 2, 100)}%`
                            }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Detailed Statistics */}
          {trendData && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Category Statistics
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="text-left py-2 px-3 font-semibold text-gray-900 dark:text-white">
                        Category
                      </th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-900 dark:text-white">
                        Average
                      </th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-900 dark:text-white">
                        Std Dev
                      </th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-900 dark:text-white">
                        MoM Change
                      </th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-900 dark:text-white">
                        Anomalies
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(trendData.stats)
                      .filter(([cat]) => selectedCategories.includes(cat))
                      .map(([category, stat]) => (
                        <tr key={category} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="py-3 px-3 capitalize font-medium text-gray-900 dark:text-white">
                            {category}
                          </td>
                          <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">
                            {formatCurrency(stat.average)}
                          </td>
                          <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">
                            {formatCurrency(stat.stdDev)}
                          </td>
                          <td className={`py-3 px-3 text-right font-semibold ${getVarianceColor(
                            stat.monthOverMonth
                          )}`}>
                            {stat.monthOverMonth > 0 ? "+" : ""}
                            {stat.monthOverMonth.toFixed(1)}%
                          </td>
                          <td className="py-3 px-3 text-right">
                            {stat.anomalies > 0 ? (
                              <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2 py-1 rounded text-xs font-semibold">
                                {stat.anomalies}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CostTrendAnalysis;
