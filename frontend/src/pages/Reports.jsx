import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { getReport, REPORT_TYPES } from "../api/reportApi.js";
import { updateTransactionStatus } from "../api/transactions.js";
import StatusToast from "../components/StatusToast.jsx";
import { formatCurrency } from "../utils/formatters.js";
import { notifySalesUpdated, subscribeToSalesUpdates } from "../utils/salesEvents.js";

const PERIOD_OPTIONS = [
  { value: "7", label: "7D" },
  { value: "30", label: "30D" },
  { value: "90", label: "90D" },
  { value: "all", label: "All" },
];

const PRESET_DATES = [
  { label: "Today", getValue: () => {
    const d = new Date();
    return { start: new Date(d.getFullYear(), d.getMonth(), d.getDate()), end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59) };
  }},
  { label: "Yesterday", getValue: () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return { start: new Date(d.getFullYear(), d.getMonth(), d.getDate()), end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59) };
  }},
  { label: "This Week", getValue: () => {
    const d = new Date();
    const first = d.getDate() - d.getDay();
    return { start: new Date(d.getFullYear(), d.getMonth(), first), end: new Date() };
  }},
  { label: "This Month", getValue: () => {
    const d = new Date();
    return { start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date() };
  }},
  { label: "Last 30 Days", getValue: () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, end };
  }},
];

const WIDGET_CONFIG_KEY = "reports_widget_config";

const DEFAULT_WIDGET_CONFIG = {
  executiveCards: true,
  paymentBreakdown: true,
  hourlyHeatmap: true,
  forecast: true,
  transactionLog: true,
  staffLeaderboard: true,
  categoryTrends: true,
};

