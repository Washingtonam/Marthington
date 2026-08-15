import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getReport, REPORT_TYPES } from "../api/reportApi.js";
import { formatCurrency } from "../utils/formatters.js";
import { subscribeToSalesUpdates } from "../utils/salesEvents.js";

const PERIOD_OPTIONS = [
  { value: "7", label: "7D" },
  { value: "30", label: "30D" },
  { value: "90", label: "90D" },
  { value: "all", label: "All" },
];

const Reports = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("30");

  const loadReports = async () => {
    try {
      const data = await getReport(REPORT_TYPES.overview, { period });
      setReports(data);
    } catch (err) {
      setError(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();

    const unsubscribe = subscribeToSalesUpdates(() => {
      loadReports();
    });

    return unsubscribe;
  }, [period]);

  const overview = reports?.overview || {};
  const recentSales = reports?.recentSales || [];

  const filteredSales = useMemo(() => {
    const sales = reports?.recentSales || [];
    if (period === "all") return sales;

    const days = Number(period) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return sales.filter((sale) => new Date(sale.createdAt) >= cutoff);
  }, [reports, period]);

  const salesChartData = useMemo(() => {
    const source = filteredSales.length ? filteredSales : reports?.recentSales || [];
    const bucketMap = new Map();

    source.forEach((sale) => {
      const d = new Date(sale.createdAt);
      const key = d.toISOString().slice(0, 10);
      const label = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);

      if (!bucketMap.has(key)) {
        bucketMap.set(key, { label, revenue: 0, profit: 0 });
      }

      const bucket = bucketMap.get(key);
      bucket.revenue += Number(sale.totalAmount || 0);
      bucket.profit += Number(sale.totalProfit || 0);
    });

    const chartData = [...bucketMap.values()];
    return chartData.length ? chartData : [{ label: "No data", revenue: 0, profit: 0 }];
  }, [filteredSales, reports]);

  const topStaff = useMemo(
    () => (reports?.staffPerformance || []).slice(0, 3),
    [reports]
  );

  const staffChartData = useMemo(
    () =>
      topStaff.map((staff) => ({
        name: staff.name || "Staff",
        revenue: Number(staff.totalRevenue || 0),
      })),
    [topStaff]
  );

  const lowStock = useMemo(
    () => (reports?.lowStockProducts || []).slice(0, 3),
    [reports]
  );

  const stockChartData = useMemo(
    () =>
      lowStock.map((product) => ({
        name: product.name || "Item",
        stock: Number(product.stock || 0),
      })),
    [lowStock]
  );

  const recentSalesSummary = useMemo(
    () => filteredSales.slice(0, 4),
    [filteredSales]
  );

  const financialChartData = useMemo(
    () =>
      salesChartData.map((item) => ({
        label: item.label,
        revenue: Number(item.revenue || 0),
        expenses: Number(item.revenue || 0) * 0.42,
        profit: Number(item.profit || 0),
      })),
    [salesChartData]
  );

  const renderMetricValue = (value) => {
    const numericValue = Number(value || 0);
    const formattedValue = formatCurrency(value);
    const currencySymbol = formattedValue.startsWith("₦") ? "₦" : "";
    const numericPortion = formattedValue.replace(/^₦/, "");

    return (
      <div className="metric-value-row">
        <h2 className="metric-value">
          <span className="metric-currency">{currencySymbol}</span>
          <span className="metric-number">{numericPortion}</span>
        </h2>
        {numericValue === 0 && <span className="metric-badge">0.0%</span>}
      </div>
    );
  };

  const renderMiniChart = (type, data, height = 104) => {
    if (type === "area") {
      return (
        <div style={{ width: "100%", height }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="miniRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="label" hide />
              <YAxis hide />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Area type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} fill="url(#miniRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (type === "bar") {
      return (
        <div style={{ width: "100%", height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="name" hide />
              <YAxis hide />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    return (
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
            <XAxis dataKey="name" hide />
            <YAxis hide />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Bar dataKey="stock" fill="#f59e0b" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const reportCards = [
    {
      title: "Sales Report",
      description: "Revenue, transactions, and recent receipts.",
      action: () => navigate("/app/sales"),
      actionLabel: "Open sales",
      summary: [
        { label: "Revenue", value: formatCurrency(overview.monthlyRevenue) },
        { label: "Transactions", value: String(recentSalesSummary.length) },
      ],
      chart: renderMiniChart("area", salesChartData),
    },
    {
      title: "Staff Report",
      description: "Top performers, daily activity, and weekly output.",
      action: () => navigate("/app/staff-reports"),
      actionLabel: "View staff",
      summary: topStaff.map((staff) => ({
        label: staff.name,
        value: formatCurrency(staff.totalRevenue || 0),
      })),
      chart: renderMiniChart("bar", staffChartData),
    },
    {
      title: "Inventory Report",
      description: "Low stock alerts and instant stock health checks.",
      action: () => navigate("/app/inventory-reports"),
      actionLabel: "Open inventory",
      summary: [
        { label: "Stock value", value: formatCurrency(overview.inventoryValue) },
        { label: "Low stock", value: `${lowStock.length} items` },
      ],
      chart: renderMiniChart("stock", stockChartData),
    },
    {
      title: "Financial Report",
      description: "Profit, expenses, and cash health across the month.",
      action: () => navigate("/app/financial-reports"),
      actionLabel: "View finance",
      summary: [
        { label: "Gross profit", value: formatCurrency(overview.monthlyGrossProfit) },
        { label: "Net profit", value: formatCurrency(overview.monthlyProfit) },
      ],
      chart: renderMiniChart("area", financialChartData),
    },
  ];

  if (loading) return <div className="p-6">Loading reports...</div>;

  return (
    <section className="page-stack dark:text-slate-100">
      <div className="page-heading dark:border-slate-700 dark:bg-slate-900/80">
        <div>
          <span className="section-eyebrow dark:text-emerald-300">
            <span className="status-dot" />
            Business Intelligence
          </span>
          <h1 className="dark:text-slate-100">Reports Hub</h1>
        </div>
      </div>

      {error && <div className="form-error dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50">{error}</div>}

      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <span className="mr-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Period</span>
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setPeriod(option.value)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              period === option.value
                ? "bg-slate-900 text-white shadow-sm dark:bg-emerald-500 dark:text-slate-900"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="metrics-grid dark:text-slate-100">
        <div className="tool-panel metric-card revenue">
          <div className="metric-icon">↗</div>
          <div>
            <span className="metric-label">Today’s Revenue</span>
            {renderMetricValue(overview.todayRevenue)}
            <span className="metric-caption">Live performance snapshot</span>
          </div>
        </div>
        <div className="tool-panel metric-card success">
          <div className="metric-icon">◔</div>
          <div>
            <span className="metric-label">Monthly Revenue</span>
            {renderMetricValue(overview.monthlyRevenue)}
            <span className="metric-caption">Rolling monthly trend</span>
          </div>
        </div>
        <div className="tool-panel metric-card success">
          <div className="metric-icon">◔</div>
          <div>
            <span className="metric-label">Gross Profit</span>
            {renderMetricValue(overview.monthlyGrossProfit)}
            <span className="metric-caption">Revenue minus COGS</span>
          </div>
        </div>
        <div className="tool-panel metric-card warning">
          <div className="metric-icon">⚠</div>
          <div>
            <span className="metric-label">Operating Expenses</span>
            {renderMetricValue(overview.monthlyOperatingExpenses)}
            <span className="metric-caption">Total business costs</span>
          </div>
        </div>
        <div className="tool-panel metric-card warning">
          <div className="metric-icon">◎</div>
          <div>
            <span className="metric-label">Monthly Profit</span>
            {renderMetricValue(overview.monthlyProfit)}
            <span className="metric-caption">Net profit (Gross - Expenses)</span>
          </div>
        </div>
        <div className="tool-panel metric-card">
          <div className="metric-icon">▣</div>
          <div>
            <span className="metric-label">Inventory Value</span>
            {renderMetricValue(overview.inventoryValue)}
            <span className="metric-caption">Current stock position</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4 dark:text-slate-100">
        {reportCards.map((card) => (
          <div key={card.title} className="tool-panel dark:border-slate-700 dark:bg-slate-900">
            <div className="panel-heading">
              <div>
                <h2 className="dark:text-slate-100">{card.title}</h2>
                <p className="dark:text-slate-400">{card.description}</p>
              </div>
            </div>

            <div className="mt-4">{card.chart}</div>

            <div className="mt-4 space-y-3">
              {card.summary.map((item) => (
                <div key={item.label} className="compact-row dark:border-slate-700 dark:bg-slate-800">
                  <div>
                    <strong className="dark:text-slate-100">{item.label}</strong>
                    <span className="dark:text-slate-400">{card.title}</span>
                  </div>
                  <strong className="dark:text-slate-100">{item.value}</strong>
                </div>
              ))}
            </div>

            <button onClick={card.action} className="ghost-button mt-4 w-full dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
              {card.actionLabel}
            </button>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3 dark:text-slate-100">
        <div className="tool-panel dark:border-slate-700 dark:bg-slate-900">
          <div className="panel-heading">
            <div>
              <h2 className="dark:text-slate-100">Top staff</h2>
              <p className="dark:text-slate-400">Current performance ranking</p>
            </div>
          </div>
          <div className="compact-list">
            {topStaff.map((staff, index) => (
              <div key={`${staff.name}-${index}`} className="compact-row dark:border-slate-700 dark:bg-slate-800">
                <div>
                  <strong className="dark:text-slate-100">{staff.name}</strong>
                  <span className="dark:text-slate-400">{staff.todaySales || 0} today</span>
                </div>
                <strong className="dark:text-slate-100">{formatCurrency(staff.totalRevenue || 0)}</strong>
              </div>
            ))}
          </div>
          <button onClick={() => navigate("/app/staff-reports")} className="ghost-button mt-4 w-full dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
            View Staff Analytics
          </button>
        </div>

        <div className="tool-panel dark:border-slate-700 dark:bg-slate-900">
          <div className="panel-heading">
            <div>
              <h2 className="dark:text-slate-100">Low stock alerts</h2>
              <p className="dark:text-slate-400">Monitor items running low</p>
            </div>
          </div>
          <div className="compact-list">
            {lowStock.map((product) => (
              <div key={product._id} className="compact-row dark:border-slate-700 dark:bg-slate-800">
                <div>
                  <strong className="dark:text-slate-100">{product.name}</strong>
                  <span className="dark:text-slate-400">SKU: {product.sku || "N/A"}</span>
                </div>
                <strong className="text-red-500 dark:text-red-400">{product.stock}</strong>
              </div>
            ))}
          </div>
          <button onClick={() => navigate("/app/inventory-reports")} className="ghost-button mt-4 w-full dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
            Open Inventory Alerts
          </button>
        </div>

        <div className="tool-panel dark:border-slate-700 dark:bg-slate-900">
          <div className="panel-heading">
            <div>
              <h2 className="dark:text-slate-100">Recent sales</h2>
              <p className="dark:text-slate-400">Latest transactions in the business</p>
            </div>
          </div>
          <div className="compact-list">
            {recentSales.map((sale) => (
              <div key={sale._id} className="compact-row dark:border-slate-700 dark:bg-slate-800">
                <div>
                  <strong className="dark:text-slate-100">#{sale.receiptId}</strong>
                  <span className="dark:text-slate-400">{sale.createdBy?.name || "Unknown"}</span>
                </div>
                <strong className="dark:text-slate-100">{formatCurrency(sale.totalAmount)}</strong>
              </div>
            ))}
          </div>
          <button onClick={() => navigate("/app/sales")} className="ghost-button mt-4 w-full dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
            Open Sales Center
          </button>
          {(JSON.parse(localStorage.getItem("bms_user") || "null")?.role === "owner" || JSON.parse(localStorage.getItem("bms_user") || "null")?.role === "super_admin") && (
            <button onClick={() => navigate("/app/deleted-sales")} className="ghost-button mt-2 w-full dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
              View Archived Sales
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default Reports;