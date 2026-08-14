import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import request from "../api/client.js";
import { formatCurrency } from "../utils/formatCurrency.js";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const SupplierPerformance = () => {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierMetrics, setSupplierMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("totalSpent"); // totalSpent, totalOrders, paymentSuccessRate

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

  const getPerformanceColor = (score) => {
    if (score >= 90) return "text-green-600 dark:text-green-400";
    if (score >= 75) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getPerformanceBadge = (score) => {
    if (score >= 90) return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200";
    if (score >= 75) return "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200";
    return "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200";
  };

  const filteredSuppliers = suppliers
    .filter((s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "totalSpent":
          return b.totalSpent - a.totalSpent;
        case "totalOrders":
          return b.totalOrders - a.totalOrders;
        case "paymentSuccessRate":
          return b.paymentSuccessRate - a.paymentSuccessRate;
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading suppliers...</p>
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
            Supplier Performance
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track supplier metrics, purchase history, and performance scores
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Supplier List */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <input
                  type="text"
                  placeholder="Search suppliers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="totalSpent">Sort by Total Spent</option>
                  <option value="totalOrders">Sort by Orders</option>
                  <option value="paymentSuccessRate">Sort by Payment Rate</option>
                </select>
              </div>

              <div className="overflow-y-auto max-h-96">
                {filteredSuppliers.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                    No suppliers found
                  </div>
                ) : (
                  filteredSuppliers.map((supplier) => (
                    <button
                      key={supplier._id}
                      onClick={() => setSelectedSupplier(supplier)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition ${
                        selectedSupplier?._id === supplier._id
                          ? "bg-blue-50 dark:bg-blue-900/30 border-l-4 border-l-blue-600"
                          : ""
                      }`}
                    >
                      <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                        {supplier.name}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Orders: {supplier.totalOrders}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Spent: {formatCurrency(supplier.totalSpent)}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Metrics */}
          {selectedSupplier && supplierMetrics && !metricsLoading && (
            <div className="lg:col-span-2 space-y-6">
              {/* Performance Score Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {supplierMetrics.supplier.name}
                  </h2>
                  <div
                    className={`text-center px-4 py-2 rounded-lg ${getPerformanceBadge(
                      supplierMetrics.metrics.performanceScore
                    )}`}
                  >
                    <div className="text-3xl font-bold">
                      {supplierMetrics.metrics.performanceScore}
                    </div>
                    <div className="text-xs font-semibold">Performance Score</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Total Orders
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {supplierMetrics.metrics.totalOrders}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Total Spent
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(supplierMetrics.metrics.totalSpent)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Avg Order Value
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(supplierMetrics.metrics.averageOrderValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Outstanding Balance
                    </p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {formatCurrency(supplierMetrics.metrics.outstandingBalance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Payment Success Rate
                    </p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {supplierMetrics.metrics.paymentSuccessRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      On-Time Delivery Rate
                    </p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {supplierMetrics.metrics.onTimeDeliveryRate}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Monthly Trend Chart */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Monthly Purchase Trend
                </h2>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={supplierMetrics.monthlyTrendData}>
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
                    <Line type="monotone" dataKey="purchases" stroke="#3b82f6" name="Purchase Amount" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Payment Status Pie Chart */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Payment Status Distribution
                </h2>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={supplierMetrics.paymentStatusDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {supplierMetrics.paymentStatusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
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
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
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

const SupplierPerformance = () => {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierMetrics, setSupplierMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("totalPurchases"); // totalPurchases, averagePaymentTime, paymentSuccessRate

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

      const res = await request.get("/api/suppliers");
      const supplierList = res || [];

      // Enrich suppliers with basic metrics
      const enrichedSuppliers = supplierList.map((s) => ({
        ...s,
        totalPurchases: s.ledger?.totalPurchases || 0,
        totalSpent: s.ledger?.totalSpent || 0,
        averageOrderValue: s.ledger?.totalPurchases
          ? (s.ledger?.totalSpent || 0) / (s.ledger?.totalPurchases || 1)
          : 0,
        outstandingBalance: (s.ledger?.totalSpent || 0) - (s.ledger?.totalPaid || 0),
        paymentSuccessRate: s.ledger?.totalPurchases
          ? ((s.ledger?.successfulPayments || 0) / s.ledger?.totalPurchases) * 100
          : 0
      }));

      setSuppliers(enrichedSuppliers);

      if (enrichedSuppliers.length > 0 && !selectedSupplier) {
        setSelectedSupplier(enrichedSuppliers[0]);
      }
    } catch (err) {
      console.error("Error loading suppliers:", err);
      setError(err.message || "Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  const loadSupplierMetrics = async () => {
    // For now, we'll generate mock metrics based on supplier data
    // In a real scenario, this would come from the backend
    const metrics = {
      totalPurchases: selectedSupplier?.ledger?.totalPurchases || 0,
      totalSpent: selectedSupplier?.ledger?.totalSpent || 0,
      averagePaymentTime: 15, // days
      paymentSuccessRate: selectedSupplier?.paymentSuccessRate || 0,
      lastOrderDate: selectedSupplier?.ledger?.lastOrderDate
        ? new Date(selectedSupplier.ledger.lastOrderDate).toLocaleDateString()
        : "N/A",
      outstandingBalance:
        (selectedSupplier?.ledger?.totalSpent || 0) -
        (selectedSupplier?.ledger?.totalPaid || 0),
      averageOrderValue: selectedSupplier?.averageOrderValue || 0,
      priceIncreaseTrend: 2.5, // percent per month
      on_timeDeliveryRate: 92, // percent
      monthlyTrendData: [
        { month: "Jan", purchases: 45000, orders: 5 },
        { month: "Feb", purchases: 52000, orders: 6 },
        { month: "Mar", purchases: 48000, orders: 5 },
        { month: "Apr", purchases: 61000, orders: 7 },
        { month: "May", purchases: 55000, orders: 6 },
        { month: "Jun", purchases: 67000, orders: 8 }
      ],
      paymentStatusDistribution: [
        { name: "Paid", value: 80, color: "#10b981" },
        { name: "Pending", value: 15, color: "#f59e0b" },
        { name: "Overdue", value: 5, color: "#ef4444" }
      ],
      categorySpend: [
        { category: "Electronics", spend: 250000, percent: 35 },
        { category: "Logistics", spend: 180000, percent: 25 },
        { category: "Supplies", spend: 145000, percent: 20 },
        { category: "Services", spend: 125000, percent: 18 }
      ],
      performanceScore: calculatePerformanceScore({
        paymentRate: selectedSupplier?.paymentSuccessRate || 0,
        deliveryRate: 92,
        priceStability: 95
      })
    };

    setSupplierMetrics(metrics);
  };

  const calculatePerformanceScore = ({ paymentRate, deliveryRate, priceStability }) => {
    // Weighted average: 40% payment, 40% delivery, 20% price stability
    return Math.round(
      paymentRate * 0.4 + deliveryRate * 0.4 + priceStability * 0.2
    );
  };

  const getPerformanceColor = (score) => {
    if (score >= 90) return "text-green-600 dark:text-green-400";
    if (score >= 75) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getPerformanceBadge = (score) => {
    if (score >= 90) return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200";
    if (score >= 75) return "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200";
    return "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200";
  };

  const filteredSuppliers = suppliers
    .filter((s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "totalPurchases":
          return b.totalPurchases - a.totalPurchases;
        case "averagePaymentTime":
          return a.averageOrderValue - b.averageOrderValue;
        case "paymentSuccessRate":
          return b.paymentSuccessRate - a.paymentSuccessRate;
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading suppliers...</p>
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
            Supplier Performance
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track supplier metrics, purchase history, and performance scores
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Supplier List */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <input
                  type="text"
                  placeholder="Search suppliers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="totalPurchases">Sort by Total Purchases</option>
                  <option value="averagePaymentTime">Sort by Avg Order Value</option>
                  <option value="paymentSuccessRate">Sort by Payment Rate</option>
                </select>
              </div>

              <div className="overflow-y-auto max-h-96">
                {filteredSuppliers.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                    No suppliers found
                  </div>
                ) : (
                  filteredSuppliers.map((supplier) => (
                    <button
                      key={supplier._id}
                      onClick={() => setSelectedSupplier(supplier)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition ${
                        selectedSupplier?._id === supplier._id
                          ? "bg-blue-50 dark:bg-blue-900/30 border-l-4 border-l-blue-600"
                          : ""
                      }`}
                    >
                      <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                        {supplier.name}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Orders: {supplier.totalPurchases}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Spent: {formatCurrency(supplier.totalSpent)}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Metrics */}
          {selectedSupplier && supplierMetrics && (
            <div className="lg:col-span-2 space-y-6">
              {/* Performance Score Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedSupplier.name}
                  </h2>
                  <div
                    className={`text-center px-4 py-2 rounded-lg ${getPerformanceBadge(
                      supplierMetrics.performanceScore
                    )}`}
                  >
                    <div className="text-3xl font-bold">
                      {supplierMetrics.performanceScore}
                    </div>
                    <div className="text-xs font-semibold">Performance Score</div>
                  </div>
                </div>

                <grid className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Total Orders
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {supplierMetrics.totalPurchases}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Total Spent
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(supplierMetrics.totalSpent)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Avg Order Value
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(supplierMetrics.averageOrderValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Outstanding Balance
                    </p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {formatCurrency(supplierMetrics.outstandingBalance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Payment Success Rate
                    </p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {supplierMetrics.paymentSuccessRate.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      On-Time Delivery Rate
                    </p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {supplierMetrics.on_timeDeliveryRate}%
                    </p>
                  </div>
                </grid>
              </div>

              {/* Monthly Trend Chart */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  6-Month Purchase Trend
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={supplierMetrics.monthlyTrendData}>
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
                    <Line
                      type="monotone"
                      dataKey="purchases"
                      stroke="#3b82f6"
                      name="Purchase Amount"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Payment Status Distribution */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Payment Status
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={supplierMetrics.paymentStatusDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {supplierMetrics.paymentStatusDistribution.map(
                          (entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          )
                        )}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Category Breakdown
                  </h3>
                  <div className="space-y-3">
                    {supplierMetrics.categorySpend.map((cat, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700 dark:text-gray-300">
                            {cat.category}
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(cat.spend)}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${cat.percent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupplierPerformance;
