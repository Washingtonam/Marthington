import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getReport, REPORT_TYPES } from "../api/reportApi.js";
import { formatCurrency } from "../utils/formatters.js";
import { parseReportDetailRoute } from "../utils/reportDateRouting.js";

const getDateLabel = (date) => {
  if (!date || Number.isNaN(date.getTime())) return "Custom";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
};

const ReportsDetailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);

  const range = useMemo(() => parseReportDetailRoute(new URLSearchParams(location.search)), [location.search]);

  useEffect(() => {
    if (!range.start || !range.end) {
      navigate("/app/reports", { replace: true });
      return;
    }

    const controller = new AbortController();

    getReport(REPORT_TYPES.overview, { signal: controller.signal })
      .then((data) => setReport(data))
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load report detail");
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [navigate, range.start, range.end]);

  const reportSales = useMemo(() => report?.raw?.sales || report?.recentSales || [], [report]);
  const reportTransactions = useMemo(() => {
    const transactions = report?.raw?.transactions || [];
    return transactions.map((transaction) => ({ ...transaction, type: "expense", createdAt: transaction.occurredAt || transaction.createdAt }));
  }, [report]);

  const filteredSales = useMemo(() => {
    return reportSales.filter((sale) => {
      const createdAt = new Date(sale.createdAt);
      return createdAt >= range.start && createdAt <= range.end;
    });
  }, [reportSales, range.start, range.end]);

  const filteredTransactions = useMemo(() => {
    return reportTransactions.filter((transaction) => {
      const createdAt = new Date(transaction.createdAt);
      return createdAt >= range.start && createdAt <= range.end;
    });
  }, [reportTransactions, range.start, range.end]);

  const metrics = useMemo(() => {
    const grossRevenue = filteredSales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
    const cogs = filteredSales.reduce((sum, sale) => {
      const itemsCost = (sale.items || []).reduce((itemSum, item) => {
        return itemSum + ((Number(item.costPrice) || 0) * (Number(item.quantity) || 0));
      }, 0);
      return sum + itemsCost;
    }, 0);
    const grossProfit = grossRevenue - cogs;
    const operatingExpenses = filteredTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const netProfit = grossProfit - operatingExpenses;

    return {
      grossRevenue,
      cogs,
      grossProfit,
      operatingExpenses,
      netProfit,
      salesCount: filteredSales.length,
      transactionCount: filteredTransactions.length + filteredSales.length,
    };
  }, [filteredSales, filteredTransactions]);

  const activityRows = useMemo(() => {
    return [...filteredSales.map((sale) => ({ ...sale, type: "sale" })), ...filteredTransactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [filteredSales, filteredTransactions]);

  if (loading) {
    return <div className="p-6 text-slate-600 dark:text-slate-300">Loading report detail...</div>;
  }

  if (error) {
    return <div className="p-6"><div className="form-error">{error}</div></div>;
  }

  return (
    <section className="page-stack reports-hub dark:text-slate-100">
      <div className="page-heading dark:border-slate-700 dark:bg-slate-900/80">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="section-eyebrow dark:text-emerald-300">Detailed analysis</span>
            <h1 className="dark:text-slate-100">{range.label}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{getDateLabel(range.start)} - {getDateLabel(range.end)}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/app/reports")}
              className="toolbar-button toolbar-button--ghost"
            >
              ← Back to Reports
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="tool-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">Gross Revenue</div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{formatCurrency(metrics.grossRevenue)}</div>
        </div>
        <div className="tool-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">COGS</div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{formatCurrency(metrics.cogs)}</div>
        </div>
        <div className="tool-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">Gross Profit</div>
          <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(metrics.grossProfit)}</div>
        </div>
        <div className="tool-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">Operating Expenses</div>
          <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">{formatCurrency(metrics.operatingExpenses)}</div>
        </div>
        <div className="tool-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-green-600 dark:text-green-400">Net Profit</div>
          <div className="mt-2 text-2xl font-black text-green-600 dark:text-green-400">{formatCurrency(metrics.netProfit)}</div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">Activity breakdown</span>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{metrics.salesCount} sales • {metrics.transactionCount} total entries</p>
          </div>
        </div>

        {activityRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-left text-slate-600 dark:text-slate-400">Time</th>
                  <th className="px-4 py-3 text-left text-slate-600 dark:text-slate-400">Reference</th>
                  <th className="px-4 py-3 text-left text-slate-600 dark:text-slate-400">Type</th>
                  <th className="px-4 py-3 text-left text-slate-600 dark:text-slate-400">Source</th>
                  <th className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">Amount</th>
                </tr>
              </thead>
              <tbody>
                {activityRows.map((entry, index) => (
                  <tr key={`${entry._id || entry.receiptId || index}`} className="border-b border-slate-100 dark:border-slate-700/80">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">#{entry.receiptId || entry._id?.slice(-6) || "N/A"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${entry.type === "expense" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"}`}>
                        {entry.type === "expense" ? "Expense" : "Sale"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{entry.createdBy?.name || entry.category || "Business"}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-100">{formatCurrency(entry.totalAmount || entry.amount || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 dark:text-slate-400">No activity was found for this period.</div>
        )}
      </div>
    </section>
  );
};

export default ReportsDetailPage;
