import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAnalytics } from "../api/analytics.js";
import { useAuth } from "../context/AuthContext.jsx";
import { formatCurrency } from "../utils/formatters.js";
import { subscribeToSalesUpdates } from "../utils/salesEvents.js";

const Dashboard = () => {
  const navigate = useNavigate();

  const analyticsFallback = {
    metrics: {
      totalRevenue: 0,
      grossProfit: 0,
      totalOperatingExpenses: 0,
      totalProfit: 0,
      totalSales: 0,
      averageOrderValue: 0,
      inventoryValue: 0,
      lowStockCount: 0,
      totalStudents: 0,
      tuitionCollected: 0,
      classes: 0,
      attendanceRate: 0,
      patientCount: 0,
      appointmentsToday: 0,
      bedsAvailable: 0,
      pendingInvoices: 0,
      totalCustomers: 0,
      activePatients: 0,
      emergencyCases: 0,
      activeClasses: 0,
      totalReceivable: 0,
      totalPayable: 0,
      overdueReceivables: 0,
      overduePayables: 0,
    },
    salesTrend: [],
  };

  const [analytics, setAnalytics] = useState(analyticsFallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const { business, industryType } = useAuth();
  const businessType = business?.businessType || "general_services";
  const isSchool = industryType === "school";
  const isHospital = industryType === "hospital";

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getAnalytics();
        setAnalytics(data || analyticsFallback);
      } catch (err) {
        setError(err.message || "Failed to load analytics");
        setAnalytics(analyticsFallback);
      } finally {
        setLoading(false);
      }
    };

    load();

    const unsubscribe = subscribeToSalesUpdates(() => {
      setRefreshKey((prev) => prev + 1);
    });

    return unsubscribe;
  }, [refreshKey]);

  const { metrics, recentActivity } = useMemo(() => {
    const metricValues = analytics?.metrics || {};

    return {
      metrics: {
        totalRevenue: metricValues.totalRevenue || 0,
        grossProfit: metricValues.grossProfit || 0,
        totalOperatingExpenses: metricValues.totalOperatingExpenses || 0,
        totalProfit: metricValues.totalProfit || 0,
        totalSales: metricValues.totalSales || 0,
        inventoryValue: metricValues.inventoryValue || 0,
        averageOrderValue: metricValues.averageOrderValue || 0,
        totalStudents: metricValues.totalStudents || 0,
        activeClasses: metricValues.activeClasses || 0,
        pendingInvoices: metricValues.pendingInvoices || 0,
        attendanceRate: metricValues.attendanceRate || 0,
        activePatients: metricValues.activePatients || 0,
        appointmentsToday: metricValues.appointmentsToday || 0,
        emergencyCases: metricValues.emergencyCases || 0,
        totalCustomers: metricValues.totalCustomers || metricValues.customerCount || 0,
        totalReceivable: metricValues.totalReceivable || 0,
        totalPayable: metricValues.totalPayable || 0,
        overdueReceivables: metricValues.overdueReceivables || 0,
        overduePayables: metricValues.overduePayables || 0,
      },
      recentActivity: (analytics?.salesTrend || []).slice(0, 6).map((item, index) => {
        const amount =
          item.totalAmount || item.amount || item.total || item.value || item.revenue || 0;
        const customerName =
          item.customerName || item.customer?.name || item.clientName || item.entityName || "Customer";
        const title = item.title || item.description || item.type || "Transaction";
        const timestamp = item.createdAt || item.date || item.timestamp || item.saleDate || null;

        return {
          id: item._id || `${title}-${index}`,
          title,
          customerName,
          amount,
          timestamp,
        };
      }),
    };
  }, [analytics]);

  const executiveCards = isSchool
    ? [
        { label: "Students", value: metrics.totalStudents, tone: "emerald" },
        { label: "Active Classes", value: metrics.activeClasses, tone: "slate" },
        { label: "Accounts Receivable", value: formatCurrency(metrics.totalReceivable), tone: "blue" },
        { label: "Overdue AR", value: formatCurrency(metrics.overdueReceivables), tone: "amber" },
      ]
    : isHospital
      ? [
          { label: "Active Patients", value: metrics.activePatients, tone: "emerald" },
          { label: "Appointments", value: metrics.appointmentsToday, tone: "slate" },
          { label: "Accounts Receivable", value: formatCurrency(metrics.totalReceivable), tone: "blue" },
          { label: "Overdue AR", value: formatCurrency(metrics.overdueReceivables), tone: "amber" },
        ]
      : [
          { label: "Revenue", value: formatCurrency(metrics.totalRevenue), tone: "emerald" },
          { label: "Gross Profit", value: formatCurrency(metrics.grossProfit), tone: "blue" },
          { label: "Operating Expenses", value: formatCurrency(metrics.totalOperatingExpenses), tone: "amber" },
          { label: "Net Profit", value: formatCurrency(metrics.totalProfit), tone: "slate" },
        ];

  const quickActions = [
    {
      title: "Open POS / New Sale",
      description: "Start a transaction quickly for retail or service collection.",
      action: () => navigate("/app/pos"),
      accent: true,
      icon: "🛒",
    },
    {
      title: "Create Invoice",
      description: "Raise and send an invoice without leaving the dashboard.",
      action: () => navigate("/app/invoices"),
      accent: false,
      icon: "🧾",
    },
    {
      title: "Add Customer / Entity",
      description: "Create a client, student, or patient profile instantly.",
      action: () => navigate("/app/customers"),
      accent: false,
      icon: "👤",
    },
  ];

  const moduleTiles = [
    { label: "Inventory", to: "/app/inventory", icon: "📦" },
    { label: "Staff", to: "/app/staff", icon: "👥" },
    { label: "CRM", to: "/app/customers", icon: "🧾" },
    { label: "Analytics", to: "/app/analytics", icon: "📊" },
  ];

  const cardToneStyles = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
    blue: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
    slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300",
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center space-y-4">
        <div className="relative">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600">
            MT
          </div>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Syncing business data...
        </p>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50 p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/30">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">
                Live business hub
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {isSchool ? "Academic Overview" : isHospital ? "Clinical Overview" : "Executive Overview"}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Updated {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setRefreshKey((prev) => prev + 1)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-all duration-150 hover:-translate-y-0.5 hover:bg-slate-50 active:scale-[0.99] focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
              type="button"
            >
              Refresh
            </button>
            <button
              onClick={() => navigate("/app/pos")}
              className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-emerald-700 active:scale-[0.99]"
              type="button"
            >
              Open POS
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          <span>⚠️</span>
          <p>{error}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {executiveCards.map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${cardToneStyles[card.tone] || cardToneStyles.slate}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{card.label}</p>
              <span className="rounded-full border border-current/20 bg-white/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] dark:bg-slate-900/30">
                Live
              </span>
            </div>
            <p className="mt-4 text-2xl font-semibold tracking-tight">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Quick actions</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Start the most common workflows faster.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {quickActions.map((action) => (
              <button
                key={action.title}
                onClick={action.action}
                type="button"
                className={`rounded-2xl border p-4 text-left transition-all duration-150 hover:-translate-y-0.5 active:scale-[0.99] ${
                  action.accent
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-lg shadow-sm dark:bg-slate-900/80">
                  {action.icon}
                </div>
                <p className="text-sm font-semibold">{action.title}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{action.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Module launchers</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Jump to the main operational areas.</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {moduleTiles.map((tile) => (
              <button
                key={tile.label}
                onClick={() => navigate(tile.to)}
                type="button"
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 transition-all duration-150 hover:-translate-y-0.5 hover:bg-slate-100 active:scale-[0.99] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg shadow-sm dark:bg-slate-900">
                  {tile.icon}
                </span>
                <span>{tile.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recent activity</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">A lightweight feed of recent transactions and updates.</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            Updated now
          </span>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                <th className="pb-3">Activity</th>
                <th className="pb-3">Customer</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {recentActivity.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-8 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                      <span className="mb-2 text-2xl">✨</span>
                      <p>No recent transactions available right now.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                recentActivity.map((activity) => (
                  <tr key={activity.id} className="text-sm text-slate-700 transition-colors duration-150 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-950/70">
                    <td className="py-3 pr-4 font-medium">{activity.title}</td>
                    <td className="py-3 pr-4">{activity.customerName}</td>
                    <td className="py-3 pr-4">{formatCurrency(activity.amount)}</td>
                    <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">
                      {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default Dashboard;