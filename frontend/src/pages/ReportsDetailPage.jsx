import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getReport, REPORT_TYPES } from "../api/reportApi.js";
import { formatCurrency } from "../utils/formatters.js";
import { parseReportDetailRoute } from "../utils/reportDateRouting.js";
import { FiDownload, FiGrid, FiList, FiPrinter, FiShare2 } from "react-icons/fi";

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

const getPaymentLabel = (value) => paymentOptions.find((option) => option.value === value)?.label || "Other";

export const buildLedgerEntries = ({ sales = [], expenses = [] }) => {
  const rows = [
    ...sales.map((sale, index) => ({
      id: sale?._id || sale?.receiptId || `sale-${index}`,
      side: "sale",
      date: sale?.createdAt,
      particulars: getItemLabel(sale),
      reference: sale?.receiptId || sale?._id || "Sales receipt",
      amount: Number(sale?.totalAmount || sale?.amount || 0),
      paymentMethod: sale?.paymentMethod || "cash",
    })),
    ...expenses.map((expense, index) => ({
      id: expense?._id || expense?.reference || `expense-${index}`,
      side: "expense",
      date: expense?.createdAt || expense?.occurredAt,
      particulars: expense?.description || expense?.note || expense?.category || "Operating expense",
      reference: expense?.reference || expense?.category || "Expense record",
      amount: Number(expense?.amount || expense?.totalAmount || 0),
      paymentMethod: "Expense",
    })),
  ];

  return rows.sort((a, b) => new Date(a.date) - new Date(b.date));
};

const LedgerRegister = ({ title, subtitle, total, tone, entries, viewMode }) => {
  const palette = tone === "emerald"
    ? {
      wrapper: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20",
      divider: "border-emerald-200 dark:border-emerald-900/60",
      heading: "text-emerald-700 dark:text-emerald-300",
      amount: "text-emerald-800 dark:text-emerald-200",
      row: "border-emerald-100 dark:border-emerald-900/50",
    }
    : {
      wrapper: "border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20",
      divider: "border-amber-200 dark:border-amber-900/60",
      heading: "text-amber-700 dark:text-amber-300",
      amount: "text-amber-800 dark:text-amber-200",
      row: "border-amber-100 dark:border-amber-900/50",
    };

  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${palette.wrapper}`}>
      <div className={`mb-3 flex items-center justify-between gap-3 border-b pb-2 ${palette.divider}`}>
        <div>
          <div className={`text-[10px] font-bold uppercase tracking-[0.2em] ${palette.heading}`}>{title}</div>
          <div className={`mt-1 text-xs opacity-80 ${palette.heading}`}>{subtitle}</div>
        </div>
        <span className={`text-sm font-black ${palette.amount}`}>{formatCurrency(total)}</span>
      </div>

      {entries.length > 0 ? (
        viewMode === "expanded" ? (
          <div className="grid gap-2">
            {entries.map((entry) => (
              <div key={entry.id} className={`rounded-xl border bg-white/70 p-3 transition hover:-translate-y-0.5 hover:shadow-sm dark:bg-slate-900/40 ${palette.row}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{entry.particulars}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(entry.date))} · {entry.reference}</div>
                  </div>
                  <div className={`shrink-0 text-sm font-black ${palette.amount}`}>{formatCurrency(entry.amount)}</div>
                </div>
                <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{entry.paymentMethod === "Expense" ? "Expense" : getPaymentLabel(entry.paymentMethod)}</div>
              </div>
            ))}
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className={`border-b text-left ${palette.divider}`}>
                <th className={`pb-2 pr-3 text-[11px] font-bold uppercase tracking-[0.18em] ${palette.heading}`}>Date</th>
                <th className={`pb-2 pr-3 text-[11px] font-bold uppercase tracking-[0.18em] ${palette.heading}`}>Particulars</th>
                <th className={`pb-2 pr-3 text-[11px] font-bold uppercase tracking-[0.18em] ${palette.heading}`}>Ref</th>
                <th className={`pb-2 text-right text-[11px] font-bold uppercase tracking-[0.18em] ${palette.heading}`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className={`border-b align-top ${palette.row}`}>
                  <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-300">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(entry.date))}</td>
                  <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-200">{entry.particulars}</td>
                  <td className="py-2.5 pr-3 text-slate-500 dark:text-slate-400">{entry.reference}</td>
                  <td className={`py-2.5 text-right font-bold ${palette.amount}`}>{formatCurrency(entry.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )
      ) : (
        <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No entries</div>
      )}
    </div>
  );
};

const ReportsDetailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [viewMode, setViewMode] = useState("compact");

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
    const averageSaleValue = filteredSales.length ? grossRevenue / filteredSales.length : 0;
    const topPayment = Object.entries(paymentBreakdown).sort(([, a], [, b]) => b - a)[0];

    return {
      grossRevenue,
      cogs,
      grossProfit,
      operatingExpenses,
      netProfit,
      averageSaleValue,
      topPayment: topPayment ? { name: topPayment[0], value: topPayment[1] } : { name: "cash", value: 0 },
      salesCount: filteredSales.length,
      transactionCount: filteredTransactions.length + filteredSales.length,
    };
  }, [filteredSales, filteredTransactions, paymentBreakdown]);

  const ledgerRows = useMemo(() => buildLedgerEntries({
    sales: filteredSales,
    expenses: filteredTransactions,
  }), [filteredSales, filteredTransactions]);

  const salesTotal = useMemo(() => filteredSales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0), [filteredSales]);
  const expensesTotal = useMemo(() => filteredTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0), [filteredTransactions]);

  const paymentTotal = Object.values(paymentBreakdown).reduce((sum, amount) => sum + amount, 0);
  const handleExport = () => {
    const rows = [
      ["Date", "Type", "Particulars", "Reference", "Payment", "Amount"],
      ...ledgerRows.map((entry) => [entry.date, entry.side, entry.particulars, entry.reference, entry.paymentMethod, entry.amount]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `${range.label.toLowerCase().replaceAll(" ", "-")}-report.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: `${range.label} report`, text: "Financial report", url: window.location.href });
    } else {
      await navigator.clipboard?.writeText(window.location.href);
    }
  };

  if (loading) {
    return <div className="p-6 text-slate-600 dark:text-slate-300">Loading report detail...</div>;
  }

  if (error) {
    return <div className="p-6"><div className="form-error">{error}</div></div>;
  }

  const summaryCards = [
    {
      label: "Gross Revenue",
      value: formatCurrency(metrics.grossRevenue),
      className: "border-white/10 bg-white/10 text-white",
      accent: "text-emerald-200",
    },
    {
      label: "Cost of goods sold",
      value: formatCurrency(metrics.cogs),
      className: "border-white/10 bg-white/5 text-white",
      accent: "text-slate-300",
    },
    {
      label: "Operating expenses",
      value: formatCurrency(metrics.operatingExpenses),
      className: "border-white/10 bg-white/5 text-white",
      accent: "text-amber-200",
    },
    {
      label: "Net profit",
      value: formatCurrency(metrics.netProfit),
      className: "border-emerald-300/40 bg-emerald-400/20 text-white shadow-lg shadow-emerald-950/20",
      accent: "text-emerald-200",
    },
  ];

  const insights = [
    { label: "Average sale", value: formatCurrency(metrics.averageSaleValue) },
    { label: "Top payment", value: metrics.topPayment.name ? metrics.topPayment.name.replace("_", " ") : "Cash" },
    { label: "Entries", value: String(metrics.transactionCount) },
  ];

  return (
    <section className="page-stack reports-hub dark:text-slate-100">
      <div className="overflow-hidden rounded-3xl border border-slate-700/70 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-5 text-white shadow-2xl shadow-slate-900/20">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-300">Financial health</span>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">{range.label} report</h1>
            <div className="mt-3 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200">{getDateLabel(range.start)} - {getDateLabel(range.end)}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
              {metrics.salesCount} sales
            </div>
            <button type="button" title="Export report" aria-label="Export report" onClick={handleExport} className="rounded-xl border border-white/15 bg-white/5 p-2.5 text-slate-200 transition hover:bg-white/15"><FiDownload /></button>
            <button type="button" title="Print report" aria-label="Print report" onClick={() => window.print()} className="rounded-xl border border-white/15 bg-white/5 p-2.5 text-slate-200 transition hover:bg-white/15"><FiPrinter /></button>
            <button type="button" title="Share report" aria-label="Share report" onClick={handleShare} className="rounded-xl border border-white/15 bg-white/5 p-2.5 text-slate-200 transition hover:bg-white/15"><FiShare2 /></button>
            <button
              type="button"
              onClick={() => navigate("/app/reports")}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              ← Back to Reports
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 border-t border-white/10 pt-5 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className={`rounded-2xl border p-4 backdrop-blur-sm ${card.className}`}>
              <div className={`text-[10px] font-bold uppercase tracking-[0.18em] ${card.accent}`}>{card.label}</div>
              <div className="mt-3 text-2xl font-black leading-tight">{card.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/40 dark:border-slate-700 dark:bg-slate-900/80 dark:shadow-slate-950/20">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Payment mix</span>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Where revenue came from</p>
          </div>
          <span className="text-sm font-black text-slate-900 dark:text-slate-100">{formatCurrency(paymentTotal)}</span>
        </div>

        <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          {paymentOptions.slice(1).map((option, index) => {
            const amount = paymentBreakdown[option.value] || 0;
            const width = paymentTotal ? `${Math.max((amount / paymentTotal) * 100, amount ? 2 : 0)}%` : "0%";
            const colors = ["bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-amber-500", "bg-slate-400"];
            return <button key={option.value} type="button" title={`${option.label}: ${formatCurrency(amount)}`} onClick={() => setPaymentFilter(option.value)} className={`${colors[index]} transition-opacity hover:opacity-80`} style={{ width }} aria-label={`Filter by ${option.label}`} />;
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {paymentOptions.map((option) => {
            const amount = option.value === "all" ? metrics.grossRevenue : paymentBreakdown[option.value] || 0;
            const isActive = paymentFilter === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setPaymentFilter(option.value)}
                className={`rounded-full border px-3 py-2 text-left transition ${isActive ? "border-emerald-500 bg-emerald-50 shadow-sm dark:border-emerald-400 dark:bg-emerald-900/20" : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80"}`}
              >
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{option.label}</span>
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{formatCurrency(amount)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/40 dark:border-slate-700 dark:bg-slate-900/80 dark:shadow-slate-950/20">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Financial register</span>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{metrics.salesCount} sales • {metrics.transactionCount} total entries</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="mr-1 flex rounded-xl border border-slate-200 p-1 dark:border-slate-700">
              <button type="button" title="Compact table view" aria-label="Compact table view" onClick={() => setViewMode("compact")} className={`rounded-lg p-2 ${viewMode === "compact" ? "bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950" : "text-slate-500"}`}><FiList /></button>
              <button type="button" title="Expanded card view" aria-label="Expanded card view" onClick={() => setViewMode("expanded")} className={`rounded-lg p-2 ${viewMode === "expanded" ? "bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950" : "text-slate-500"}`}><FiGrid /></button>
            </div>
            {paymentOptions.map((option) => (
              <button
                key={`filter-${option.value}`}
                type="button"
                onClick={() => setPaymentFilter(option.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${paymentFilter === option.value ? "bg-slate-900 text-white shadow-sm dark:bg-emerald-500 dark:text-slate-900" : "border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {ledgerRows.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <LedgerRegister
              title="Sales register"
              subtitle="Cash inflow"
              total={salesTotal}
              tone="emerald"
              entries={ledgerRows.filter((entry) => entry.side === "sale")}
              viewMode={viewMode}
            />
            <LedgerRegister
              title="Expenses register"
              subtitle="Cash outflow"
              total={expensesTotal}
              tone="amber"
              entries={ledgerRows.filter((entry) => entry.side === "expense")}
              viewMode={viewMode}
            />
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 dark:text-slate-400">No activity was found for this period.</div>
        )}
      </div>
    </section>
  );
};

export default ReportsDetailPage;
