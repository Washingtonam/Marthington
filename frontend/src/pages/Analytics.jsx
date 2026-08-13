import { useEffect, useMemo, useState } from "react";
import { getAnalytics } from "../api/analytics.js";
import request from "../api/client.js";
import { formatCurrency } from "../utils/formatters.js";
import { subscribeToSalesUpdates } from "../utils/salesEvents.js";

const rangeOptions = [
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "1y", label: "This Year" },
];

const Analytics = () => {
  const [range, setRange] = useState("30d");
  const [analytics, setAnalytics] = useState(null);
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [analyticsData, reportsData] = await Promise.all([
        getAnalytics(),
        request("/reports"),
      ]);
      setAnalytics(analyticsData || null);
      setReports(reportsData || null);
    } catch (err) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();

    const unsubscribe = subscribeToSalesUpdates(() => {
      loadAnalytics();
    });

    return unsubscribe;
  }, []);

  const metrics = useMemo(() => {
    const source = analytics?.metrics || {};
    return {
      revenue: source.totalRevenue || 0,
      profit: source.totalProfit || 0,
      expenses: source.totalOperatingExpenses || 0,
      averageOrder: source.averageOrderValue || 0,
      growth: source.growthVelocity || source.salesGrowth || 0,
      sales: source.totalSales || 0,
      customers: source.totalCustomers || source.customerCount || 0,
    };
  }, [analytics]);

  const revenueTrend = useMemo(() => {
    const rows = analytics?.salesTrend || [];
    return rows.slice(0, 8).map((item, index) => ({
      label: item.label || `Day ${index + 1}`,
      value: item.totalAmount || item.amount || item.sales || item.total || 0,
    }));
  }, [analytics]);

  const topProducts = useMemo(() => {
    const list = analytics?.topProducts || [];
    return list.slice(0, 5);
  }, [analytics]);

  const retentionItems = useMemo(() => {
    const list = reports?.recentSales || [];
    return list.slice(0, 5).map((item) => ({
      name: item.customerName || item.createdBy?.name || "Customer",
      value: item.totalAmount || 0,
    }));
  }, [reports]);

  const channels = useMemo(() => {
    const sources = reports?.staffPerformance || [];
    return sources.slice(0, 4).map((item) => ({
      name: item.name || "Channel",
      value: item.revenue || 0,
    }));
  }, [reports]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-sm font-medium text-slate-500 dark:text-slate-400">
        Loading analytics...
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50 p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">
              Analytics & Insights
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Business performance at a glance
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              View revenue trends, operational performance, and key breakdowns in one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {rangeOptions.map((option) => (
              <button
                key={option.key}
                onClick={() => setRange(option.key)}
                type="button"
                className={`rounded-full px-3 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.99] ${
                  range === option.key
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Gross Revenue", value: formatCurrency(metrics.revenue), tone: "emerald" },
          { label: "Operating Expenses", value: formatCurrency(metrics.expenses), tone: "amber" },
          { label: "Net Profit", value: formatCurrency(metrics.profit), tone: "slate" },
          { label: "Average Order Value", value: formatCurrency(metrics.averageOrder), tone: "sky" },
          { label: "Sales Growth Velocity", value: `${metrics.growth}%`, tone: "emerald" },
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-[24px] border p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
              card.tone === "emerald"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                : card.tone === "amber"
                  ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                  : card.tone === "sky"
                    ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300"
                    : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{card.label}</p>
              <span className="rounded-full border border-current/20 bg-white/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] dark:bg-slate-900/30">
                Live
              </span>
            </div>
            <p className="mt-4 text-2xl font-semibold tracking-tight">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Revenue analysis</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Trend movement across recent activity.</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              {rangeOptions.find((option) => option.key === range)?.label}
            </span>
          </div>

          <div className="mt-6 flex h-56 items-end gap-3">
            {revenueTrend.length > 0 ? (
              revenueTrend.map((item) => (
                <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-40 w-full items-end rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
                    <div
                      className="w-full rounded-xl bg-emerald-500"
                      style={{ height: `${Math.max(20, (item.value / Math.max(...revenueTrend.map((i) => i.value), 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{item.label}</span>
                </div>
              ))
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                No trend data available yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Daily performance</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">A compact view of momentum for the current activity cycle.</p>

          <div className="mt-6 space-y-4">
            {[
              { label: "Sales volume", value: metrics.sales, color: "bg-sky-500" },
              { label: "Customer count", value: metrics.customers, color: "bg-emerald-500" },
              { label: "Average order", value: formatCurrency(metrics.averageOrder), color: "bg-amber-500" },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                  <span>{item.label}</span>
                  <span className="font-semibold">{item.value}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className={`h-2 rounded-full ${item.color}`} style={{ width: "72%" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Top selling products</h2>
          <div className="mt-5 space-y-3">
            {topProducts.length > 0 ? (
              topProducts.map((product) => (
                <div key={product._id || product.name} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{product.name}</span>
                  <span className="text-slate-500 dark:text-slate-400">{product.quantitySold ?? product.sales ?? "—"}</span>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                No product data available yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Customer retention</h2>
          <div className="mt-5 space-y-3">
            {retentionItems.length > 0 ? (
              retentionItems.map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{item.name}</span>
                  <span className="text-slate-500 dark:text-slate-400">{formatCurrency(item.value)}</span>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                Retention details will appear when transactions are available.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Channel performance</h2>
          <div className="mt-5 space-y-3">
            {channels.length > 0 ? (
              channels.map((channel) => (
                <div key={channel.name} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{channel.name}</span>
                  <span className="text-slate-500 dark:text-slate-400">{formatCurrency(channel.value)}</span>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                Channel breakdowns will appear here soon.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Analytics;
