import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import request from "../api/client.js";
import { formatCurrency } from "../utils/formatters.js";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const SupplierPerformance = () => {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierMetrics, setSupplierMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("totalSpent");

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    if (selectedSupplier) {
      loadSupplierMetrics();
    }
  }, [selectedSupplier]);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await request("/suppliers/performance/summary");
      setSuppliers(res || []);

      if (res && res.length > 0 && !selectedSupplier) {
        setSelectedSupplier(res[0]);
      }
    } catch (err) {
      console.error("Error loading suppliers:", err);
      setError(err.message || "Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  const loadSupplierMetrics = async () => {
    if (!selectedSupplier?._id) return;

    try {
      setMetricsLoading(true);
      const res = await request(`/suppliers/${selectedSupplier._id}/metrics`);
      setSupplierMetrics(res);
    } catch (err) {
      console.error("Error loading supplier metrics:", err);
      setError(err.message || "Failed to load supplier metrics");
    } finally {
      setMetricsLoading(false);
    }
  };

  const getPerformanceBadge = (score) => {
    if (score >= 90) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (score >= 75) return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  };

  const filteredSuppliers = suppliers
    .filter((s) => {
      const name = s.name || "";
      const email = s.email || "";
      return name.toLowerCase().includes(searchTerm.toLowerCase()) || email.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "totalSpent":
          return (b.totalSpent || 0) - (a.totalSpent || 0);
        case "totalOrders":
          return (b.totalOrders || 0) - (a.totalOrders || 0);
        case "paymentSuccessRate":
          return (b.paymentSuccessRate || 0) - (a.paymentSuccessRate || 0);
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading suppliers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Supplier Performance</h1>
          <p className="text-gray-600 dark:text-gray-400">Track supplier metrics, purchase history, and performance scores</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="rounded-lg bg-white shadow dark:bg-gray-800">
              <div className="border-b border-gray-200 p-4 dark:border-gray-700">
                <input
                  type="text"
                  placeholder="Search suppliers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="border-b border-gray-200 p-4 dark:border-gray-700">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="totalSpent">Sort by Total Spent</option>
                  <option value="totalOrders">Sort by Orders</option>
                  <option value="paymentSuccessRate">Sort by Payment Rate</option>
                </select>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {filteredSuppliers.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">No suppliers found</div>
                ) : (
                  filteredSuppliers.map((supplier) => (
                    <button
                      key={supplier._id}
                      onClick={() => setSelectedSupplier(supplier)}
                      className={`w-full border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 ${
                        selectedSupplier?._id === supplier._id
                          ? "border-l-4 border-l-blue-600 bg-blue-50 dark:bg-blue-900/30"
                          : ""
                      }`}
                    >
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{supplier.name}</h4>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Orders: {supplier.totalOrders || 0}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Spent: {formatCurrency(supplier.totalSpent || 0)}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {selectedSupplier && supplierMetrics && !metricsLoading && (
            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {supplierMetrics.supplier?.name || selectedSupplier.name}
                  </h2>
                  <div className={`rounded-lg px-4 py-2 text-center ${getPerformanceBadge(supplierMetrics.metrics?.performanceScore || 0)}`}>
                    <div className="text-3xl font-bold">{supplierMetrics.metrics?.performanceScore || 0}</div>
                    <div className="text-xs font-semibold">Performance Score</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Orders</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{supplierMetrics.metrics?.totalOrders || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Spent</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(supplierMetrics.metrics?.totalSpent || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Avg Order Value</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(supplierMetrics.metrics?.averageOrderValue || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Outstanding Balance</p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(supplierMetrics.metrics?.outstandingBalance || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Payment Success Rate</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{supplierMetrics.metrics?.paymentSuccessRate || 0}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">On-Time Delivery Rate</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{supplierMetrics.metrics?.onTimeDeliveryRate || 0}%</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Monthly Purchase Trend</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={supplierMetrics.monthlyTrendData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }} />
                    <Legend />
                    <Line type="monotone" dataKey="purchases" stroke="#3b82f6" name="Purchase Amount" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Payment Status Distribution</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={supplierMetrics.paymentStatusDistribution || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {(supplierMetrics.paymentStatusDistribution || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || "#3b82f6"} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {metricsLoading && (
            <div className="lg:col-span-2">
              <div className="rounded-lg bg-white p-6 text-center shadow dark:bg-gray-800">
                <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading metrics...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupplierPerformance;
