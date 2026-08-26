import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getReport, REPORT_TYPES } from "../api/reportApi.js";
import { formatCurrency } from "../utils/formatters.js";

const PERIOD_OPTIONS = [
  { value: "7", label: "7D" },
  { value: "30", label: "30D" },
  { value: "90", label: "90D" },
  { value: "all", label: "All" },
];

const FinancialReports = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("30");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getReport(REPORT_TYPES.financial, { period });
        setReports(data);
      } catch (err) {
        setError(err.message || "Failed to load financial reports");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [period]);

  const overview = reports?.overview || {};

  const chartData = useMemo(() => {
    return reports?.chartData?.length
      ? reports.chartData
      : [{ label: "No data", revenue: 0, expenses: 0, profit: 0 }];
  }, [reports, period]);

  const summaryCards = [
    { label: "Monthly Revenue", value: overview.monthlyRevenue, tone: "green" },
    { label: "Gross Profit", value: overview.monthlyGrossProfit, tone: "emerald" },
    { label: "Operating Expenses", value: overview.monthlyOperatingExpenses, tone: "amber" },
    { label: "Net Profit", value: overview.monthlyProfit, tone: "blue" },
  ];

  if (loading) {
    return <div className="p-6 text-center">Loading financial reports...</div>;
  }

  return (
    <section className="page-stack dark:text-slate-100">
      <div className="page-heading dark:border-slate-700 dark:bg-slate-900/80">
        <div>
          <span className="section-eyebrow dark:text-emerald-300">
            <span className="status-dot" />
            Financial Intelligence
          </span>
          <h1 className="dark:text-slate-100">Financial Reports</h1>
        </div>

        <button
          onClick={() => navigate("/app/reports")}
          className="ghost-button dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          Back to Reports
        </button>
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
        {summaryCards.map((card) => (
          <div key={card.label} className="tool-panel metric-card">
            <div className="metric-icon">{card.tone === "green" ? "↗" : card.tone === "emerald" ? "◔" : card.tone === "amber" ? "⚠" : "◎"}</div>
            <div>
              <span className="metric-label">{card.label}</span>
              <div className="metric-value-row">
                <h2 className="metric-value">
                  <span className="metric-currency">{formatCurrency(card.value).startsWith("₦") ? "₦" : ""}</span>
                  <span className="metric-number">{formatCurrency(card.value).replace(/^₦/, "")}</span>
                </h2>
              </div>
              <span className="metric-caption">Current performance</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="tool-panel dark:border-slate-700 dark:bg-slate-900">
          <div className="panel-heading">
            <div>
              <h2 className="dark:text-slate-100">Revenue vs profit</h2>
              <p className="dark:text-slate-400">Income and profitability trend</p>
            </div>
          </div>

          <div className="mt-4" style={{ width: "100%", height: 310 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="financialRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="financialProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(value) => `₦${value / 1000}k`} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#22c55e" fill="url(#financialRevenue)" strokeWidth={3} />
                <Area type="monotone" dataKey="profit" name="Profit" stroke="#3b82f6" fill="url(#financialProfit)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="tool-panel dark:border-slate-700 dark:bg-slate-900">
          <div className="panel-heading">
            <div>
              <h2 className="dark:text-slate-100">Expense split</h2>
              <p className="dark:text-slate-400">Estimated operating cost composition</p>
            </div>
          </div>

          <div className="mt-4" style={{ width: "100%", height: 310 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(value) => `₦${value / 1000}k`} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="expenses" name="Expenses" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="#22c55e" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="tool-panel dark:border-slate-700 dark:bg-slate-900">
          <div className="panel-heading">
            <div>
              <h2 className="dark:text-slate-100">P&L snapshot</h2>
              <p className="dark:text-slate-400">Gross vs net performance summary</p>
            </div>
          </div>

          <div className="space-y-3 mt-4">
            <div className="compact-row dark:border-slate-700 dark:bg-slate-800">
              <div>
                <strong className="dark:text-slate-100">Gross Profit</strong>
                <span className="dark:text-slate-400">Before operating costs</span>
              </div>
              <strong className="dark:text-slate-100">{formatCurrency(overview.monthlyGrossProfit)}</strong>
            </div>
            <div className="compact-row dark:border-slate-700 dark:bg-slate-800">
              <div>
                <strong className="dark:text-slate-100">Operating Expenses</strong>
                <span className="dark:text-slate-400">Monthly overhead</span>
              </div>
              <strong className="dark:text-slate-100">{formatCurrency(overview.monthlyOperatingExpenses)}</strong>
            </div>
            <div className="compact-row dark:border-slate-700 dark:bg-slate-800">
              <div>
                <strong className="dark:text-slate-100">Net Profit</strong>
                <span className="dark:text-slate-400">After operating costs</span>
              </div>
              <strong className="dark:text-slate-100">{formatCurrency(overview.monthlyProfit)}</strong>
            </div>
          </div>
        </div>

        <div className="tool-panel dark:border-slate-700 dark:bg-slate-900">
          <div className="panel-heading">
            <div>
              <h2 className="dark:text-slate-100">Quick actions</h2>
              <p className="dark:text-slate-400">Navigate to finance tools</p>
            </div>
          </div>

          <div className="space-y-3 mt-4">
            <button onClick={() => navigate("/app/expenses")} className="ghost-button mt-0 w-full dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
              Review expense ledger
            </button>
            <button onClick={() => navigate("/app/budget-management")} className="ghost-button mt-0 w-full dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
              Budget management
            </button>
            <button onClick={() => navigate("/app/budget-alerts")} className="ghost-button mt-0 w-full dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
              Budget alerts
            </button>
            <button onClick={() => navigate("/app/cost-trends")} className="ghost-button mt-0 w-full dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
              Cost trend analysis
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinancialReports;
