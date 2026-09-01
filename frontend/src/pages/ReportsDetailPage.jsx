import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getReport, REPORT_TYPES } from "../api/reportApi.js";
import { formatCurrency } from "../utils/formatters.js";
import { parseReportDetailRoute } from "../utils/reportDateRouting.js";

const getDateLabel = (date) => {
  if (!date || Number.isNaN(date.getTime())) return "Custom";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
};

const normalizePaymentMethod = (value) => {
  const method = String(value ?? "cash").toLowerCase().trim();

  if (["cash", "cash payment", "cash sale", "cashless"].includes(method)) return "cash";
  if (["card", "debit card", "credit card", "visa", "mastercard", "pos", "card payment"].includes(method)) return "card";
  if (["bank transfer", "bank transfer payment", "bank_transfer", "bank-transfer", "bank", "transfer"].includes(method)) return "bank_transfer";
  if (["credit", "debt", "credit sale", "account"].includes(method)) return "credit";

  return "other";
};

const getEntryItems = (entry) => {
  if (!entry) return [];

  const items = Array.isArray(entry.items) ? entry.items : [];
  if (items.length > 0) {
    return items.map((item) => ({
      name: item.name || item.productName || "Unnamed item",
      quantity: Number(item.quantity || 1),
      price: Number(item.sellingPrice || item.price || item.amount || 0),
      category: item.category || "General",
    }));
  }

  if (entry.productName || entry.name) {
    return [{
      name: entry.productName || entry.name,
      quantity: Number(entry.quantity || 1),
      price: Number(entry.totalAmount || entry.amount || 0),
      category: entry.category || "General",
    }];
  }

  return [{
    name: "Business activity",
    quantity: 1,
    price: Number(entry.totalAmount || entry.amount || 0),
    category: entry.category || "General",
  }];
};

const getItemLabel = (entry) => {
  const items = getEntryItems(entry);
  if (!items.length) return "No item details";

  return items
    .slice(0, 2)
    .map((item) => `${item.name}${item.quantity > 1 ? ` × ${item.quantity}` : ""}`)
    .join(", ") + (items.length > 2 ? ` +${items.length - 2} more` : "");
};

const paymentOptions = [
  { value: "all", label: "All methods" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "credit", label: "Credit" },
  { value: "other", label: "Other" },
];

const ReportsDetailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);
  const [paymentFilter, setPaymentFilter] = useState("all");

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
    return transactions.map((transaction) => ({
      ...transaction,
      type: "expense",
      createdAt: transaction.occurredAt || transaction.createdAt,
    }));
  }, [report]);

  const filteredSales = useMemo(() => {
    return reportSales.filter((sale) => {
      const createdAt = new Date(sale.createdAt);
      const inRange = createdAt >= range.start && createdAt <= range.end;
      if (!inRange) return false;
      if (paymentFilter === "all") return true;
      return normalizePaymentMethod(sale.paymentMethod) === paymentFilter;
    });
  }, [reportSales, range.start, range.end, paymentFilter]);

  const filteredTransactions = useMemo(() => {
    return reportTransactions.filter((transaction) => {
      const createdAt = new Date(transaction.createdAt);
      if (paymentFilter !== "all") return false;
      return createdAt >= range.start && createdAt <= range.end;
    });
  }, [reportTransactions, range.start, range.end, paymentFilter]);

  const paymentBreakdown = useMemo(() => {
    const totals = { cash: 0, card: 0, bank_transfer: 0, credit: 0, other: 0 };

    reportSales.forEach((sale) => {
      const createdAt = new Date(sale.createdAt);
      if (createdAt >= range.start && createdAt <= range.end) {
        const method = normalizePaymentMethod(sale.paymentMethod);
        totals[method] += Number(sale.totalAmount || 0);
      }
    });

    return totals;
  }, [reportSales, range.start, range.end]);

  const metrics = useMemo(() => {
    const grossRevenue = filteredSales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
    const cogs = filteredSales.reduce((sum, sale) => {
      const itemsCost = (sale.items || []).reduce((itemSum, item) => itemSum + ((Number(item.costPrice) || 0) * (Number(item.quantity) || 0)), 0);
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
    return [...filteredSales.map((sale) => ({ ...sale, type: "sale" })), ...filteredTransactions]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        {paymentOptions.map((option) => {
          const amount = option.value === "all" ? metrics.grossRevenue : paymentBreakdown[option.value] || 0;
          const isActive = paymentFilter === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setPaymentFilter(option.value)}
              className={`rounded-2xl border p-3 text-left transition ${isActive ? "border-emerald-500 bg-emerald-50 shadow-sm dark:border-emerald-400 dark:bg-emerald-900/20" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/80"}`}
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{option.label}</div>
              <div className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">{formatCurrency(amount)}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">Activity breakdown</span>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{metrics.salesCount} sales • {metrics.transactionCount} total entries</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {paymentOptions.map((option) => (
              <button
                key={`filter-${option.value}`}
                type="button"
                onClick={() => setPaymentFilter(option.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${paymentFilter === option.value ? "bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-900" : "border border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-300"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {activityRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-left text-slate-600 dark:text-slate-400">Time</th>
                  <th className="px-4 py-3 text-left text-slate-600 dark:text-slate-400">Items</th>
                  <th className="px-4 py-3 text-left text-slate-600 dark:text-slate-400">Type</th>
                  <th className="px-4 py-3 text-left text-slate-600 dark:text-slate-400">Payment</th>
                  <th className="px-4 py-3 text-left text-slate-600 dark:text-slate-400">Staff</th>
                  <th className="px-4 py-3 text-left text-slate-600 dark:text-slate-400">Reference</th>
                  <th className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">Amount</th>
                </tr>
              </thead>
              <tbody>
                {activityRows.map((entry, index) => {
                  const statusTone = entry.type === "expense"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";

                  const itemLabel = getItemLabel(entry);
                  const paymentLabel = entry.type === "expense" ? "Expense" : (entry.paymentMethod || "Cash");

                  return (
                    <tr key={`${entry._id || entry.receiptId || index}`} className="border-b border-slate-100 align-top dark:border-slate-700/80">
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-slate-700 dark:text-slate-300">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{itemLabel}</div>
                        {entry.type === "sale" && Array.isArray(entry.items) && entry.items.length > 0 && (
                          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {entry.items.slice(0, 3).map((item) => `${item.name || item.productName || "Item"} (${item.quantity || 1})`).join(" • ")}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${statusTone}`}>
                          {entry.type === "expense" ? "Expense" : "Sale"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{paymentLabel}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{entry.createdBy?.name || entry.staff || "System"}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">#{entry.receiptId || entry._id?.slice(-6) || "N/A"}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-100">{formatCurrency(entry.totalAmount || entry.amount || 0)}</td>
                    </tr>
                  );
                })}
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