const Reports = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("30");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [transactionFilter, setTransactionFilter] = useState("all");
  const [transactionStatusFilter, setTransactionStatusFilter] = useState("all");
  const [compareToLastPeriod, setCompareToLastPeriod] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedStaff, setSelectedStaff] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [timelineSearch, setTimelineSearch] = useState("");
  const deferredTimelineSearch = useDeferredValue(timelineSearch);
  const [timelinePage, setTimelinePage] = useState(1);
  const [updatingTransactionId, setUpdatingTransactionId] = useState(null);
  const [transactionStatusNotice, setTransactionStatusNotice] = useState(null);
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().slice(0, 10));
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("bms_user") || "null");
    } catch {
      return null;
    }
  }, []);
  const canManageTransactionStatus = Boolean(
    currentUser?.role === "owner" ||
    currentUser?.role === "super_admin" ||
    currentUser?.permissions?.canManagePayments
  );
  const [dailyAnalysis, setDailyAnalysis] = useState(null);
  const [summaryMode, setSummaryMode] = useState("daily");
  const [showCustomizationMenu, setShowCustomizationMenu] = useState(false);
  const [widgetVisibility, setWidgetVisibility] = useState(() => {
    const stored = localStorage.getItem(WIDGET_CONFIG_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_WIDGET_CONFIG;
  });
  const [showEmailScheduler, setShowEmailScheduler] = useState(false);
  const [emailSchedule, setEmailSchedule] = useState({
    enabled: false,
    frequency: "daily",
    sendTime: "20:00",
    recipients: [],
    newRecipient: "",
  });

  const loadReports = async (signal) => {
    try {
      const data = await getReport(REPORT_TYPES.overview, { period, signal });
      setReports(data);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  // Save widget configuration to localStorage
  const toggleWidgetVisibility = (widget) => {
    const updated = { ...widgetVisibility, [widget]: !widgetVisibility[widget] };
    setWidgetVisibility(updated);
    localStorage.setItem(WIDGET_CONFIG_KEY, JSON.stringify(updated));
  };

  // Handle email schedule settings
  const handleAddRecipient = () => {
    if (emailSchedule.newRecipient.trim()) {
      setEmailSchedule({
        ...emailSchedule,
        recipients: [...emailSchedule.recipients, emailSchedule.newRecipient.trim()],
        newRecipient: "",
      });
    }
  };

  const handleRemoveRecipient = (email) => {
    setEmailSchedule({
      ...emailSchedule,
      recipients: emailSchedule.recipients.filter(r => r !== email),
    });
  };

  const handleSaveEmailSchedule = async () => {
    try {
      const response = await fetch("/api/reports/schedule-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: emailSchedule.enabled,
          frequency: emailSchedule.frequency,
          sendTime: emailSchedule.sendTime,
          recipients: emailSchedule.recipients,
        }),
      });

      if (response.ok) {
        alert("Email schedule saved successfully!");
        setShowEmailScheduler(false);
      } else {
        alert("Failed to save email schedule");
      }
    } catch (err) {
      console.error("Error saving email schedule:", err);
      alert("Error saving email schedule: " + err.message);
    }
  };

  const handlePresetDate = (preset) => {
    const dates = preset.getValue();
    setStartDate(dates.start);
    setEndDate(dates.end);
    setShowCustomDatePicker(false);
  };

  const formatDateRange = () => {
    if (!startDate) return "Select dates";
    const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: startDate.getFullYear() !== endDate?.getFullYear() ? "numeric" : undefined });
    const start = fmt.format(startDate);
    const end = endDate ? fmt.format(endDate) : start;
    return startDate.toDateString() === endDate?.toDateString() ? start : `${start} - ${end}`;
  };

  const updateLocalTransactionStatus = (transactionId, nextStatus) => {
    setReports((prev) => {
      if (!prev?.raw) return prev;

      const nextRaw = { ...prev.raw };
      if (Array.isArray(nextRaw.transactions)) {
        nextRaw.transactions = nextRaw.transactions.map((tx) => tx._id === transactionId ? { ...tx, status: nextStatus } : tx);
      }
      if (Array.isArray(nextRaw.sales)) {
        nextRaw.sales = nextRaw.sales.map((tx) => tx._id === transactionId ? { ...tx, status: nextStatus } : tx);
      }

      return { ...prev, raw: nextRaw };
    });
  };

  const handleTransactionStatusChange = async (transaction, nextStatus) => {
    if (!transaction?._id || !nextStatus || nextStatus === transaction.status) return;

    const normalizedNextStatus = nextStatus === "completed" || nextStatus === "paid" ? "posted" : nextStatus;
    const previousStatus = transaction.status === "completed" || transaction.status === "paid" ? "posted" : (transaction.status || "pending");

    if (normalizedNextStatus === previousStatus) return;

    setUpdatingTransactionId(transaction._id);
    setTransactionStatusNotice({ type: "info", text: `Updating transaction to ${normalizedNextStatus}...` });

    try {
      const response = await updateTransactionStatus(transaction._id, normalizedNextStatus);
      const savedStatus = response?.transaction?.status || normalizedNextStatus;
      updateLocalTransactionStatus(transaction._id, savedStatus);
      notifySalesUpdated();
      setTransactionStatusNotice({
        type: "success",
        text: `Transaction status saved as ${savedStatus.charAt(0).toUpperCase() + savedStatus.slice(1)}.`
      });
    } catch (err) {
      setTransactionStatusNotice({
        type: "error",
        text: err.message || "Failed to update transaction status."
      });
    } finally {
      setUpdatingTransactionId(null);
      window.setTimeout(() => {
        setTransactionStatusNotice((current) => current && current.type === "success" ? null : current);
      }, 3000);
    }
  };

  const hideTransactionStatusNotice = () => setTransactionStatusNotice(null);

  const getProductStatusLabel = (product) => {
    if (product?.isService || product?.itemType === "service") {
      return "Service performance";
    }

    if (product?.stock > 5) return "Good stock";
    if (product?.stock > 0) return "Low stock";
    return "Out of stock";
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (timelineTransactions.length === 0) {
      alert("No transactions to export");
      return;
    }

    const headers = ["Date", "Time", "Reference ID", "Type", "Category", "Staff", "Payment Method", "Amount"];
    const rows = timelineTransactions.map((tx) => {
      const date = new Date(tx.createdAt);
      return [
        date.toLocaleDateString("en-US"),
        date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        tx.receiptId || tx._id?.slice(-6),
        tx.type === "expense" ? "Expense" : "Sale",
        tx.category || "General",
        tx.createdBy?.name || "System",
        tx.paymentMethod || "Unknown",
        Number(tx.totalAmount || tx.amount || 0),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Reports_${formatDateRange().replace(/\s/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Print report
  const handlePrintReport = () => {
    const printWindow = window.open("", "_blank");
    const reportContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reports - ${formatDateRange()}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1e293b; background: white; line-height: 1.6; }
          .container { max-width: 1000px; margin: 0 auto; padding: 40px 20px; }
          .header { margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
          .header h1 { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
          .header p { font-size: 14px; color: #64748b; }
          .date-range { font-size: 14px; color: #0ea5e9; font-weight: 600; margin-top: 10px; }
          .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
          .metric-card { border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; }
          .metric-label { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
          .metric-value { font-size: 20px; font-weight: bold; color: #1e293b; margin: 10px 0; }
          .metric-caption { font-size: 12px; color: #94a3b8; }
          .table-section { margin-bottom: 30px; }
          .table-section h2 { font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #1e293b; }
          table { width: 100%; border-collapse: collapse; }
          table th { background: #f1f5f9; padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
          table td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          table tr:nth-child(even) { background: #f8fafc; }
          .text-right { text-align: right; }
          .text-success { color: #16a34a; }
          .text-danger { color: #dc2626; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
          @media print { body { margin: 0; padding: 0; } }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Business Reports</h1>
            <p>Period-over-Period Financial Summary</p>
            <div class="date-range">📅 ${formatDateRange()}</div>
          </div>

          <div class="metrics">
            <div class="metric-card">
              <div class="metric-label">Gross Revenue</div>
              <div class="metric-value">${formatCurrency(auditMetrics.grossRevenue)}</div>
              <div class="metric-caption">Total sales amount</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">COGS</div>
              <div class="metric-value">${formatCurrency(auditMetrics.cogs)}</div>
              <div class="metric-caption">Cost of goods sold</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Gross Profit</div>
              <div class="metric-value">${formatCurrency(auditMetrics.grossProfit)}</div>
              <div class="metric-caption">Revenue - COGS</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Operating Expenses</div>
              <div class="metric-value">${formatCurrency(auditMetrics.operatingExpenses)}</div>
              <div class="metric-caption">Business costs</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Net Profit</div>
              <div class="metric-value">${formatCurrency(auditMetrics.netProfit)}</div>
              <div class="metric-caption">Final bottom line</div>
            </div>
          </div>

          <div class="table-section">
            <h2>Transaction Summary</h2>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Staff</th>
                  <th>Payment Method</th>
                  <th class="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${timelineTransactions.slice(0, 50).map((tx) => {
                  const date = new Date(tx.createdAt);
                  return `
                    <tr>
                      <td>${date.toLocaleDateString("en-US")}</td>
                      <td>${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td>#${tx.receiptId || tx._id?.slice(-6)}</td>
                      <td>${tx.type === "expense" ? "Expense" : "Sale"}</td>
                      <td>${tx.createdBy?.name || "System"}</td>
                      <td>${tx.paymentMethod || "Unknown"}</td>
                      <td class="text-right">${formatCurrency(tx.totalAmount || tx.amount || 0)}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>

          <div class="footer">
            <p>Report generated on ${new Date().toLocaleString("en-US")} | Marthington BMS</p>
          </div>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(reportContent);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  useEffect(() => {
    const controller = new AbortController();
    loadReports(controller.signal);

    const unsubscribe = subscribeToSalesUpdates(() => {
      loadReports(controller.signal);
    });

    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [period]);

  useEffect(() => {
    const controller = new AbortController();
    getReport(REPORT_TYPES.dailyAnalysis, { date: dailyDate, signal: controller.signal })
      .then(setDailyAnalysis)
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message || "Failed to load daily analysis");
      });
    return () => controller.abort();
  }, [dailyDate]);

  const overview = reports?.overview || {};
  const recentSales = reports?.recentSales || [];
  const allTransactions = reports?.raw?.transactions || [];
  const reportSales = reports?.raw?.sales || recentSales;
  const reportTransactions = allTransactions.map((transaction) => ({
    ...transaction,
    type: "expense",
    createdAt: transaction.occurredAt || transaction.createdAt,
  }));
  const reportActivity = [
    ...reportSales.map((sale) => ({ ...sale, type: "sale" })),
    ...reportTransactions,
  ];

  // Filter transactions by date range
  const transactionsByDateRange = useMemo(() => {
    const sales = reportActivity;
    const startCheck = startDate || new Date(new Date().setDate(new Date().getDate() - 30));
    const endCheck = endDate || new Date();

    return sales.filter((sale) => {
      const saleDate = new Date(sale.createdAt);
      return saleDate >= startCheck && saleDate <= endCheck;
    });
  }, [reports, startDate, endDate]);

  const filteredSales = useMemo(() => {
    const sales = reportSales;
    if (period === "all") return sales;

    const days = Number(period) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return sales.filter((sale) => new Date(sale.createdAt) >= cutoff);
  }, [reports, period]);

  // Extract available filter options
  const availableBranches = useMemo(() => {
    const sales = reportSales;
    const branches = [...new Set(sales.map(s => s.branch || "Main Branch"))];
    return branches.filter(b => b);
  }, [reports]);

  const availableStaff = useMemo(() => {
    const sales = reportSales;
    const staff = [...new Set(sales.map(s => s.createdBy?.name).filter(n => n))];
    return staff;
  }, [reports]);

  const availableCategories = useMemo(() => {
    const sales = reportSales;
    const categories = [...new Set(sales.flatMap(s => (s.items || []).map(i => i.category || "General")))];
    return categories.filter(c => c);
  }, [reports]);

  // Multi-dimensional filtered transactions
  const multiDimensionalFiltered = useMemo(() => {
    let filtered = transactionsByDateRange;

    if (selectedBranch !== "all") {
      filtered = filtered.filter(t => (t.branch || t.branchId || "Main Branch") === selectedBranch);
    }

    if (selectedStaff !== "all") {
      filtered = filtered.filter(t => t.createdBy?.name === selectedStaff);
    }

    if (selectedCategory !== "all") {
      filtered = filtered.filter(t => {
        if (t.type === "expense") return (t.category || "general") === selectedCategory;
        return (t.items || []).some(item => (item.category || "General") === selectedCategory);
      });
    }

    if (selectedPaymentMethod !== "all") {
      filtered = filtered.filter(t => t.type === "expense" || (t.paymentMethod || "cash").toLowerCase() === selectedPaymentMethod);
    }

    return filtered;
  }, [transactionsByDateRange, selectedBranch, selectedStaff, selectedCategory, selectedPaymentMethod]);

  // 7-day moving average calculation
  const movingAverageData = useMemo(() => {
    const sales = filteredSales.length ? filteredSales : reportSales;
    const dailyData = new Map();

    sales.forEach(sale => {
      const d = new Date(sale.createdAt);
      const key = d.toISOString().slice(0, 10);
      if (!dailyData.has(key)) {
        dailyData.set(key, 0);
      }
      dailyData.set(key, dailyData.get(key) + (Number(sale.totalAmount) || 0));
    });

    const sortedDays = [...dailyData.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const movingAvg = [];

    for (let i = 0; i < sortedDays.length; i++) {
      const window = sortedDays.slice(Math.max(0, i - 6), i + 1);
      const avg = window.reduce((sum, [_, val]) => sum + val, 0) / window.length;
      movingAvg.push({ date: sortedDays[i][0], revenue: sortedDays[i][1], movingAvg: avg });
    }

    return movingAvg;
  }, [filteredSales, reportSales]);

  // 30-day predictive forecast
  const forecastData = useMemo(() => {
    if (movingAverageData.length < 7) {
      return { forecast: [], currentAvg: 0, monthlyProjection: 0 };
    }

    const lastAvg = movingAverageData[movingAverageData.length - 1].movingAvg;
    const today = new Date();
    const forecast = [];

    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const trendAdjustment = 0.92 + ((i % 7) * 0.02);
      forecast.push({
        date: date.toISOString().slice(0, 10),
        dateLabel: `Day ${i}`,
        projected: lastAvg * trendAdjustment,
        trend: lastAvg,
      });
    }

    const monthlyProjection = forecast.reduce((sum, day) => sum + day.projected, 0);

    return { forecast, currentAvg: lastAvg, monthlyProjection };
  }, [movingAverageData]);

  // Audit Metrics for selected date range
  const auditMetrics = useMemo(() => {
    const sales = multiDimensionalFiltered;
    const grossRevenue = sales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
    const cogs = sales.reduce((sum, s) => {
      const itemsCost = (s.items || []).reduce((itemSum, item) => itemSum + ((Number(item.costPrice) || 0) * (Number(item.quantity) || 0)), 0);
      return sum + itemsCost;
    }, 0);
    const grossProfit = grossRevenue - cogs;
    const operatingExpenses = reportTransactions
      .filter((transaction) => new Date(transaction.createdAt) >= (startDate || new Date(new Date().setDate(new Date().getDate() - 30))) && new Date(transaction.createdAt) <= (endDate || new Date()))
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const netProfit = grossProfit - operatingExpenses;

    return { grossRevenue, cogs, grossProfit, operatingExpenses, netProfit };
  }, [multiDimensionalFiltered, reportTransactions, startDate, endDate]);

  // Payment methods breakdown
  const paymentMethodsBreakdown = useMemo(() => {
    const sales = multiDimensionalFiltered;
    const breakdown = {
      cash: 0,
      card: 0,
      bank_transfer: 0,
      credit: 0,
      other: 0,
    };

    sales.forEach((sale) => {
      const method = (sale.paymentMethod || "cash").toLowerCase();
      if (breakdown.hasOwnProperty(method)) {
        breakdown[method] += Number(sale.totalAmount || 0);
      }
    });

    return breakdown;
  }, [multiDimensionalFiltered]);

  // Previous period metrics for comparison
  const previousPeriodMetrics = useMemo(() => {
    if (!compareToLastPeriod || !startDate || !endDate) return null;

    const periodLength = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
    const prevStart = new Date(startDate);
    prevStart.setDate(prevStart.getDate() - periodLength);
    const prevEnd = new Date(startDate);

    const sales = (reports?.recentSales || []).filter((sale) => {
      const saleDate = new Date(sale.createdAt);
      return saleDate >= prevStart && saleDate < prevEnd;
    });

    const grossRevenue = sales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
    const cogs = sales.reduce((sum, s) => {
      const itemsCost = (s.items || []).reduce((itemSum, item) => itemSum + ((Number(item.costPrice) || 0) * (Number(item.quantity) || 0)), 0);
      return sum + itemsCost;
    }, 0);
    const grossProfit = grossRevenue - cogs;
    const operatingExpenses = reportTransactions
      .filter((transaction) => new Date(transaction.createdAt) >= prevStart && new Date(transaction.createdAt) < prevEnd)
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const netProfit = grossProfit - operatingExpenses;

    return { grossRevenue, cogs, grossProfit, operatingExpenses, netProfit };
  }, [compareToLastPeriod, startDate, endDate, reportSales, reportTransactions]);

  // Calculate variance percentages
  const varianceMetrics = useMemo(() => {
    if (!previousPeriodMetrics || !compareToLastPeriod) return null;

    const calcVariance = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / Math.abs(previous)) * 100;
    };

    return {
      revenue: calcVariance(auditMetrics.grossRevenue, previousPeriodMetrics.grossRevenue),
      expenses: calcVariance(auditMetrics.operatingExpenses, previousPeriodMetrics.operatingExpenses),
      profit: calcVariance(auditMetrics.netProfit, previousPeriodMetrics.netProfit),
    };
  }, [previousPeriodMetrics, auditMetrics, compareToLastPeriod]);

  // Hourly peak sales heatmap data
  const hourlyPeakData = useMemo(() => {
    const hourlyMap = {};
    for (let i = 8; i <= 20; i++) {
      hourlyMap[i] = { hour: `${i % 12 || 12}${i >= 12 ? "PM" : "AM"}`, transactions: 0, revenue: 0 };
    }

    multiDimensionalFiltered.forEach((sale) => {
      const saleDate = new Date(sale.createdAt);
      const hour = saleDate.getHours();
      if (hour >= 8 && hour <= 20 && sale.type !== "expense") {
        if (!hourlyMap[hour]) {
          hourlyMap[hour] = { hour: `${hour % 12 || 12}${hour >= 12 ? "PM" : "AM"}`, transactions: 0, revenue: 0 };
        }
        hourlyMap[hour].transactions += 1;
        hourlyMap[hour].revenue += Number(sale.totalAmount || 0);
      }
    });

    return Object.entries(hourlyMap)
      .sort(([hourA], [hourB]) => Number(hourA) - Number(hourB))
      .map(([, value]) => value);
  }, [multiDimensionalFiltered]);

  // Filtered transactions for timeline
  const timelineTransactions = useMemo(() => {
    let transactions = multiDimensionalFiltered;
    
    if (transactionFilter === "sales") {
      transactions = transactions.filter(t => t.type !== "expense" && t.type !== "return");
    } else if (transactionFilter === "expenses") {
      transactions = transactions.filter(t => t.type === "expense");
    }

    if (transactionStatusFilter !== "all") {
      transactions = transactions.filter((transaction) => {
        const normalizedStatus = transaction.status === "completed" || transaction.status === "paid" ? "posted" : (transaction.status || "pending");
        return normalizedStatus === transactionStatusFilter;
      });
    }

    if (deferredTimelineSearch.trim()) {
      const query = deferredTimelineSearch.trim().toLowerCase();
      transactions = transactions.filter((transaction) => [
        transaction.receiptId,
        transaction.createdBy?.name,
        transaction.category,
        transaction.paymentMethod,
      ].some((value) => String(value || "").toLowerCase().includes(query)));
    }

    return transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [multiDimensionalFiltered, transactionFilter, transactionStatusFilter, deferredTimelineSearch]);

  const timelinePageSize = 20;
  const paginatedTimelineTransactions = useMemo(
    () => timelineTransactions.slice((timelinePage - 1) * timelinePageSize, timelinePage * timelinePageSize),
    [timelineTransactions, timelinePage]
  );

  useEffect(() => {
    setTimelinePage(1);
  }, [deferredTimelineSearch, transactionFilter, transactionStatusFilter, selectedBranch, selectedStaff, selectedCategory, selectedPaymentMethod, startDate, endDate]);

  // Staff performance leaderboard
  const staffLeaderboard = useMemo(() => {
    const sales = multiDimensionalFiltered;
    const staffMap = new Map();
    const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);

    sales.forEach((sale) => {
      const staffName = sale.createdBy?.name || "Unknown";
      if (!staffMap.has(staffName)) {
        staffMap.set(staffName, {
          name: staffName,
          totalSales: 0,
          transactionCount: 0,
          totalAmount: 0,
        });
      }

      const staff = staffMap.get(staffName);
      staff.totalSales += Number(sale.totalAmount || 0);
      staff.transactionCount += 1;
      staff.totalAmount += Number(sale.totalAmount || 0);
    });

    return [...staffMap.values()]
      .map((staff) => ({
        ...staff,
        avgOrderValue: staff.transactionCount > 0 ? staff.totalSales / staff.transactionCount : 0,
        estimatedCommission: staff.totalSales * 0.05, // 5% commission
        revenuePercentage: totalRevenue > 0 ? (staff.totalSales / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.totalSales - a.totalSales);
  }, [multiDimensionalFiltered]);

  // Category revenue distribution
  const categoryTrends = useMemo(() => {
    const sales = multiDimensionalFiltered;
    const categoryMap = new Map();
    const productMap = new Map();
    const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#f97316", "#6366f1"];

    sales.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        const category = item.category || "General";
        const productKey = item.name || "Unknown Item";

        // Category aggregation
        if (!categoryMap.has(category)) {
          categoryMap.set(category, { name: category, value: 0, count: 0 });
        }
        const cat = categoryMap.get(category);
        cat.value += Number(item.sellingPrice || 0) * (Number(item.quantity) || 1);
        cat.count += Number(item.quantity) || 1;

        // Product aggregation
        if (!productMap.has(productKey)) {
          productMap.set(productKey, {
            name: productKey,
            unitsSold: 0,
            totalRevenue: 0,
            isService: item.itemType === "service",
            stock: item.stock || 0,
          });
        }
        const prod = productMap.get(productKey);
        prod.isService = prod.isService && item.itemType === "service";
        prod.unitsSold += Number(item.quantity) || 1;
        prod.totalRevenue += Number(item.sellingPrice || 0) * (Number(item.quantity) || 1);
      });
    });

    const categories = [...categoryMap.values()]
      .map((cat, idx) => ({
        ...cat,
        fill: COLORS[idx % COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);

    const topProducts = [...productMap.values()]
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 5);

    return { categories, topProducts };
  }, [multiDimensionalFiltered]);

  const salesChartData = useMemo(() => {
    const source = filteredSales.length ? filteredSales : reports?.recentSales || [];
    const bucketMap = new Map();

    source.forEach((sale) => {
      const d = new Date(sale.createdAt);
      const key = d.toISOString().slice(0, 10);
      const label = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);

      if (!bucketMap.has(key)) {
        bucketMap.set(key, { key, label, revenue: 0, profit: 0 });
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
    () => {
      const expenseByDate = reportTransactions.reduce((totals, transaction) => {
        const key = new Date(transaction.createdAt).toISOString().slice(0, 10);
        totals[key] = (totals[key] || 0) + Number(transaction.amount || 0);
        return totals;
      }, {});

      return salesChartData.map((item) => ({
        label: item.label,
        revenue: Number(item.revenue || 0),
        expenses: Number(expenseByDate[item.key] || 0),
        profit: Number(item.profit || 0),
      }));
    },
    [salesChartData, reportTransactions]
  );

  const summaryCards = useMemo(() => {
    if (summaryMode === "daily") {
      return [
        ["Sales", dailyAnalysis?.summary?.revenue],
        ["COGS", dailyAnalysis?.summary?.cogs],
        ["Gross profit", dailyAnalysis?.summary?.grossProfit],
        ["Expenses", dailyAnalysis?.summary?.expenses],
        ["Net result", dailyAnalysis?.summary?.netProfit],
      ];
    }

    const isMonthly = summaryMode === "monthly";
    return [
      ["Sales", isMonthly ? overview.monthlyRevenue : overview.periodRevenue],
      ["Gross profit", isMonthly ? overview.monthlyGrossProfit : overview.periodGrossProfit],
      ["Expenses", isMonthly ? overview.monthlyOperatingExpenses : overview.periodOperatingExpenses],
      ["Net result", isMonthly ? overview.monthlyProfit : overview.periodProfit],
      ["Sales count", filteredSales.length],
    ];
  }, [summaryMode, dailyAnalysis, overview, filteredSales]);

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
    <section className="page-stack reports-hub dark:text-slate-100">
      <div className="page-heading dark:border-slate-700 dark:bg-slate-900/80">
        <div className="flex items-center justify-between">
          <div>
            <span className="section-eyebrow dark:text-emerald-300">
              <span className="status-dot" />
              Business Intelligence
            </span>
            <h1 className="dark:text-slate-100">Reports Hub</h1>
          </div>
          <div className="flex gap-2 relative">
            <button
              onClick={() => setShowCustomizationMenu(!showCustomizationMenu)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              ⚙️ Customize View
            </button>

            {/* Customization Dropdown Menu */}
            {showCustomizationMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900 z-50">
                <div className="p-4">
                  <div className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-300">Toggle Widgets</div>
                  <div className="space-y-2">
                    {[
                      { key: "executiveCards", label: "Executive P&L Cards" },
                      { key: "paymentBreakdown", label: "Payment Channel Breakdown" },
                      { key: "hourlyHeatmap", label: "Hourly Traffic Heatmap" },
                      { key: "forecast", label: "30-Day Predictive Forecast" },
                      { key: "staffLeaderboard", label: "Staff Leaderboard" },
                      { key: "categoryTrends", label: "Category & Product Trends" },
                      { key: "transactionLog", label: "Transaction Audit Log" },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={widgetVisibility[key]}
                          onChange={() => toggleWidgetVisibility(key)}
                          className="h-4 w-4 rounded border-slate-300 accent-emerald-500 dark:border-slate-600"
                        />
                        <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleExportCSV}
              disabled={!startDate || timelineTransactions.length === 0}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              📥 Export CSV
            </button>
            <button
              onClick={() => setShowEmailScheduler(!showEmailScheduler)}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              ✉️ Scheduled Reports
            </button>
            <button
              onClick={handlePrintReport}
              disabled={!startDate || timelineTransactions.length === 0}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
            >
              🖨️ Print
            </button>
          </div>
        </div>
      </div>

      {error && <div className="form-error dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50">{error}</div>}

      <StatusToast
        message={transactionStatusNotice?.text}
        type={transactionStatusNotice?.type || "success"}
        visible={Boolean(transactionStatusNotice)}
        onClose={hideTransactionStatusNotice}
      />

      {/* EMAIL SCHEDULER MODAL */}
      {showEmailScheduler && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">✉️ Schedule Email Reports</h3>
              <button
                onClick={() => setShowEmailScheduler(false)}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Enable Toggle */}
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={emailSchedule.enabled}
                  onChange={(e) => setEmailSchedule({ ...emailSchedule, enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 accent-emerald-500 dark:border-slate-600"
                />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Enable Email Scheduling</span>
              </label>

              {emailSchedule.enabled && (
                <>
                  {/* Frequency Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Frequency
                    </label>
                    <select
                      value={emailSchedule.frequency}
                      onChange={(e) => setEmailSchedule({ ...emailSchedule, frequency: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="daily">Daily (End of Day)</option>
                      <option value="weekly">Weekly Summary</option>
                    </select>
                  </div>

                  {/* Time Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Send Time
                    </label>
                    <input
                      type="time"
                      value={emailSchedule.sendTime}
                      onChange={(e) => setEmailSchedule({ ...emailSchedule, sendTime: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  {/* Email Recipients */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Recipients
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="email"
                        value={emailSchedule.newRecipient}
                        onChange={(e) => setEmailSchedule({ ...emailSchedule, newRecipient: e.target.value })}
                        placeholder="Enter email address"
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      />
                      <button
                        onClick={handleAddRecipient}
                        className="px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                      >
                        Add
                      </button>
                    </div>

                    {/* Recipients List */}
                    {emailSchedule.recipients.length > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 space-y-2">
                        {emailSchedule.recipients.map((email) => (
                          <div key={email} className="flex items-center justify-between text-sm">
                            <span className="text-slate-700 dark:text-slate-300">{email}</span>
                            <button
                              onClick={() => handleRemoveRecipient(email)}
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-semibold"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Buttons */}
            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => setShowEmailScheduler(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEmailSchedule}
                disabled={emailSchedule.enabled && emailSchedule.recipients.length === 0}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DATE RANGE & CALENDAR BAR */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">Date Range Selection</span>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={compareToLastPeriod}
                onChange={(e) => setCompareToLastPeriod(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-emerald-500 dark:border-slate-600"
              />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Compare to Previous</span>
            </label>
            <button 
              onClick={() => setShowCustomDatePicker(!showCustomDatePicker)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              {showCustomDatePicker ? "Close" : "Custom"}
            </button>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mb-4 flex flex-wrap gap-2">
          {PRESET_DATES.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePresetDate(preset)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom Date Picker */}
        {showCustomDatePicker && (
          <div className="mb-4 flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Start Date</label>
              <input 
                type="date" 
                value={startDate ? startDate.toISOString().split('T')[0] : ''}
                onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : null)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">End Date</label>
              <input 
                type="date" 
                value={endDate ? endDate.toISOString().split('T')[0] : ''}
                onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : null)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
          </div>
        )}

        {/* Selected Date Display */}
        <div className="inline-block rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-900/20">
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">📅 {formatDateRange()}</span>
        </div>
      </div>

      {/* MULTI-DIMENSION FILTER TOOLBAR */}
      <div className="reports-filter-shell mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">Filter drawer</span>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{[selectedBranch !== "all", selectedStaff !== "all", selectedCategory !== "all", selectedPaymentMethod !== "all"].filter(Boolean).length || "No"} filters active</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((visible) => !visible)}
            aria-expanded={showAdvancedFilters}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {showAdvancedFilters ? "Hide filters" : "Show filters"}
          </button>
        </div>
        {showAdvancedFilters && <div className="reports-filter-grid mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Branch Filter */}
          <div className="reports-filter-field">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Branch</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="all">All Branches</option>
              {availableBranches.map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>

          {/* Staff Filter */}
          <div className="reports-filter-field">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Staff / Cashier</label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="all">All Staff</option>
              {availableStaff.map((staff) => (
                <option key={staff} value={staff}>{staff}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="reports-filter-field">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Product Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="all">All Categories</option>
              {availableCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div className="reports-filter-field">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Payment method</label>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="all">All methods</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="credit">Credit / debt</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>}
        {(selectedBranch !== "all" || selectedStaff !== "all" || selectedCategory !== "all" || selectedPaymentMethod !== "all") && (
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Filters active: {[selectedBranch !== "all" && `Branch: ${selectedBranch}`, selectedStaff !== "all" && `Staff: ${selectedStaff}`, selectedCategory !== "all" && `Category: ${selectedCategory}`, selectedPaymentMethod !== "all" && `Payment: ${selectedPaymentMethod}`].filter(Boolean).join(" • ")}
          </div>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">Daily analysis</span>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Revenue less cost of goods and operating expenses.</p>
          </div>
          <input
            type="date"
            value={dailyDate}
            onChange={(e) => setDailyDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-100 pb-3 dark:border-slate-700">
          {["daily", "monthly", "period"].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSummaryMode(mode)}
              className={`rounded-lg px-3 py-2 text-xs font-bold capitalize ${summaryMode === mode ? "bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-900" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
            >
              {mode === "period" ? "Selected period" : mode}
            </button>
          ))}
          <div className="ml-auto flex flex-wrap gap-1">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => { setPeriod(option.value); setStartDate(null); setEndDate(null); }}
                className={`rounded-lg px-2 py-1 text-[11px] font-bold ${period === option.value && !startDate ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {summaryCards.map(([label, value], index) => (
            <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
              <div className={`mt-2 text-lg font-black ${index === summaryCards.length - 1 ? "text-blue-600 dark:text-blue-400" : index === 2 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-slate-100"}`}>{label === "Sales count" ? value || 0 : formatCurrency(value || 0)}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
          {(summaryMode === "daily"
            ? dailyAnalysis?.paymentMethods || []
            : Object.entries(paymentMethodsBreakdown).map(([method, amount]) => ({ method, amount, count: "" }))
          ).map((item) => (
            <span key={item.method} className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold dark:bg-slate-800 dark:text-slate-300">
              {item.method.replace("_", " ")} · {formatCurrency(item.amount)} {item.count !== "" && `(${item.count})`}
            </span>
          ))}
          <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold dark:bg-slate-800 dark:text-slate-300">{summaryMode === "daily" ? dailyAnalysis?.summary?.salesCount || 0 : filteredSales.length} sales</span>
        </div>
      </div>

      {/* DAILY AUDIT METRICS SUMMARY */}
      {widgetVisibility.executiveCards && (
        <div className="reports-detail-grid">
          <div className="mb-4">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">Detailed analytics</span>
          </div>
          
          <div className="grid gap-4 mb-6 lg:grid-cols-5 dark:text-slate-100">
            {/* Gross Revenue */}
            <div className="tool-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">GROSS REVENUE</span>
                <span className="text-lg">💰</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(auditMetrics.grossRevenue)}</h2>
              {compareToLastPeriod && varianceMetrics && (
                <div className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-bold ${varianceMetrics.revenue >= 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                  {varianceMetrics.revenue >= 0 ? "+" : ""}{varianceMetrics.revenue.toFixed(1)}% vs prev
                </div>
              )}
              <span className="text-xs text-slate-500 dark:text-slate-400">Total sales amount</span>
            </div>

            {/* COGS */}
            <div className="tool-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">COGS</span>
                <span className="text-lg">📦</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(auditMetrics.cogs)}</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">Cost of goods sold</span>
            </div>

            {/* Gross Profit */}
            <div className="tool-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">GROSS PROFIT</span>
                <span className="text-lg">📈</span>
              </div>
              <h2 className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(auditMetrics.grossProfit)}</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">Revenue - COGS</span>
            </div>

            {/* Operating Expenses */}
            <div className="tool-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">OPERATING EXPENSES</span>
                <span className="text-lg">⚙️</span>
              </div>
              <h2 className="text-xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(auditMetrics.operatingExpenses)}</h2>
              {compareToLastPeriod && varianceMetrics && (
                <div className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-bold ${varianceMetrics.expenses >= 0 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
                  {varianceMetrics.expenses >= 0 ? "+" : ""}{varianceMetrics.expenses.toFixed(1)}% vs prev
                </div>
              )}
              <span className="text-xs text-slate-500 dark:text-slate-400">Business costs</span>
            </div>

            {/* Net Operating Profit */}
            <div className="tool-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-green-600 dark:text-green-400">NET PROFIT</span>
                <span className="text-lg">✓</span>
              </div>
              <h2 className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(auditMetrics.netProfit)}</h2>
              {compareToLastPeriod && varianceMetrics && (
                <div className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-bold ${varianceMetrics.profit >= 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                  {varianceMetrics.profit >= 0 ? "+" : ""}{varianceMetrics.profit.toFixed(1)}% vs prev
                </div>
              )}
              <span className="text-xs text-slate-500 dark:text-slate-400">Gross Profit - Expenses</span>
            </div>
          </div>

          {/* PAYMENT METHODS BREAKDOWN */}
          {widgetVisibility.paymentBreakdown && (
          <div className="mb-6 grid gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <div className="mb-3">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">PAYMENT METHODS</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 px-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">💵 Cash</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(paymentMethodsBreakdown.cash)}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">💳 Card</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(paymentMethodsBreakdown.card)}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">🔄 Transfer</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(paymentMethodsBreakdown.transfer)}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">📝 Debt/Credit</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(paymentMethodsBreakdown.debt)}</span>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* HOURLY PEAK SALES HEATMAP */}
          {widgetVisibility.hourlyHeatmap && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <div className="mb-4">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">Hourly Peak Sales Analytics</span>
              <p className="text-sm text-slate-500 dark:text-slate-400">Transaction volume & revenue by business hour (8 AM - 8 PM)</p>
            </div>

            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyPeakData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="peakRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="hour" stroke="rgba(148,163,184,0.5)" />
                  <YAxis stroke="rgba(148,163,184,0.5)" />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === "revenue") return formatCurrency(value);
                      return value;
                    }}
                    labelFormatter={(label) => `${label}`}
                  />
                  <Bar dataKey="revenue" fill="url(#peakRevenue)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Hourly Breakdown Table */}
            <div className="mt-4 grid gap-2 grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-13">
              {hourlyPeakData.map((hour, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center dark:border-slate-700 dark:bg-slate-800">
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-400">{hour.hour}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{hour.transactions}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">txns</div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* 30-DAY PREDICTIVE FORECAST */}
          {widgetVisibility.forecast && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <div className="mb-4">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">30-Day Predictive Revenue Forecast</span>
              <p className="text-sm text-slate-500 dark:text-slate-400">Projected revenue based on 7-day moving average</p>
            </div>

            <div className="mb-6 grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-bold text-slate-600 dark:text-slate-400">Current Daily Average</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(forecastData.currentAvg)}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Based on recent trends</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-bold text-slate-600 dark:text-slate-400">Projected 30-Day Revenue</div>
                <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(forecastData.monthlyProjection)}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Next 30 days</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-bold text-slate-600 dark:text-slate-400">Target vs Projection</div>
                <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">{forecastData.currentAvg > 0 ? ((forecastData.monthlyProjection / (forecastData.currentAvg * 30)) * 100).toFixed(1) : "0.0"}%</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Achievement rate</div>
              </div>
            </div>

            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData.forecast} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="dateLabel" stroke="rgba(148,163,184,0.5)" />
                  <YAxis stroke="rgba(148,163,184,0.5)" />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Area type="monotone" dataKey="projected" stroke="#8b5cf6" strokeWidth={2} fill="url(#forecastGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          )}

          {/* STAFF PERFORMANCE LEADERBOARD */}
          {widgetVisibility.staffLeaderboard && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <div className="mb-4">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">Staff Performance Leaderboard</span>
              <p className="text-sm text-slate-500 dark:text-slate-400">Top performers ranked by total sales volume</p>
            </div>

            {staffLeaderboard.length > 0 ? (
              <div className="space-y-3">
                {staffLeaderboard.map((staff, idx) => {
                  const maxSales = staffLeaderboard[0]?.totalSales || 1;
                  const percentage = (staff.totalSales / maxSales) * 100;
                  const topThreeEmojis = ["🥇", "🥈", "🥉"];

                  return (
                    <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 text-2xl">
                            {idx < 3 ? topThreeEmojis[idx] : `#${idx + 1}`}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100">{staff.name}</h4>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {staff.transactionCount} transactions
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(staff.totalSales)}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {staff.revenuePercentage.toFixed(1)}% of total
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-2">
                        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Metrics Grid */}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="bg-white dark:bg-slate-900/50 rounded p-2">
                          <div className="text-slate-500 dark:text-slate-400">Avg Order</div>
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {formatCurrency(staff.avgOrderValue)}
                          </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900/50 rounded p-2">
                          <div className="text-slate-500 dark:text-slate-400">Commission</div>
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {formatCurrency(staff.estimatedCommission)}
                          </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900/50 rounded p-2">
                          <div className="text-slate-500 dark:text-slate-400">Transactions</div>
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {staff.transactionCount}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-slate-500 dark:text-slate-400">No staff data available</p>
            )}
          </div>
          )}

          {/* CATEGORY TRENDS & TOP SELLERS */}
          {widgetVisibility.categoryTrends && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <div className="mb-4">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">Category Trends & Product Performance</span>
              <p className="text-sm text-slate-500 dark:text-slate-400">Revenue distribution by category and top selling items</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Category Pie Chart */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Category Revenue Distribution</h3>
                {categoryTrends.categories.length > 0 ? (
                  <div style={{ width: "100%", height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryTrends.categories}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {categoryTrends.categories.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-center text-slate-500 dark:text-slate-400">No category data available</p>
                )}
              </div>

              {/* Top 5 Selling Items */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Top 5 Selling Items</h3>
                {categoryTrends.topProducts.length > 0 ? (
                  <div className="space-y-2">
                    {categoryTrends.topProducts.map((product, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-slate-400 dark:text-slate-500">
                              #{idx + 1}
                            </span>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                                {product.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {product.unitsSold} units sold
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(product.totalRevenue)}
                          </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {getProductStatusLabel(product)}
                              </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 dark:text-slate-400">No product data available</p>
                )}
              </div>
            </div>
          </div>
          )}

          {/* DAILY TRANSACTION & ACTIVITY TIMELINE */}
          {widgetVisibility.transactionLog && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">Transaction Timeline</span>
                <p className="text-sm text-slate-500 dark:text-slate-400">All activities for selected period</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <input
                  value={timelineSearch}
                  onChange={(e) => setTimelineSearch(e.target.value)}
                  placeholder="Search transactions"
                  className="w-44 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                />
                {[
                  { value: "all", label: "All" },
                  { value: "sales", label: "Sales Only" },
                  { value: "expenses", label: "Expenses Only" }
                ].map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setTransactionFilter(filter.value)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      transactionFilter === filter.value
                        ? "bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-900"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTransactionStatusFilter("pending")}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    transactionStatusFilter === "pending"
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  Pending Only
                </button>
                <select
                  value={transactionStatusFilter}
                  onChange={(e) => setTransactionStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  aria-label="Filter transaction timeline by ledger status"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="posted">Posted</option>
                  <option value="reversed">Reversed</option>
                </select>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-yellow-400"></span>Pending</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>Posted</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>Reversed</span>
            </div>

            {timelineTransactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="reports-table-head">
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Time</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Reference</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Type</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Staff</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">Amount</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTimelineTransactions.map((transaction, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(transaction.createdAt))}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">#{transaction.receiptId || transaction._id?.slice(-6)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                            transaction.type === "expense" 
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          }`}>
                            {transaction.type === "expense" ? "Expense" : "Sale"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{transaction.createdBy?.name || "System"}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-100">{formatCurrency(transaction.totalAmount || transaction.amount)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                              ["completed", "posted"].includes(transaction.status) || transaction.status === "paid"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : transaction.status === "reversed"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                            }`}>
                              {transaction.status === "completed" || transaction.status === "paid" ? "Posted" : transaction.status === "reversed" ? "Reversed" : transaction.status === "posted" ? "Posted" : "Pending"}
                            </span>
                            {canManageTransactionStatus && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500" title="Finance-only ledger status control">Ledger</span>
                                <select
                                  value={transaction.status === "completed" || transaction.status === "paid" ? "posted" : transaction.status || "pending"}
                                  onChange={(event) => handleTransactionStatusChange(transaction, event.target.value)}
                                  disabled={updatingTransactionId === transaction._id}
                                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                                  aria-label={`Update status for transaction ${transaction.receiptId || transaction._id}`}
                                  title="Update the financial ledger status for this transaction"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="posted">Posted</option>
                                  <option value="reversed">Reversed</option>
                                </select>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-slate-500 dark:text-slate-400">No transactions found for selected period</p>
              </div>
            )}

            {timelineTransactions.length > timelinePageSize && (
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
                <span className="text-xs text-slate-500 dark:text-slate-400">Showing {(timelinePage - 1) * timelinePageSize + 1}-{Math.min(timelinePage * timelinePageSize, timelineTransactions.length)} of {timelineTransactions.length}</span>
                <div className="flex gap-2">
                  <button type="button" disabled={timelinePage === 1} onClick={() => setTimelinePage((page) => page - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300">Previous</button>
                  <button type="button" disabled={timelinePage * timelinePageSize >= timelineTransactions.length} onClick={() => setTimelinePage((page) => page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300">Next</button>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      )}

      <div className="reports-core-grid dark:text-slate-100">
        {reportCards.map((card) => (
          <div key={card.title} className={`tool-panel report-card-${card.title.toLowerCase().split(" ")[0]} dark:border-slate-700 dark:bg-slate-900`}>
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

      <div className="reports-secondary-grid dark:text-slate-100">
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

        <div className="tool-panel recent-sales-wrapper dark:border-slate-700 dark:bg-slate-900">
          <div className="panel-heading">
            <div>
              <h2 className="dark:text-slate-100">Low stock alerts</h2>
              <p className="dark:text-slate-400">Monitor items running low</p>
            </div>
          </div>
          <div className="compact-list recent-sales-body">
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