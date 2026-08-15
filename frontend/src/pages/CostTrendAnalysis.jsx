import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import request from "../api/client.js";
import { formatCurrency } from "../utils/formatters.js";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const CostTrendAnalysis = () => {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState("6months");
  const [selectedCategories, setSelectedCategories] = useState(["inventory", "logistics", "salaries"]);
  const [trendData, setTrendData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const categories = ["inventory", "logistics", "utilities", "salaries", "rent", "marketing", "miscellaneous"];

  const colors = {
    inventory: "#3b82f6",
    logistics: "#10b981",
    utilities: "#f59e0b",
    salaries: "#ef4444",
    rent: "#8b5cf6",
    marketing: "#ec4899",
    miscellaneous: "#6b7280",
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

      const categoryBreakdown = Array.isArray(res.categoryBreakdown) ? res.categoryBreakdown : [];
      const monthlyData = (res.trend || []).map((item) => {
        const monthRow = { month: item.month };
        categoryBreakdown.forEach((cat) => {
          monthRow[cat.category] = Number(cat.total || 0);
        });
        return monthRow;
      });

      const stats = {};
      categories.forEach((cat) => {
        const amounts = monthlyData.map((m) => Number(m[cat] || 0));
        const avg = amounts.length ? amounts.reduce((sum, val) => sum + val, 0) / amounts.length : 0;
        const lastMonth = amounts[amounts.length - 1] || 0;
        const prevMonth = amounts[amounts.length - 2] || lastMonth;
        const monthOverMonth = prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth) * 100 : 0;
        const anomalies = amounts.filter((value) => value > avg * 2).length;

        stats[cat] = {
          average: avg,
          lastMonth,
          prevMonth,
          monthOverMonth,
          anomalies,
          stdDev: 0,
        };
      });

      const totalSpent = monthlyData.reduce((sum, monthRow) => {
        return sum + categories.reduce((catSum, cat) => catSum + Number(monthRow[cat] || 0), 0);
      }, 0);

      setTrendData({
        monthlyData,
        stats,
        categoryComparison: categories.map((cat) => ({
          category: cat,
          total: stats[cat].lastMonth,
          average: stats[cat].average,
          variance: stats[cat].monthOverMonth,
          anomalies: stats[cat].anomalies,
        })),
        totalSpent,
        averageMonthly: months > 0 ? totalSpent / months : 0,
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
      setSelectedCategories(selectedCategories.filter((c) => c !== category));
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
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading trends...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Cost Trend Analysis</h1>
          <p className="text-gray-600 dark:text-gray-400">Track expense trends, identify anomalies, and analyze category spending patterns</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Time Range</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="3months">Last 3 Months</option>
                <option value="6months">Last 6 Months</option>
                <option value="12months">Last 12 Months</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Categories to Display</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryToggle(cat)}
                  className={`rounded-lg px-3 py-1 text-sm font-medium transition ${
                    selectedCategories.includes(cat)
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {trendData && (
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
              <p className="mb-1 text-sm text-gray-600 dark:text-gray-400">Total Spent</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(trendData.totalSpent)}</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
              <p className="mb-1 text-sm text-gray-600 dark:text-gray-400">Monthly Average</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(trendData.averageMonthly)}</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
              <p className="mb-1 text-sm text-gray-600 dark:text-gray-400">Anomalies Detected</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {Object.values(trendData.stats).reduce((sum, s) => sum + s.anomalies, 0)}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {trendData && (
            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
              <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Monthly Spending Trend</h2>
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
                    contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
                  />
                  <Legend />
                  {selectedCategories.map((cat) => (
                    <Area
                      key={cat}
                      type="monotone"
                      dataKey={cat}
                      stackId="1"
                      stroke={colors[cat]}
                      fill={`url(#color${cat})`}
                      name={cat}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {trendData && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Category Totals</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={trendData.categoryComparison.filter((c) => selectedCategories.includes(c.category))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
                    />
                    <Bar dataKey="total" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Month-Over-Month Change</h2>
                <div className="space-y-3">
                  {trendData.categoryComparison
                    .filter((c) => selectedCategories.includes(c.category))
                    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
                    .map((cat) => (
                      <div key={cat.category}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="capitalize font-medium text-gray-900 dark:text-white">{cat.category}</span>
                          <span className={`${getVarianceColor(cat.variance)} font-semibold`}>
                            {cat.variance > 0 ? "+" : ""}
                            {cat.variance.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded bg-gray-200 dark:bg-gray-700">
                          <div
                            className={`h-full ${getVarianceBadge(cat.variance)}`}
                            style={{ width: `${Math.min(Math.abs(cat.variance) * 2, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {trendData && (
            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
              <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Category Statistics</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">Category</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white">Average</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white">Std Dev</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white">MoM Change</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white">Anomalies</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(trendData.stats)
                      .filter(([cat]) => selectedCategories.includes(cat))
                      .map(([category, stat]) => (
                        <tr key={category} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="px-3 py-3 capitalize font-medium text-gray-900 dark:text-white">{category}</td>
                          <td className="px-3 py-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(stat.average)}</td>
                          <td className="px-3 py-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(stat.stdDev)}</td>
                          <td className={`px-3 py-3 text-right font-semibold ${getVarianceColor(stat.monthOverMonth)}`}>
                            {stat.monthOverMonth > 0 ? "+" : ""}
                            {stat.monthOverMonth.toFixed(1)}%
                          </td>
                          <td className="px-3 py-3 text-right">
                            {stat.anomalies > 0 ? (
                              <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
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
