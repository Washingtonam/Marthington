import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useLocation, useNavigate } from "react-router-dom";
import request from "../api/client.js";
import { bulkUpdateSaleStatus, updateSaleStatus } from "../api/sales.js";
import { formatCurrency } from "../utils/formatters.js";
import { notifySalesUpdated } from "../utils/salesEvents.js";

const STATUS_META = {
  pending: {
    label: "Pending",
    className: "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200",
  },
  posted: {
    label: "Posted",
    className: "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  },
  reversed: {
    label: "Reversed",
    className: "bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200",
  },
};

const Sales = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const staffFilter = params.get("staff") || "";

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState(staffFilter);
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [openActionId, setOpenActionId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [viewMode, setViewMode] = useState("active");
  const [deletedRecords, setDeletedRecords] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [updatingSaleStatusId, setUpdatingSaleStatusId] = useState(null);
  const [selectedSaleIds, setSelectedSaleIds] = useState(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const { user } = useAuth();
  const isOwner = user?.role === "owner" || user?.role === "super_admin";
  const canManageSaleStatus = Boolean(
    user?.role === "owner" ||
    user?.role === "super_admin" ||
    user?.permissions?.canManagePayments
  );

  const normalizeSaleStatus = (value) => (value && ["pending", "posted", "reversed"].includes(value)) ? value : "pending";

  const salesSummary = useMemo(() => {
    const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
    const pendingCount = sales.filter((sale) => normalizeSaleStatus(sale.status) === "pending").length;
    const postedCount = sales.filter((sale) => normalizeSaleStatus(sale.status) === "posted").length;
    const reversedCount = sales.filter((sale) => normalizeSaleStatus(sale.status) === "reversed").length;
    const averageTicket = sales.length ? totalRevenue / sales.length : 0;

    return {
      totalRevenue,
      pendingCount,
      postedCount,
      reversedCount,
      averageTicket,
    };
  }, [sales]);

  const salesTrendData = useMemo(() => {
    const totalsByDay = {};

    sales.forEach((sale) => {
      const createdAt = new Date(sale.createdAt);
      const key = createdAt.toISOString().slice(0, 10);
      totalsByDay[key] = (totalsByDay[key] || 0) + Number(sale.totalAmount || 0);
    });

    const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      return {
        label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: totalsByDay[key] || 0,
      };
    });

    const maxValue = Math.max(...lastSevenDays.map((entry) => entry.value), 1);

    return {
      entries: lastSevenDays,
      maxValue,
      latestValue: lastSevenDays[lastSevenDays.length - 1]?.value || 0,
      firstValue: lastSevenDays[0]?.value || 0,
    };
  }, [sales]);

  const topItems = useMemo(() => {
    const itemMap = {};

    sales.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        const name = item?.name || "Unnamed item";
        const quantity = Number(item?.quantity || 1);
        const unitPrice = Number(item?.unitPrice || item?.price || 0);
        const value = quantity * unitPrice || Number(item?.totalAmount || item?.amount || 0) || 0;

        itemMap[name] = {
          name,
          qty: (itemMap[name]?.qty || 0) + quantity,
          value: (itemMap[name]?.value || 0) + value,
        };
      });
    });

    return Object.values(itemMap)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [sales]);

  const trendDelta = useMemo(() => {
    const { firstValue, latestValue } = salesTrendData;
    if (!firstValue && !latestValue) return 0;
    if (!firstValue) return 100;
    return ((latestValue - firstValue) / firstValue) * 100;
  }, [salesTrendData]);

  const dailyComparison = useMemo(() => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const keyFor = (date) => date.toISOString().slice(0, 10);
    const todayKey = keyFor(today);
    const yesterdayKey = keyFor(yesterday);

    const todayValue = sales.reduce((sum, sale) => {
      const saleDate = new Date(sale.createdAt);
      return keyFor(saleDate) === todayKey ? sum + Number(sale.totalAmount || 0) : sum;
    }, 0);

    const yesterdayValue = sales.reduce((sum, sale) => {
      const saleDate = new Date(sale.createdAt);
      return keyFor(saleDate) === yesterdayKey ? sum + Number(sale.totalAmount || 0) : sum;
    }, 0);

    const delta = yesterdayValue === 0 ? (todayValue > 0 ? 100 : 0) : ((todayValue - yesterdayValue) / yesterdayValue) * 100;

    return {
      todayValue,
      yesterdayValue,
      delta,
      isPositive: delta >= 0,
    };
  }, [sales]);

  const paymentBreakdown = useMemo(() => {
    const totals = {};

    sales.forEach((sale) => {
      const method = (sale.paymentMethod || "cash").toLowerCase();
      totals[method] = (totals[method] || 0) + Number(sale.totalAmount || 0);
    });

    const palette = {
      cash: "#10b981",
      card: "#3b82f6",
      bank_transfer: "#8b5cf6",
      credit: "#f59e0b",
      other: "#f97316",
    };

    const entries = Object.entries(totals)
      .map(([method, value]) => ({
        method,
        label: method.replace("_", " "),
        value,
        color: palette[method] || "#64748b",
      }))
      .sort((a, b) => b.value - a.value);

    const total = entries.reduce((sum, item) => sum + item.value, 0) || 1;

    let cursor = 0;
    const withPercent = entries.map((item) => {
      const start = cursor;
      const end = cursor + (item.value / total) * 100;
      cursor = end;
      return { ...item, start, end, percent: ((item.value / total) * 100).toFixed(1) };
    });

    return {
      entries: withPercent,
      total,
      ringStyle: withPercent.length
        ? {
            background: `conic-gradient(${withPercent
              .map((item) => `${item.color} ${item.start}% ${item.end}%`)
              .join(", ")})`,
          }
        : { background: "conic-gradient(#e2e8f0 0 100%)" },
    };
  }, [sales]);

  const topStaff = useMemo(() => {
    const totals = {};

    sales.forEach((sale) => {
      const name = sale.createdBy?.name || "Unknown";
      if (!totals[name]) {
        totals[name] = { name, revenue: 0, sales: 0 };
      }
      totals[name].revenue += Number(sale.totalAmount || 0);
      totals[name].sales += 1;
    });

    return Object.values(totals)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [sales]);

  const metricCards = useMemo(
    () => [
      {
        key: "revenue",
        label: "Gross revenue",
        value: formatCurrency(salesSummary.totalRevenue),
        accent: "from-emerald-500/20 to-emerald-400/10",
        border: "border-emerald-200/70",
        text: "text-emerald-700",
        bg: "bg-emerald-50/90",
        badge: "bg-emerald-500/10 text-emerald-700",
        trend: `${salesSummary.postedCount} posted`,
      },
      {
        key: "pending",
        label: "Pending",
        value: String(salesSummary.pendingCount),
        accent: "from-amber-500/20 to-amber-400/10",
        border: "border-amber-200/70",
        text: "text-amber-700",
        bg: "bg-amber-50/90",
        badge: "bg-amber-500/10 text-amber-700",
        trend: `${salesSummary.reversedCount} reversed`,
      },
      {
        key: "posted",
        label: "Posted",
        value: String(salesSummary.postedCount),
        accent: "from-cyan-500/20 to-cyan-400/10",
        border: "border-cyan-200/70",
        text: "text-cyan-700",
        bg: "bg-cyan-50/90",
        badge: "bg-cyan-500/10 text-cyan-700",
        trend: `${salesSummary.pendingCount} awaiting action`,
      },
      {
        key: "average",
        label: "Average ticket",
        value: formatCurrency(salesSummary.averageTicket),
        accent: "from-violet-500/20 to-violet-400/10",
        border: "border-violet-200/70",
        text: "text-violet-700",
        bg: "bg-violet-50/90",
        badge: "bg-violet-500/10 text-violet-700",
        trend: `${sales.length} sales`,
      },
    ],
    [sales.length, salesSummary]
  );

  const loadSales = async (signal) => {
    try {
      setLoading((currentLoading) => {
        if (currentLoading) return true;
        setRefreshing(true);
        return false;
      });
      const query = new URLSearchParams({ page: String(page), limit: "25" });
      if (deferredSearch.trim()) query.set("search", deferredSearch.trim());

      const data = await request(`/sales?${query.toString()}`, { signal });
      const nextSales = Array.isArray(data) ? data : data?.sales || [];
      setSales(nextSales.map((sale) => ({ ...sale, status: normalizeSaleStatus(sale.status) })));
      if (data?.pagination) setPagination(data.pagination);
    } catch (err) {
      if (err.name !== "AbortError") console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadSales(controller.signal);
    return () => controller.abort();
  }, [page, deferredSearch]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch]);

  useEffect(() => {
    if (isOwner && viewMode === "archived") {
      loadDeletedRecords();
    }
  }, [isOwner, viewMode]);

  const loadDeletedRecords = async () => {
    if (!isOwner) return;

    try {
      setArchiveLoading(true);
      const data = await request("/transactions/deleted-records");
      setDeletedRecords(data);
    } catch (err) {
      console.error(err);
      setDeletedRecords([]);
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await request(`/transactions/${deleteTarget._id}`, { method: "DELETE" });
      setStatusMessage(`Deleted transaction #${deleteTarget.receiptId}`);
      setDeleteTarget(null);
      notifySalesUpdated();
      await loadSales();
      if (viewMode === "archived") {
        await loadDeletedRecords();
      }
    } catch (err) {
      setStatusMessage(err.message || "Unable to delete transaction");
    } finally {
      setDeleting(false);
    }
  };

  const handlePaymentUpdate = async () => {
    if (!paymentTarget) return;
    try {
      setUpdatingPayment(true);
      await request(`/sales/${paymentTarget._id}/payment`, {
        method: "PATCH",
        body: JSON.stringify({ paymentMethod, paymentReference }),
      });
      setPaymentTarget(null);
      setStatusMessage("Payment method updated");
      notifySalesUpdated();
      await loadSales();
    } catch (err) {
      setStatusMessage(err.message || "Unable to update payment method");
    } finally {
      setUpdatingPayment(false);
    }
  };

  const handleSaleStatusUpdate = async (saleId, nextStatus) => {
    if (!saleId || !nextStatus) return;

    try {
      setUpdatingSaleStatusId(saleId);
      const response = await updateSaleStatus(saleId, nextStatus);
      const savedStatus = normalizeSaleStatus(response?.sale?.status || nextStatus);

      setSales((currentSales) => currentSales.map((sale) => (sale._id === saleId ? { ...sale, status: savedStatus } : sale)));
      setStatusMessage(`Sale status updated to ${STATUS_META[savedStatus].label}.`);
      notifySalesUpdated();
    } catch (err) {
      setStatusMessage(err.message || "Unable to update sale status");
    } finally {
      setUpdatingSaleStatusId(null);
    }
  };

  const toggleSaleSelection = (saleId) => {
    setSelectedSaleIds((current) => {
      const next = new Set(current);
      if (next.has(saleId)) {
        next.delete(saleId);
      } else {
        next.add(saleId);
      }
      return next;
    });
  };

  const toggleSelectAllVisibleSales = () => {
    const visibleIds = filteredSales.map((sale) => sale._id);

    setSelectedSaleIds((current) => {
      const next = new Set(current);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => next.has(id));

      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }

      return next;
    });
  };

  const handleBulkSaleStatusUpdate = async (nextStatus) => {
    if (!nextStatus || selectedSaleIds.size === 0) return;

    const selectedCount = selectedSaleIds.size;
    const confirmText = nextStatus === "posted"
      ? `Post ${selectedCount} selected sale${selectedCount > 1 ? "s" : ""}?`
      : `Reverse ${selectedCount} selected sale${selectedCount > 1 ? "s" : ""}?`;

    if (!window.confirm(confirmText)) return;

    try {
      setBulkUpdating(true);
      const response = await bulkUpdateSaleStatus(Array.from(selectedSaleIds), nextStatus);
      const normalizedStatus = normalizeSaleStatus(response?.status || nextStatus);

      setSales((currentSales) =>
        currentSales.map((sale) =>
          selectedSaleIds.has(sale._id)
            ? { ...sale, status: normalizedStatus }
            : sale
        )
      );

      setStatusMessage(`Updated ${response?.updatedCount || selectedSaleIds.size} sales to ${STATUS_META[normalizedStatus].label}.`);
      setSelectedSaleIds(new Set());
      notifySalesUpdated();
    } catch (err) {
      setStatusMessage(err.message || "Unable to update selected sale statuses");
    } finally {
      setBulkUpdating(false);
    }
  };

  const filteredSales = sales;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        Loading sales center...
      </div>
    );
  }

  return (
    <section className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),transparent_26%),radial-gradient(circle_at_right,_rgba(139,92,246,0.12),transparent_22%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-4 md:p-6 dark:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),transparent_26%),radial-gradient(circle_at_right,_rgba(99,102,241,0.18),transparent_22%),linear-gradient(180deg,#020817_0%,#0f172a_100%)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/75 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/75">
          <div className="relative flex flex-col gap-6 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-8">
            <div className="absolute inset-y-0 right-0 hidden w-52 bg-gradient-to-l from-emerald-500/10 to-transparent md:block" />
            <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-400">Sales center</p>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl">Sales history</h1>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">Trend</div>
                  <div className="text-sm font-black text-emerald-700 dark:text-emerald-200">{trendDelta >= 0 ? "+" : ""}{trendDelta.toFixed(1)}%</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-600 dark:bg-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Avg ticket</div>
                  <div className="text-sm font-black text-slate-700 dark:text-slate-100">{formatCurrency(salesSummary.averageTicket)}</div>
                </div>
                <div className="rounded-2xl border border-violet-200 bg-violet-50 px-3 py-1.5 dark:border-violet-500/30 dark:bg-violet-500/10">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">Top item</div>
                  <div className="text-sm font-black text-violet-700 dark:text-violet-200">{topItems[0]?.name || "N/A"}</div>
                </div>
              </div>
            </div>
            <div className="relative flex flex-wrap items-center gap-3">
              {isOwner && (
                <>
                  <button
                    type="button"
                    onClick={() => setViewMode("active")}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${viewMode === "active" ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 dark:bg-emerald-500 dark:text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"}`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("archived")}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${viewMode === "archived" ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 dark:bg-emerald-500 dark:text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"}`}
                  >
                    Archive
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => navigate("/app/pos")}
                className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-[0_18px_30px_rgba(16,185,129,0.35)] transition hover:scale-[1.02] hover:shadow-[0_22px_34px_rgba(16,185,129,0.45)]"
              >
                New sale
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          {metricCards.map((card) => (
            <div
              key={card.key}
              className={`relative overflow-hidden rounded-[26px] border ${card.border} ${card.bg} p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_55px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-slate-900/80`}
            >
              <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-br ${card.accent}`} />
              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{card.label}</p>
                  <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${card.badge}`}>
                    Live
                  </span>
                </div>
                <p className={`mt-5 text-2xl font-black tracking-tight ${card.text} dark:text-slate-100`}>{card.value}</p>
                <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{card.trend}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.7fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-[30px] border border-slate-200/80 bg-white/75 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/75 md:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Revenue pulse</p>
                  <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100">7-day performance</h3>
                </div>
                <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {trendDelta >= 0 ? "+" : ""}{trendDelta.toFixed(1)}%
                </div>
              </div>

              <div className="h-44 rounded-[22px] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 shadow-inner shadow-slate-200/60 dark:border-slate-700 dark:from-slate-950 dark:to-slate-900">
                <svg viewBox="0 0 460 150" className="h-full w-full" preserveAspectRatio="none" aria-label="Seven-day sales chart">
                  <defs>
                    <linearGradient id="salesGlow" x1="0" x2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.32" />
                    </linearGradient>
                  </defs>
                  {[0, 1, 2, 3].map((line) => (
                    <line
                      key={line}
                      x1="0"
                      x2="460"
                      y1={30 + line * 30}
                      y2={30 + line * 30}
                      stroke="currentColor"
                      strokeOpacity="0.12"
                      strokeDasharray="5 8"
                      className="text-slate-400 dark:text-slate-600"
                    />
                  ))}
                  <path
                    d={salesTrendData.entries
                      .map((point, index) => {
                        const x = 20 + (index * 420) / (salesTrendData.entries.length - 1);
                        const y = 125 - (point.value / salesTrendData.maxValue) * 90;
                        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke="url(#salesGlow)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {salesTrendData.entries.map((point, index) => {
                    const x = 20 + (index * 420) / (salesTrendData.entries.length - 1);
                    const y = 125 - (point.value / salesTrendData.maxValue) * 90;
                    return <circle key={point.label} cx={x} cy={y} r="4" fill="#10b981" />;
                  })}
                </svg>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {salesTrendData.entries.map((point) => (
                  <div key={point.label} className="space-y-1">
                    <div>{point.label.split(" ")[0]}</div>
                    <div className="text-[9px] text-slate-400 dark:text-slate-500">{point.label.split(" ")[1]}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[26px] border border-slate-200/80 bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)] dark:border-slate-700">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-300">Today</p>
                <p className="mt-3 text-2xl font-black">{formatCurrency(dailyComparison.todayValue)}</p>
                <p className="mt-2 text-xs text-emerald-300">{dailyComparison.isPositive ? "Up" : "Down"} vs yesterday</p>
              </div>
              <div className="rounded-[26px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_12px_26px_rgba(15,23,42,0.05)] dark:border-slate-700 dark:bg-slate-900/80">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Yesterday</p>
                <p className="mt-3 text-2xl font-black text-slate-900 dark:text-slate-100">{formatCurrency(dailyComparison.yesterdayValue)}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Daily benchmark</p>
              </div>
              <div className="rounded-[26px] border border-emerald-200 bg-emerald-50 p-4 shadow-[0_12px_26px_rgba(74,222,128,0.08)] dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">Delta</p>
                <p className="mt-3 text-2xl font-black text-emerald-700 dark:text-emerald-200">{dailyComparison.isPositive ? "+" : ""}{dailyComparison.delta.toFixed(1)}%</p>
                <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">Performance index</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[30px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/75 md:p-5">
              <div className="mb-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Payment mix</p>
                <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100">Revenue by method</h3>
              </div>

              <div className="flex items-center justify-center py-2">
                <div className="relative flex h-36 w-36 items-center justify-center rounded-full shadow-inner shadow-slate-200 dark:shadow-slate-900" style={paymentBreakdown.ringStyle}>
                  <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full border border-slate-200 bg-white/90 text-center shadow-lg shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-950/90 dark:shadow-slate-950/40">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Total</span>
                    <span className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{formatCurrency(paymentBreakdown.total)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {paymentBreakdown.entries.map((item) => (
                  <div key={item.method} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/80">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm font-semibold capitalize text-slate-700 dark:text-slate-200">{item.label}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900 dark:text-slate-100">{formatCurrency(item.value)}</div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{item.percent}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/75 md:p-5">
              <div className="mb-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">People</p>
                <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100">Top staff</h3>
              </div>

              <div className="space-y-3">
                {topStaff.length ? (
                  topStaff.map((staff, index) => (
                    <div key={staff.name} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/80">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-violet-500 text-sm font-black text-white">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{staff.name}</p>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{staff.sales} sales</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">{formatCurrency(staff.revenue)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    No staff activity yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/75 md:p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Search transactions</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Review sales, payment status, and operational activity</p>
            </div>
            <div className="flex w-full max-w-xl items-center gap-2">
              <div className="relative flex-1">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search receipt, staff, customer or item..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-emerald-500 dark:focus:bg-slate-900 dark:focus:ring-emerald-500/20"
                />
              </div>
            </div>
          </div>

          {canManageSaleStatus && viewMode === "active" && selectedSaleIds.size > 0 && (
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-950/60 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {selectedSaleIds.size} selected
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBulkSaleStatusUpdate("posted")}
                  disabled={bulkUpdating}
                  className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bulkUpdating ? "Updating..." : "Post selected"}
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkSaleStatusUpdate("reversed")}
                  disabled={bulkUpdating}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                >
                  Reverse selected
                </button>
              </div>
            </div>
          )}

          {statusMessage && (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              {statusMessage}
            </div>
          )}

          {refreshing && (
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Updating transactions…</div>
          )}

          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-950/60">
            <div className="hidden grid-cols-[44px_1.25fr_1.5fr_0.9fr_1fr_1fr_1.1fr] gap-0 border-b border-slate-200 bg-slate-100/80 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400 md:grid">
              <div className="flex items-center justify-center px-2 py-3">
                <input
                  type="checkbox"
                  checked={filteredSales.length > 0 && filteredSales.every((sale) => selectedSaleIds.has(sale._id))}
                  onChange={toggleSelectAllVisibleSales}
                  className="h-4 w-4 rounded border-slate-300 accent-emerald-600 dark:border-slate-600"
                  aria-label="Select all visible sales"
                />
              </div>
              <div className="px-4 py-3">Receipt</div>
              <div className="px-4 py-3">Items sold</div>
              <div className="px-4 py-3">Total</div>
              <div className="px-4 py-3">Payment</div>
              <div className="px-4 py-3">Staff</div>
              <div className="px-4 py-3 text-right">Status</div>
            </div>

            {viewMode === "active" ? (
              <>
                {!filteredSales.length && (
                  <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    {sales.length === 0 ? (
                      <>
                        <p className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-200">No sales recorded yet.</p>
                        <button onClick={() => navigate("/app/pos")} className="rounded-full bg-emerald-500 px-4 py-2 font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600">
                          Open POS
                        </button>
                      </>
                    ) : (
                      <p className="dark:text-slate-300">No transactions match your current search.</p>
                    )}
                  </div>
                )}

                {filteredSales.map((sale) => {
                  const saleStatus = normalizeSaleStatus(sale.status);
                  const statusConfig = STATUS_META[saleStatus];

                  return (
                    <div
                      key={sale._id}
                      className="group grid gap-3 border-b border-slate-200 bg-white px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 md:grid-cols-[44px_1.25fr_1.5fr_0.9fr_1fr_1fr_1.1fr] md:items-center md:px-0 md:py-0"
                    >
                      <div className="flex items-center justify-center px-2 py-3 md:py-4">
                        <input
                          type="checkbox"
                          checked={selectedSaleIds.has(sale._id)}
                          onChange={() => toggleSaleSelection(sale._id)}
                          className="h-4 w-4 rounded border-slate-300 accent-emerald-600 dark:border-slate-600"
                          aria-label={`Select sale ${sale.receiptId}`}
                        />
                      </div>

                      <button type="button" onClick={() => navigate(`/app/sales/${sale._id}`)} className="px-4 py-3 text-left md:py-4">
                        <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">#{sale.receiptId}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{new Date(sale.createdAt).toLocaleString()}</div>
                      </button>

                      <div className="px-4 py-3 md:py-4">
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {sale.items?.slice(0, 2).map((item) => item.name).join(", ")}
                          {sale.items?.length > 2 && " ..."}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sale.items?.length || 0} item(s)</div>
                      </div>

                      <div className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-slate-100 md:py-4">{formatCurrency(sale.totalAmount)}</div>

                      <div className="px-4 py-3 md:py-4">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {(sale.paymentMethod || "cash").replace("_", " ")}
                        </span>
                      </div>

                      <div className="px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 md:py-4">
                        {sale.createdBy?.name || "Unknown"}
                      </div>

                      <div className="flex items-center justify-between gap-3 px-4 py-3 md:justify-end md:py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${statusConfig.className}`}>
                          {statusConfig.label}
                        </span>

                        {canManageSaleStatus && (
                          <select
                            value={saleStatus}
                            disabled={updatingSaleStatusId === sale._id}
                            onChange={(event) => handleSaleStatusUpdate(sale._id, event.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 outline-none transition focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-emerald-500"
                            aria-label={`Update sale status for receipt ${sale.receiptId}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="posted">Posted</option>
                            <option value="reversed">Reversed</option>
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                {archiveLoading ? (
                  <div className="p-6 text-sm text-slate-500">Loading deleted records...</div>
                ) : !deletedRecords.length ? (
                  <div className="p-6 text-center text-sm text-slate-500">No deleted records yet.</div>
                ) : (
                  deletedRecords.map((sale) => (
                    <div key={sale._id} className="grid gap-3 border-b border-slate-200 bg-white px-4 py-4 md:grid-cols-[1.1fr_1fr_0.9fr_1fr_0.9fr] md:items-center md:px-0 md:py-0">
                      <div className="px-4 py-3 md:py-4">
                        <div className="text-sm font-black text-slate-800">#{sale.receiptId || sale._id}</div>
                        <div className="mt-1 text-xs text-slate-500">{sale.customerName || "Walk-in"}</div>
                      </div>
                      <div className="px-4 py-3 text-xs text-slate-500 md:py-4">{sale.deletedAt ? new Date(sale.deletedAt).toLocaleString() : "—"}</div>
                      <div className="px-4 py-3 text-sm font-bold text-slate-900 md:py-4">{formatCurrency(sale.totalAmount)}</div>
                      <div className="px-4 py-3 text-sm text-slate-600 md:py-4">{sale.deletedBy || "Owner"}</div>
                      <div className="px-4 py-3 md:py-4">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">Deleted</span>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>

          {viewMode === "active" && pagination.totalPages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
              <span className="text-sm text-slate-500 dark:text-slate-400">Showing {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}</span>
              <div className="flex gap-2">
                <button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">Previous</button>
                <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-xl dark:bg-rose-500/10">🗑️</div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Archive this receipt?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">This action is owner-only and can be undone later from the archive.</p>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-slate-100">Receipt #{deleteTarget.receiptId}</p>
              <p>{formatCurrency(deleteTarget.totalAmount)} • {new Date(deleteTarget.createdAt).toLocaleString()}</p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-600 dark:text-slate-300">
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={deleting} className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {deleting ? "Archiving..." : "Archive Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Correct payment method</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Receipt #{paymentTarget.receiptId}</p>
            <div className="mt-5 space-y-3">
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="credit">Credit / debt</option>
                <option value="other">Other</option>
              </select>
              {paymentMethod !== "cash" && paymentMethod !== "credit" && (
                <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Reference (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-400" />
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setPaymentTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-600 dark:text-slate-300">Cancel</button>
              <button type="button" onClick={handlePaymentUpdate} disabled={updatingPayment} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-emerald-500 dark:text-slate-950">{updatingPayment ? "Saving..." : "Save correction"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Sales;