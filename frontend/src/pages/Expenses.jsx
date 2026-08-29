import { useEffect, useState, useMemo, useRef } from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import request from "../api/client.js";
import { formatCurrency } from "../utils/formatters.js";
import { useAuth } from "../context/AuthContext.jsx";
import { getBranches } from "../api/branches.js";
import { notifySalesUpdated } from "../utils/salesEvents.js";

const EXPENSE_CATEGORIES = [
  { value: "inventory", label: "Inventory/Stock Procurement" },
  { value: "logistics", label: "Logistics & Transport" },
  { value: "utilities", label: "Utilities & Power" },
  { value: "salaries", label: "Staff Wages/Salaries" },
  { value: "rent", label: "Rent & Space Maintenance" },
  { value: "marketing", label: "Marketing/Creatives" },
  { value: "miscellaneous", label: "Miscellaneous / Others" }
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "store_credit", label: "Store Credit" }
];

const EXPENSE_STATUS_META = {
  approved: {
    label: "Approved",
    className: "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200",
  },
  rejected: {
    label: "Rejected",
    className: "bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200",
  },
};

const Expenses = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "owner" || user?.role === "super_admin";
  const [expenses, setExpenses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [viewMode, setViewMode] = useState("list"); // list, trends, reconciliation, budget, ledger
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerSummary, setLedgerSummary] = useState({ count: 0, totalDebits: 0, totalCredits: 0, net: 0 });
  const fileInputRef = useRef(null);

  // Form state
  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    category: "miscellaneous",
    paymentMethod: "cash",
    date: new Date().toISOString().split("T")[0],
    receipt: null,
    notes: "",
    branch: "",
    budgetAllocation: "",
    supplierName: "",
    supplierPhone: "",
    supplierId: "",
    inventoryItems: []
  });

  // Inventory form state for adding multiple items
  const [inventoryForm, setInventoryForm] = useState({
    productId: "",
    productName: "",
    category: "",
    quantity: "",
    unitCost: "",
    currentStock: 0
  });

  // Product suggestions for autocomplete
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Supplier suggestions for autocomplete
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [loadingSupplierSuggestions, setLoadingSupplierSuggestions] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [dateRange, setDateRange] = useState("month");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExpenses, setSelectedExpenses] = useState(new Set());
  const [trends, setTrends] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);
  const [budgetAnalysis, setBudgetAnalysis] = useState(null);
  const [pendingProcurements, setPendingProcurements] = useState([]);
  const [procurementSummary, setProcurementSummary] = useState(null);

  useEffect(() => {
    const loadExpensesAndBranches = async () => {
      try {
        setLoading(true);
        const [expenseData, branchData] = await Promise.all([
          request("/expenses"),
          getBranches()
        ]);

        setExpenses(Array.isArray(expenseData) ? expenseData : expenseData?.expenses || []);
        setBranches(Array.isArray(branchData) ? branchData : branchData?.branches || []);
      } catch (err) {
        setStatusMsg({ type: "error", text: "Failed to load expenses." });
        setExpenses([]);
        setBranches([]);
      } finally {
        setLoading(false);
      }
    };

    loadExpensesAndBranches();
  }, []);

  // ====================================
  // COMPUTED METRICS
  // ====================================
  const metrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const currentMonthExpenses = expenses.filter(e => {
      const expenseDate = new Date(e.date);
      return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
    });

    const lastMonthExpenses = expenses.filter(e => {
      const expenseDate = new Date(e.date);
      return expenseDate.getMonth() === lastMonth && expenseDate.getFullYear() === lastMonthYear;
    });

    const totalCurrentMonth = currentMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalLastMonth = lastMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const pendingCount = expenses.filter((expense) => (expense.status || "pending") === "pending").length;
    const approvedCount = expenses.filter((expense) => expense.status === "approved").length;

    const categoryTotals = {};
    currentMonthExpenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });
    const topCategory = Object.entries(categoryTotals).sort(([,a], [,b]) => b - a)[0];
    const momChange = totalLastMonth === 0 ? 0 : ((totalCurrentMonth - totalLastMonth) / totalLastMonth) * 100;

    return {
      totalCurrentMonth,
      pendingCount,
      approvedCount,
      topCategory: topCategory ? EXPENSE_CATEGORIES.find(c => c.value === topCategory[0])?.label : "N/A",
      momChange,
      categoryTotals
    };
  }, [expenses]);

  const trendSummary = useMemo(() => {
    const sorted = [...expenses]
      .filter((expense) => expense?.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const lastSevenDays = sorted.slice(-7);
    const dailyBurn = lastSevenDays.length
      ? lastSevenDays.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0) / lastSevenDays.length
      : 0;

    const topDay = sorted.reduce((best, expense) => {
      const key = new Date(expense.date).toISOString().slice(0, 10);
      const currentValue = best.map[key] || 0;
      best.map[key] = currentValue + (Number(expense.amount) || 0);
      if (!best.max || best.map[key] > best.max.value) {
        best.max = { label: new Date(expense.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), value: best.map[key] };
      }
      return best;
    }, { map: {}, max: null }).max || { label: "No data", value: 0 };

    const activeDays = sorted.filter((expense) => expense.status !== "rejected").length;

    return {
      dailyBurn,
      topDay,
      activeDays,
      burnRate: Math.max(0, ((metrics.totalCurrentMonth || 0) / 30) * 1.2),
    };
  }, [expenses, metrics.totalCurrentMonth]);

  const expenseAnalytics = useMemo(() => {
    const currentMonthTotal = metrics.totalCurrentMonth || 1;
    const categoryMix = Object.entries(metrics.categoryTotals || {})
      .map(([category, value]) => ({
        category,
        label: EXPENSE_CATEGORIES.find((entry) => entry.value === category)?.label || category,
        value,
        percentage: (value / currentMonthTotal) * 100,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const pendingQueue = expenses
      .filter((expense) => (expense.status || "pending") === "pending")
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3)
      .map((expense) => ({
        id: expense._id,
        caption: expense.description,
        amount: expense.amount || 0,
        category: EXPENSE_CATEGORIES.find((entry) => entry.value === expense.category)?.label || expense.category,
      }));

    const budgetVariance = metrics.totalCurrentMonth - (metrics.totalCurrentMonth * 0.12);

    return {
      categoryMix,
      pendingQueue,
      budgetVariance,
      benchmark: metrics.totalCurrentMonth * 0.12,
    };
  }, [expenses, metrics]);

  // ====================================
  // FILTERING
  // ====================================
  const filteredExpenses = useMemo(() => {
    let filtered = [...expenses];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(e =>
        e.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter(e => e.category === selectedCategory);
    }

    if (selectedBranch) {
      filtered = filtered.filter(e => {
        const branchId = e.branch?._id || e.branch;
        return branchId === selectedBranch;
      });
    }

    // Date range filter
    const now = new Date();
    let startDate = new Date();

    if (dateRange === "today") {
      startDate.setHours(0, 0, 0, 0);
    } else if (dateRange === "week") {
      startDate.setDate(now.getDate() - now.getDay());
    } else if (dateRange === "month") {
      startDate.setDate(1);
    }

    filtered = filtered.filter(e => new Date(e.date) >= startDate);

    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, searchTerm, selectedCategory, selectedBranch, dateRange]);

  // ====================================
  // ACTIONS
  // ====================================

  // 🔥 FETCH PRODUCT SUGGESTIONS FOR AUTOCOMPLETE
  const fetchProductSuggestions = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setProductSuggestions([]);
      return;
    }

    try {
      setLoadingSuggestions(true);
      const res = await request(`/products/autocomplete?search=${encodeURIComponent(searchTerm)}&limit=10`);
      setProductSuggestions(res.products || []);
    } catch (err) {
      console.error("Error fetching products:", err);
      setProductSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // 🔥 HANDLE PRODUCT SELECTION FROM DROPDOWN
  const handleSelectProduct = (product) => {
    // Check if already added
    const isAlreadyAdded = formData.inventoryItems.some(item => item.productId === product._id);
    
    if (isAlreadyAdded) {
      setStatusMsg({ type: "warning", text: `"${product.name}" is already in this expense` });
      return;
    }

    setInventoryForm({
      productId: product._id,
      productName: product.name,
      category: product.category,
      quantity: "",
      unitCost: product.costPrice || product.price,
      currentStock: product.stock
    });
    setProductSuggestions([]);
  };

  // 🔥 FETCH SUPPLIER SUGGESTIONS FOR AUTOCOMPLETE
  const fetchSupplierSuggestions = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setSupplierSuggestions([]);
      return;
    }

    try {
      setLoadingSupplierSuggestions(true);
      const res = await request(`/suppliers/autocomplete?search=${encodeURIComponent(searchTerm)}&limit=10`);
      setSupplierSuggestions(res.suppliers || []);
    } catch (err) {
      console.error("Error fetching suppliers:", err);
      setSupplierSuggestions([]);
    } finally {
      setLoadingSupplierSuggestions(false);
    }
  };

  // 🔥 HANDLE SUPPLIER SELECTION FROM DROPDOWN
  const handleSelectSupplier = (supplier) => {
    setFormData({
      ...formData,
      supplierName: supplier.name,
      supplierPhone: supplier.phone,
      supplierId: supplier._id
    });
    setSupplierSuggestions([]);
  };

  const addInventoryItem = () => {
    if (!inventoryForm.productName || !inventoryForm.quantity || !inventoryForm.unitCost) {
      setStatusMsg({ type: "error", text: "All inventory fields are required" });
      return;
    }

    const newItem = {
      productId: inventoryForm.productId || null, // null if new product
      productName: inventoryForm.productName,
      category: inventoryForm.category || "General",
      quantity: Number(inventoryForm.quantity),
      unitCost: Number(inventoryForm.unitCost)
    };

    setFormData(prev => ({
      ...prev,
      inventoryItems: [...prev.inventoryItems, newItem]
    }));

    setInventoryForm({ productId: "", productName: "", category: "", quantity: "", unitCost: "", currentStock: 0 });
    setStatusMsg({ type: "success", text: "Inventory item added" });
    setTimeout(() => setStatusMsg({ type: "", text: "" }), 2000);
  };

  const removeInventoryItem = (index) => {
    setFormData(prev => ({
      ...prev,
      inventoryItems: prev.inventoryItems.filter((_, i) => i !== index)
    }));
  };

  // 🔥 REFRESH RELATED DATA AFTER INVENTORY CHANGES
  const refreshInventoryRelatedData = async () => {
    try {
      const [productsData, branchInventoryData] = await Promise.all([
        request("/products"),
        request("/branch-inventory")
      ]);
      
      // Optionally emit event for POS to refresh
      if (window.BroadcastChannel) {
        const channel = new BroadcastChannel("inventory-updates");
        channel.postMessage({ type: "inventory-changed", timestamp: Date.now() });
        channel.close();
      }
    } catch (err) {
      console.error("Failed to refresh inventory data:", err);
    }
  };


  const handleAddExpense = async () => {
    if (!formData.amount || !formData.description) {
      setStatusMsg({ type: "error", text: "Amount and description required." });
      return;
    }

    if (formData.category === "inventory" && formData.inventoryItems.length === 0) {
      setStatusMsg({ type: "error", text: "Add at least one inventory item for inventory expenses." });
      return;
    }

    try {
      setProcessing(true);
      const payload = {
        amount: parseFloat(formData.amount),
        description: formData.description,
        category: formData.category,
        paymentMethod: formData.paymentMethod,
        date: formData.date,
        branch: formData.branch || undefined,
        budgetAllocation: formData.budgetAllocation ? Number(formData.budgetAllocation) : undefined,
        notes: formData.notes,
        supplierName: formData.supplierName || undefined,
        supplierPhone: formData.supplierPhone || undefined,
        supplierId: formData.supplierId || undefined,
        inventoryItems: formData.inventoryItems || []
      };

      const res = await request("/expenses", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (res?.expense) {
        setExpenses([res.expense, ...expenses]);
        setFormData({
          amount: "",
          description: "",
          category: "miscellaneous",
          paymentMethod: "cash",
          date: new Date().toISOString().split("T")[0],
          receipt: null,
          notes: "",
          branch: "",
          budgetAllocation: "",
          supplierName: "",
          supplierPhone: "",
          supplierId: "",
          inventoryItems: []
        });
        setInventoryForm({ productId: "", productName: "", category: "", quantity: "", unitCost: "", currentStock: 0 });
        setIsFormOpen(false);
        setStatusMsg({ type: "success", text: "Expense added successfully!" });
        notifySalesUpdated();
        
        // 🔥 REFRESH INVENTORY DATA IF THIS WAS AN INVENTORY EXPENSE
        if (formData.category === "inventory") {
          refreshInventoryRelatedData();
        }
        
        setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000);
      } else if (res?.offline) {
        const localExpense = {
          _id: `pending-${res.operationId}`,
          ...payload,
          status: "pending",
          syncStatus: "pending",
          createdAt: new Date().toISOString()
        };
        setExpenses((current) => [localExpense, ...current]);
        setIsFormOpen(false);
        setStatusMsg({ type: "success", text: "Expense saved on this device and will sync automatically when online." });
      }
    } catch (err) {
      setStatusMsg({ type: "error", text: err.message || "Failed to add expense." });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await request(`/expenses/${id}`, { method: "DELETE" });
      setExpenses(expenses.filter(e => e._id !== id));
      setStatusMsg({ type: "success", text: "Expense deleted." });
      setTimeout(() => setStatusMsg({ type: "", text: "" }), 2000);
    } catch (err) {
      setStatusMsg({ type: "error", text: "Failed to delete expense." });
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedExpenses.size || !confirm(`Delete ${selectedExpenses.size} expense(s)?`)) return;
    try {
      await Promise.all([...selectedExpenses].map(id => request(`/expenses/${id}`, { method: "DELETE" })));
      setExpenses(expenses.filter(e => !selectedExpenses.has(e._id)));
      setSelectedExpenses(new Set());
      setStatusMsg({ type: "success", text: `${selectedExpenses.size} expense(s) deleted.` });
      setTimeout(() => setStatusMsg({ type: "", text: "" }), 2000);
    } catch (err) {
      setStatusMsg({ type: "error", text: "Bulk delete failed." });
    }
  };

  const handleBulkExport = () => {
    if (filteredExpenses.length === 0) {
      setStatusMsg({ type: "error", text: "No expenses to export." });
      return;
    }

    const headers = ["Date", "Description", "Category", "Payment Method", "Amount"];
    const rows = filteredExpenses.map(e => [
      new Date(e.date).toLocaleDateString(),
      e.description,
      EXPENSE_CATEGORIES.find(c => c.value === e.category)?.label || e.category,
      PAYMENT_METHODS.find(m => m.value === e.paymentMethod)?.label || e.paymentMethod,
      `₦${e.amount.toLocaleString()}`
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const toggleExpenseSelection = (id) => {
    const newSelected = new Set(selectedExpenses);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedExpenses(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedExpenses.size === filteredExpenses.length) {
      setSelectedExpenses(new Set());
      return;
    }

    setSelectedExpenses(new Set(filteredExpenses.map(e => e._id)));
  };

  const handleApproveExpense = async (id) => {
    if (!confirm("Approve this expense?")) return;
    try {
      const expenseBeingApproved = expenses.find(e => e._id === id);
      
      const res = await request(`/expenses/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({})
      });
      if (res?.expense) {
        setExpenses(expenses.map(e => e._id === id ? res.expense : e));
        setStatusMsg({ type: "success", text: "Expense approved successfully!" });
        notifySalesUpdated();
        
        // 🔥 REFRESH INVENTORY DATA IF THIS WAS AN INVENTORY EXPENSE
        if (expenseBeingApproved?.category === "inventory") {
          refreshInventoryRelatedData();
        }
        
        setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000);
      }
    } catch (err) {
      setStatusMsg({ type: "error", text: err.message || "Failed to approve expense." });
    }
  };

  const handleRejectExpense = async (id) => {
    if (!confirm("Reject this expense?")) return;
    try {
      const res = await request(`/expenses/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({})
      });
      if (res?.expense) {
        setExpenses(expenses.map(e => e._id === id ? res.expense : e));
        setStatusMsg({ type: "success", text: "Expense rejected successfully!" });
        notifySalesUpdated();
        setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000);
      }
    } catch (err) {
      setStatusMsg({ type: "error", text: err.message || "Failed to reject expense." });
    }
  };

  const getStatusBadgeColor = (status) => {
    const normalizedStatus = String(status || "pending").toLowerCase();
    return EXPENSE_STATUS_META[normalizedStatus]?.className || EXPENSE_STATUS_META.pending.className;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "approved":
        return "✓";
      case "rejected":
        return "✕";
      case "pending":
      default:
        return "⏳";
    }
  };

  const loadTrends = async () => {
    try {
      const data = await request(`/expenses/trends/analysis?category=${selectedCategory || "all"}`);
      setTrends(data);
      setViewMode("trends");
    } catch (err) {
      setStatusMsg({ type: "error", text: "Failed to load trends." });
    }
  };

  const loadReconciliation = async () => {
    try {
      const data = await request(`/expenses/reconciliation/report?category=${selectedCategory || "all"}&branch=${selectedBranch || "all"}`);
      setReconciliation(data);
      setViewMode("reconciliation");
    } catch (err) {
      setStatusMsg({ type: "error", text: "Failed to load reconciliation report." });
    }
  };

  const loadBudgetAnalysis = async () => {
    try {
      const data = await request(`/expenses/budget/analysis?category=${selectedCategory || "all"}`);
      setBudgetAnalysis(data);
      setViewMode("budget");
    } catch (err) {
      setStatusMsg({ type: "error", text: "Failed to load budget analysis." });
    }
  };

  const loadLedger = async () => {
    try {
      const data = await request(`/transactions/ledger?type=all`);
      setLedgerEntries(Array.isArray(data?.entries) ? data.entries : []);
      setLedgerSummary(data?.summary || { count: 0, totalDebits: 0, totalCredits: 0, net: 0 });
      setViewMode("ledger");
    } catch (err) {
      setStatusMsg({ type: "error", text: "Failed to load general ledger." });
    }
  };

  // PHASE 1: PROCUREMENT APPROVALS
  const loadProcurementApprovals = async () => {
    try {
      const data = await request("/expenses/procurement/pending");
      setPendingProcurements(Array.isArray(data?.expenses) ? data.expenses : []);
      setProcurementSummary(data?.summary || {});
      setViewMode("procurement");
    } catch (err) {
      setStatusMsg({ type: "error", text: "Failed to load pending procurement approvals." });
    }
  };

  const approveProcurementExpense = async (expenseId) => {
    try {
      setProcessing(true);
      await request(`/expenses/${expenseId}/approve-procurement`, {
        method: "POST",
        body: JSON.stringify({ notes: "Approved from Expenses page" })
      });
      setStatusMsg({ type: "success", text: "Procurement expense approved successfully!" });
      await loadProcurementApprovals();
    } catch (err) {
      setStatusMsg({ type: "error", text: err.message || "Failed to approve expense." });
    } finally {
      setProcessing(false);
    }
  };

  const rejectProcurementExpense = async (expenseId) => {
    try {
      setProcessing(true);
      await request(`/expenses/${expenseId}/reject`, {
        method: "POST",
        body: JSON.stringify({ notes: "Rejected from Expenses page" })
      });
      setStatusMsg({ type: "success", text: "Procurement expense rejected." });
      await loadProcurementApprovals();
    } catch (err) {
      setStatusMsg({ type: "error", text: err.message || "Failed to reject expense." });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <section className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe_0%,_#f8fafc_35%,_#eef2ff_100%)] py-8 px-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-slate-950 text-white shadow-[0_25px_80px_rgba(15,23,42,0.18)]">
          <div className="flex flex-col gap-5 border-b border-white/10 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">Operations control</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Expense board</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
                {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
              <button
                onClick={() => setIsFormOpen(!isFormOpen)}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition-all hover:scale-[1.01] hover:shadow-xl hover:shadow-sky-500/30"
              >
                <span className="text-base">＋</span>
                Add expense
              </button>
            </div>
          </div>
        </div>

        {statusMsg.text && (
          <div className={`rounded-2xl border px-4 py-3 text-sm font-bold shadow-sm ${
            statusMsg.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
              : statusMsg.type === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
          }`}>
            {statusMsg.text}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Month spend</p>
                <p className="mt-3 text-3xl font-black text-slate-900">{formatCurrency(metrics.totalCurrentMonth)}</p>
              </div>
              <div className="rounded-2xl bg-sky-100 p-2.5 text-sky-700 ring-1 ring-inset ring-sky-200">↗</div>
            </div>
            <p className="mt-4 text-xs font-medium text-slate-500">This month</p>
          </div>

          <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Pending</p>
                <p className="mt-3 text-3xl font-black text-slate-900">{metrics.pendingCount}</p>
              </div>
              <div className="rounded-2xl bg-amber-100 p-2.5 text-amber-700 ring-1 ring-inset ring-amber-200">⏳</div>
            </div>
            <p className="mt-4 text-xs font-medium text-slate-500">Awaiting approval</p>
          </div>

          <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Approved</p>
                <p className="mt-3 text-3xl font-black text-slate-900">{metrics.approvedCount}</p>
              </div>
              <div className="rounded-2xl bg-emerald-100 p-2.5 text-emerald-700 ring-1 ring-inset ring-emerald-200">✓</div>
            </div>
            <p className="mt-4 text-xs font-medium text-slate-500">Cleared for posting</p>
          </div>

          <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">MoM change</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className={`text-3xl font-black ${metrics.momChange >= 0 ? "text-rose-500" : "text-emerald-600"}`}>
                    {Math.abs(metrics.momChange).toFixed(1)}%
                  </p>
                  <span className={`text-xs font-bold ${metrics.momChange >= 0 ? "text-rose-500" : "text-emerald-600"}`}>
                    {metrics.momChange >= 0 ? "↑" : "↓"}
                  </span>
                </div>
              </div>
              <div className={`rounded-2xl p-2.5 ring-1 ring-inset ${metrics.momChange >= 0 ? "bg-rose-100 text-rose-700 ring-rose-200" : "bg-emerald-100 text-emerald-700 ring-emerald-200"}`}>
                {metrics.momChange >= 0 ? "↗" : "↘"}
              </div>
            </div>
            <p className="mt-4 text-xs font-medium text-slate-500">vs. last month</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Daily burn</p>
                <p className="mt-3 text-2xl font-black text-slate-900">{formatCurrency(trendSummary.dailyBurn)}</p>
              </div>
              <div className="rounded-2xl bg-sky-100 p-2.5 text-sky-700 ring-1 ring-inset ring-sky-200">◔</div>
            </div>
            <p className="mt-4 text-xs font-medium text-slate-500">7-day operating average</p>
          </div>

          <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Peak day</p>
                <p className="mt-3 text-2xl font-black text-slate-900">{trendSummary.topDay.label}</p>
              </div>
              <div className="rounded-2xl bg-violet-100 p-2.5 text-violet-700 ring-1 ring-inset ring-violet-200">✦</div>
            </div>
            <p className="mt-4 text-xs font-medium text-slate-500">{formatCurrency(trendSummary.topDay.value)} highest spend day</p>
          </div>

          <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Active flow</p>
                <p className="mt-3 text-2xl font-black text-slate-900">{trendSummary.activeDays}</p>
              </div>
              <div className="rounded-2xl bg-emerald-100 p-2.5 text-emerald-700 ring-1 ring-inset ring-emerald-200">✓</div>
            </div>
            <p className="mt-4 text-xs font-medium text-slate-500">Expense events in the month</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.9fr_0.9fr]">
          <div className="rounded-[26px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Category mix</p>
                <h3 className="mt-2 text-lg font-black text-slate-900">Spend composition</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">This month</span>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseAnalytics.categoryMix.length ? expenseAnalytics.categoryMix : [{ category: "miscellaneous", label: "Other", value: 0 }] }>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ borderRadius: 16, border: "1px solid #e2e8f0" }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#0ea5e9" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Budget vs actual</p>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-black text-slate-900">{formatCurrency(metrics.totalCurrentMonth)}</p>
                <p className="mt-1 text-xs text-slate-500">Actual spend</p>
              </div>
              <div className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">+{Math.max(0, ((metrics.totalCurrentMonth - expenseAnalytics.benchmark) / expenseAnalytics.benchmark) * 100 || 0).toFixed(1)}%</div>
            </div>
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500" style={{ width: `${Math.min((metrics.totalCurrentMonth / Math.max(expenseAnalytics.benchmark, 1)) * 100, 100)}%` }} />
            </div>
            <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
              <span>Target</span>
              <span>{formatCurrency(expenseAnalytics.benchmark)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Variance</span>
              <span className={expenseAnalytics.budgetVariance >= 0 ? "text-emerald-600" : "text-rose-600"}>{formatCurrency(Math.abs(expenseAnalytics.budgetVariance))}</span>
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Approvals queue</p>
            <div className="mt-4 space-y-3">
              {expenseAnalytics.pendingQueue.length ? expenseAnalytics.pendingQueue.map((item) => (
                <div key={item.id} className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-bold text-slate-800">{item.caption}</p>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">Pending</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{item.category}</span>
                    <span className="font-bold text-slate-700">{formatCurrency(item.amount)}</span>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">No pending approvals</div>
              )}
            </div>
          </div>
        </div>

        {isFormOpen && (
          <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-6 flex items-center justify-between gap-3 rounded-[24px] bg-gradient-to-r from-slate-900 via-sky-950 to-indigo-950 p-5 text-white">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-300">New expense entry</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">Record operating spend</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-white/90 transition hover:bg-white/15"
              >
                Close
              </button>
            </div>

            <div className="space-y-5 rounded-[24px] border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/50">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-700">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Add new expense</h2>
                  <p className="mt-1 text-sm text-slate-500">Capture spend, approvals, and supporting detail in one place.</p>
                </div>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">Boardroom capture</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Amount</span>
                  <input
                    type="number"
                    placeholder="Amount (₦)"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Date</span>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Description</span>
                  <input
                    type="text"
                    placeholder="Description (e.g., 'Generator Diesel')"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Category</span>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Payment method</span>
                  <select
                    value={formData.paymentMethod}
                    onChange={e => setFormData({...formData, paymentMethod: e.target.value})}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  >
                    {PAYMENT_METHODS.map(method => (
                      <option key={method.value} value={method.value}>{method.label}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Branch</span>
                  <select
                    value={formData.branch}
                    onChange={e => setFormData({...formData, branch: e.target.value})}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  >
                    <option value="">Select Branch (Optional)</option>
                    {branches.map(branch => (
                      <option key={branch._id} value={branch._id}>{branch.name}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Budget allocation</span>
                  <input
                    type="number"
                    placeholder="Budget Allocation (Optional)"
                    value={formData.budgetAllocation}
                    onChange={e => setFormData({...formData, budgetAllocation: e.target.value})}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </label>

                {formData.category === "inventory" && (
                  <div className="space-y-3 rounded-[24px] border border-sky-200 bg-sky-50/60 p-4 md:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-black uppercase tracking-[0.18em] text-sky-700">Inventory line items</h4>
                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-700">Procurement</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Product Name or SKU"
                          value={inventoryForm.productName}
                          onChange={e => {
                            setInventoryForm({...inventoryForm, productName: e.target.value});
                            fetchProductSuggestions(e.target.value);
                          }}
                          onFocus={() => {
                            if (inventoryForm.productName) {
                              fetchProductSuggestions(inventoryForm.productName);
                            }
                          }}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                          autoComplete="off"
                        />

                        {productSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                            {productSuggestions.map(product => {
                              const isAdded = formData.inventoryItems.some(item => item.productId === product._id);
                              return (
                                <div
                                  key={product._id}
                                  onClick={() => handleSelectProduct(product)}
                                  className={`cursor-pointer border-b border-slate-100 px-4 py-3 last:border-b-0 ${isAdded ? "bg-slate-100 opacity-60" : "hover:bg-sky-50"}`}
                                >
                                  <div className="text-sm font-semibold text-slate-800">{product.name}</div>
                                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                                    <span>Stock: {product.stock}</span>
                                    <span>₦{Number(product.price).toLocaleString()}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {loadingSuggestions && (
                          <div className="absolute top-full left-0 right-0 mt-1 rounded-2xl border border-slate-200 bg-white p-3 text-center text-xs font-medium text-slate-500 shadow-lg">
                            Loading products...
                          </div>
                        )}
                      </div>

                      <input
                        type="number"
                        min="1"
                        placeholder="Quantity"
                        value={inventoryForm.quantity}
                        onChange={e => setInventoryForm({...inventoryForm, quantity: e.target.value})}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                      />

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Unit Cost"
                        value={inventoryForm.unitCost}
                        onChange={e => setInventoryForm({...inventoryForm, unitCost: e.target.value})}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                      />
                    </div>

                    {inventoryForm.currentStock !== undefined && inventoryForm.quantity && (
                      <div className={`rounded-2xl px-3 py-2 text-sm font-semibold ${Number(inventoryForm.quantity) > inventoryForm.currentStock ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                        Current stock: {inventoryForm.currentStock} units
                        {Number(inventoryForm.quantity) > inventoryForm.currentStock && <span> ⚠️ above available stock</span>}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={addInventoryItem}
                      className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-700"
                    >
                      + Add item
                    </button>

                    {formData.inventoryItems.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-sm font-black uppercase tracking-[0.18em] text-slate-600">Items added</h5>
                        {formData.inventoryItems.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                            <span className="text-sm font-semibold text-slate-800">
                              {item.productName}
                              {!item.productId && <span className="text-orange-600"> (New)</span>} × {item.quantity} @ ₦{Number(item.unitCost).toLocaleString()}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeInventoryItem(idx)}
                              className="text-sm font-bold text-rose-600 transition hover:text-rose-700"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {formData.category === "inventory" && (
                  <div className="space-y-3 rounded-[24px] border border-violet-200 bg-violet-50/60 p-4 md:col-span-2">
                    <h4 className="text-sm font-black uppercase tracking-[0.18em] text-violet-700">Supplier information</h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Supplier Name (optional)"
                          value={formData.supplierName}
                          onChange={e => {
                            setFormData({...formData, supplierName: e.target.value});
                            fetchSupplierSuggestions(e.target.value);
                          }}
                          onFocus={() => {
                            if (formData.supplierName) {
                              fetchSupplierSuggestions(formData.supplierName);
                            }
                          }}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                          autoComplete="off"
                        />

                        {supplierSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                            {supplierSuggestions.map(supplier => (
                              <div
                                key={supplier._id}
                                onClick={() => handleSelectSupplier(supplier)}
                                className="cursor-pointer border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-violet-50"
                              >
                                <div className="text-sm font-semibold text-slate-800">{supplier.name}</div>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                                  <span>{supplier.phone || "No phone"}</span>
                                  <span>Balance: ₦{Number(supplier.outstandingBalance || 0).toLocaleString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {loadingSupplierSuggestions && (
                          <div className="absolute top-full left-0 right-0 mt-1 rounded-2xl border border-slate-200 bg-white p-3 text-center text-xs font-medium text-slate-500 shadow-lg">
                            Loading suppliers...
                          </div>
                        )}
                      </div>

                      <input
                        type="text"
                        placeholder="Supplier Phone (optional)"
                        value={formData.supplierPhone}
                        onChange={e => setFormData({...formData, supplierPhone: e.target.value})}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                      />
                    </div>

                    {formData.supplierId && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="space-y-2 text-xs text-slate-600">
                          <div className="flex items-center justify-between">
                            <span>Outstanding balance</span>
                            <span className="font-bold text-rose-600">₦{Number(supplierSuggestions.find(s => s._id === formData.supplierId)?.outstandingBalance || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Total purchases</span>
                            <span className="font-bold text-slate-800">₦{Number(supplierSuggestions.find(s => s._id === formData.supplierId)?.totalPurchases || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Notes</span>
                  <textarea
                    placeholder="Notes (optional)"
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    rows="2"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Receipt</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={e => setFormData({...formData, receipt: e.target.files?.[0] || null})}
                    className="w-full rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-sky-100 file:px-3 file:py-2 file:text-sm file:font-bold file:text-sky-700"
                  />
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleAddExpense}
                  disabled={processing}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-sky-500/20 transition-all hover:shadow-xl hover:shadow-sky-500/30 disabled:opacity-60"
                >
                  {processing ? "Adding..." : "Add Expense"}
                </button>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition-all hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FILTERS & CONTROLS */}
        <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition-all ${viewMode === "list" ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            >
              📋 List view
            </button>
            {isAdmin && (
              <button
                onClick={loadProcurementApprovals}
                className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition-all ${viewMode === "procurement" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
              >
                ✓ Procurement {pendingProcurements.length > 0 && `(${pendingProcurements.length})`}
              </button>
            )}
            <button
              onClick={loadTrends}
              className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition-all ${viewMode === "trends" ? "bg-sky-600 text-white shadow-lg shadow-sky-600/20" : "bg-sky-50 text-sky-700 hover:bg-sky-100"}`}
            >
              📈 Trends
            </button>
            <button
              onClick={loadReconciliation}
              className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition-all ${viewMode === "reconciliation" ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20" : "bg-violet-50 text-violet-700 hover:bg-violet-100"}`}
            >
              🔗 Reconciliation
            </button>
            <button
              onClick={loadBudgetAnalysis}
              className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition-all ${viewMode === "budget" ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
            >
              💰 Budget
            </button>
            <button
              onClick={loadLedger}
              className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition-all ${viewMode === "ledger" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"}`}
            >
              📒 Ledger
            </button>
          </div>

          {viewMode === "list" && (
            <div className="mt-4 flex flex-wrap gap-3 items-center">
              <div className="relative min-w-[220px] flex-1">
                <input
                  type="text"
                  placeholder="Search expenses..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-10 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">⌕</span>
              </div>

              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              >
                <option value="">All categories</option>
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>

              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              >
                <option value="">All branches</option>
                {branches.map(branch => (
                  <option key={branch._id} value={branch._id}>{branch.name}</option>
                ))}
              </select>

              <select
                value={dateRange}
                onChange={e => setDateRange(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              >
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="all">All time</option>
              </select>
            </div>
          )}

          {selectedExpenses.size > 0 && viewMode === "list" && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
              <button
                onClick={handleBulkDelete}
                className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
              >
                🗑 Delete ({selectedExpenses.size})
              </button>
              <button
                onClick={handleBulkExport}
                className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
              >
                📥 Export ({selectedExpenses.size})
              </button>
            </div>
          )}
        </div>

        {viewMode === "ledger" && (
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Finance</p>
                <h2 className="mt-2 text-2xl font-black text-slate-900">General Ledger</h2>
                <p className="text-sm text-slate-500">Approved expense postings and accounting movement</p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm font-bold">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{ledgerSummary.count} entries</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Debits {formatCurrency(ledgerSummary.totalDebits)}</span>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">Credits {formatCurrency(ledgerSummary.totalCredits)}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-gray-700">Date</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-700">Description</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-700">Account</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-700">Type</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">Amount</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-700">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ledgerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-500">No ledger entries yet</td>
                    </tr>
                  ) : (
                    ledgerEntries.map(entry => (
                      <tr key={entry._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-700">{new Date(entry.occurredAt || entry.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{entry.description}</td>
                        <td className="px-4 py-3 text-gray-700">{entry.accountName || "General Expenses"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${entry.postingType === "debit" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {entry.postingType || "debit"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-gray-900">{formatCurrency(entry.amount)}</td>
                        <td className="px-4 py-3 text-gray-700">{entry.category || "miscellaneous"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewMode !== "ledger" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filteredExpenses.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-500">📊</div>
              <p className="text-lg font-black text-slate-700">No expenses found</p>
              <p className="mt-1 text-sm text-slate-500">Try adjusting the filters or add a new expense.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr className="border-b border-slate-200">
                    <th className="px-5 py-3.5">
                      <input
                        type="checkbox"
                        checked={selectedExpenses.size === filteredExpenses.length && filteredExpenses.length > 0}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                    </th>
                    <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Date</th>
                    <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Description</th>
                    <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Category</th>
                    <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Supplier</th>
                    <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Payment</th>
                    <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Amount</th>
                    <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Status</th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Created by</th>
                    <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredExpenses.map(expense => (
                    <tr key={expense._id} className="bg-white transition-colors hover:bg-slate-50/80">
                      <td className="px-5 py-4">
                        <input
                          type="checkbox"
                          checked={selectedExpenses.has(expense._id)}
                          onChange={() => toggleExpenseSelection(expense._id)}
                          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-900">{new Date(expense.date).toLocaleDateString()}</td>
                      <td className="px-5 py-4 text-slate-700">
                        <p className="font-semibold text-slate-800">{expense.description}</p>
                        {expense.notes && <p className="mt-1 text-xs text-slate-500">{expense.notes}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700 ring-1 ring-inset ring-sky-200">
                          {EXPENSE_CATEGORIES.find(c => c.value === expense.category)?.label || expense.category}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        {expense.supplier?.name ? (
                          <div>
                            <p className="font-semibold text-sm text-slate-800">{expense.supplier.name}</p>
                            {expense.supplier.phone && <p className="text-xs text-slate-500">{expense.supplier.phone}</p>}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-700">
                        {PAYMENT_METHODS.find(m => m.value === expense.paymentMethod)?.label || expense.paymentMethod}
                      </td>
                      <td className="px-5 py-4 text-right font-black text-slate-900">{formatCurrency(expense.amount)}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${getStatusBadgeColor(expense.status)}`}>
                          {getStatusIcon(expense.status)} {EXPENSE_STATUS_META[(expense.status || "pending").toLowerCase()]?.label || "Pending"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">
                        <p className="font-semibold text-slate-800">{expense.createdBy?.name || "Unknown"}</p>
                        {expense.approvedBy && <p className="text-xs text-emerald-600">Approved by: {expense.approvedBy.name}</p>}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex flex-col gap-1.5">
                          {isAdmin && expense.status === "pending" && (
                            <>
                              <button
                                onClick={() => handleApproveExpense(expense._id)}
                                className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectExpense(expense._id)}
                                className="rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDeleteExpense(expense._id)}
                            className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-200"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        )}

        {/* TRENDS VIEW */}
        {viewMode === "trends" && trends && (
          <div className="space-y-6">
            {/* Monthly Trend Line Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Monthly Expense Trend (Last 6 Months)</h2>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={trends.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "0.5rem"
                    }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ fill: "#3b82f6", r: 5 }}
                    activeDot={{ r: 7 }}
                    name="Expenses"
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="p-4 bg-blue-50 rounded-xl">
                  <p className="text-xs text-gray-600">Highest Month</p>
                  <p className="font-black text-lg text-blue-600">{trends.highestMonth?.month}</p>
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(trends.highestMonth?.total)}</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-xl">
                  <p className="text-xs text-gray-600">Lowest Month</p>
                  <p className="font-black text-lg text-amber-600">{trends.lowestMonth?.month}</p>
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(trends.lowestMonth?.total)}</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-xl">
                  <p className="text-xs text-gray-600">Average Monthly</p>
                  <p className="font-black text-lg text-emerald-600">-</p>
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(trends.averageMonthly)}</p>
                </div>
              </div>
            </div>

            {/* Category Breakdown Pie Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Spending by Category</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={trends.categoryBreakdown}
                      dataKey="total"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ category, percentage }) => `${EXPENSE_CATEGORIES.find(c => c.value === category)?.label?.split('/')[0]} ${percentage?.toFixed(1)}%`}
                    >
                      {trends.categoryBreakdown?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'][index % 7]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Top Spending Categories</h2>
                <div className="space-y-3">
                  {trends.categoryBreakdown?.sort((a, b) => b.total - a.total).map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm font-bold text-gray-700">{EXPENSE_CATEGORIES.find(c => c.value === item.category)?.label}</span>
                        <span className="text-sm font-black text-gray-900">{item.percentage?.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full transition-all"
                          style={{ width: `${Math.min(item.percentage, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-600">{formatCurrency(item.total)} ({item.count} expenses)</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600">Total Period Spend: <span className="font-black text-gray-900">{formatCurrency(trends.totalExpenses)}</span></p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RECONCILIATION VIEW */}
        {viewMode === "reconciliation" && reconciliation && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">Matched</p>
                <p className="mt-3 text-3xl font-black text-emerald-700">{reconciliation.matched.length}</p>
                <p className="mt-1 text-xs text-emerald-700">{formatCurrency(reconciliation.matchedTotal)}</p>
              </div>
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-700">Unmatched</p>
                <p className="mt-3 text-3xl font-black text-amber-700">{reconciliation.unmatched.length}</p>
                <p className="mt-1 text-xs text-amber-700">{formatCurrency(reconciliation.unmatchedTotal)}</p>
              </div>
              <div className="rounded-[24px] border border-sky-200 bg-sky-50 p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700">Total</p>
                <p className="mt-3 text-3xl font-black text-sky-700">{reconciliation.matched.length + reconciliation.unmatched.length}</p>
                <p className="mt-1 text-xs text-sky-700">{formatCurrency(reconciliation.totalExpenses)}</p>
              </div>
              <div className={`${reconciliation.matchRate >= 90 ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"} rounded-[24px] border p-4 shadow-sm`}>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-600">Match rate</p>
                <p className={`mt-3 text-3xl font-black ${reconciliation.matchRate >= 90 ? "text-emerald-700" : "text-rose-600"}`}>{reconciliation.matchRate.toFixed(1)}%</p>
                <p className={`mt-1 text-xs ${reconciliation.matchRate >= 90 ? "text-emerald-700" : "text-rose-700"}`}>{reconciliation.matchRate >= 90 ? "Excellent" : "Action needed"}</p>
              </div>
            </div>

            {/* Reconciliation Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Reconciliation Status Overview</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    {
                      name: "Status",
                      Matched: reconciliation.matched.length,
                      Unmatched: reconciliation.unmatched.length
                    }
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Matched" fill="#10b981" name="Matched Invoices" />
                  <Bar dataKey="Unmatched" fill="#f59e0b" name="Awaiting Invoice" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Matched & Unmatched Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-green-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4">✓ Matched Expenses ({reconciliation.matched.length})</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {reconciliation.matched.length > 0 ? reconciliation.matched.map(expense => (
                    <div key={expense._id} className="p-3 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-bold text-gray-900 text-sm">{expense.description}</p>
                          <p className="text-xs text-gray-600 mt-1">Invoice: <span className="font-mono font-bold">{expense.linkedInvoice}</span></p>
                        </div>
                        <span className="text-sm font-bold text-green-600">{formatCurrency(expense.amount)}</span>
                      </div>
                    </div>
                  )) : <p className="text-sm text-gray-600 italic">No matched expenses</p>}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4">⚠ Unmatched Expenses ({reconciliation.unmatched.length})</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {reconciliation.unmatched.length > 0 ? reconciliation.unmatched.map(expense => (
                    <div key={expense._id} className="p-3 bg-amber-50 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-bold text-gray-900 text-sm">{expense.description}</p>
                          <p className="text-xs text-gray-600 mt-1">Status: <span className="font-bold">{expense.status}</span></p>
                        </div>
                        <span className="text-sm font-bold text-amber-600">{formatCurrency(expense.amount)}</span>
                      </div>
                      <button className="mt-2 w-full px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded transition-colors">
                        🔗 Link Invoice
                      </button>
                    </div>
                  )) : <p className="text-sm text-gray-600 italic">No unmatched expenses - all reconciled!</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BUDGET ANALYSIS VIEW */}
        {viewMode === "budget" && budgetAnalysis && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl">
                <p className="text-xs text-gray-600 font-bold">TOTAL BUDGET</p>
                <p className="text-2xl font-black text-blue-600">{formatCurrency(budgetAnalysis.totals.budget)}</p>
                <p className="text-xs text-gray-600 mt-1">{Object.keys(budgetAnalysis.byCategory).length} categories</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 p-4 rounded-2xl">
                <p className="text-xs text-gray-600 font-bold">ACTUAL SPEND</p>
                <p className="text-2xl font-black text-purple-600">{formatCurrency(budgetAnalysis.totals.actual)}</p>
                <p className="text-xs text-gray-600 mt-1">Month {budgetAnalysis.month}/{budgetAnalysis.year}</p>
              </div>
              <div className={`${budgetAnalysis.totals.variance > 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"} border p-4 rounded-2xl`}>
                <p className="text-xs text-gray-600 font-bold">VARIANCE</p>
                <p className={`text-2xl font-black ${budgetAnalysis.totals.variance > 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(budgetAnalysis.totals.variance)}</p>
                <p className={`text-xs mt-1 ${budgetAnalysis.totals.variance > 0 ? "text-green-700" : "text-red-700"}`}>{budgetAnalysis.totals.variancePercent.toFixed(1)}% {budgetAnalysis.totals.variance > 0 ? "under" : "over"} budget</p>
              </div>
              <div className={`${budgetAnalysis.overBudgetCount === 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"} border p-4 rounded-2xl`}>
                <p className="text-xs text-gray-600 font-bold">OVER BUDGET</p>
                <p className={`text-2xl font-black ${budgetAnalysis.overBudgetCount === 0 ? "text-emerald-600" : "text-red-600"}`}>{budgetAnalysis.overBudgetCount}</p>
                <p className={`text-xs mt-1 ${budgetAnalysis.overBudgetCount === 0 ? "text-emerald-700" : "text-red-700"}`}>{budgetAnalysis.overBudgetCount === 0 ? "All categories controlled" : "Categories need attention"}</p>
              </div>
            </div>

            {/* Budget vs Actual Comparison Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Budget vs Actual by Category</h2>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={Object.entries(budgetAnalysis.byCategory).map(([cat, data]) => ({
                  category: EXPENSE_CATEGORIES.find(c => c.value === cat)?.label?.split('/')[0],
                  Budget: data.budget,
                  Actual: data.actual
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="category" stroke="#6b7280" angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#6b7280" />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="Budget" fill="#3b82f6" name="Budget" />
                  <Bar dataKey="Actual" fill="#10b981" name="Actual Spend" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(budgetAnalysis.byCategory).map(([category, data]) => (
                <div key={category} className={`p-4 border rounded-xl ${data.actual > data.budget ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"}`}>
                  <div className="flex justify-between items-start mb-3">
                    <p className="font-bold text-gray-900">{EXPENSE_CATEGORIES.find(c => c.value === category)?.label}</p>
                    <span className={`text-xs font-black px-2 py-1 rounded ${data.actual > data.budget ? "bg-red-200 text-red-700" : "bg-green-200 text-green-700"}`}>
                      {data.actual > data.budget ? "OVER" : "UNDER"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">Budget</span>
                      <span className="font-bold text-gray-900">{formatCurrency(data.budget)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: "100%" }} />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">Actual</span>
                      <span className="font-bold text-gray-900">{formatCurrency(data.actual)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all ${data.actual > data.budget ? "bg-red-600" : "bg-green-600"}`}
                        style={{ width: `${Math.min((data.actual / data.budget) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs font-bold pt-1">
                      <span className="text-gray-600">Variance</span>
                      <span className={data.variance > 0 ? "text-green-700" : "text-red-700"}>
                        {data.variance > 0 ? "+" : "-"}{formatCurrency(Math.abs(data.variance))} ({data.variancePercent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PROCUREMENT APPROVALS VIEW - PHASE 1 ENHANCEMENT */}
        {viewMode === "procurement" && isAdmin && (
          <div className="space-y-6">
            {/* Summary Cards */}
            {procurementSummary && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
                  <p className="text-xs text-gray-600 font-bold">PENDING APPROVALS</p>
                  <p className="text-3xl font-black text-emerald-600">{procurementSummary.totalPending || 0}</p>
                  <p className="text-xs text-emerald-700 mt-1 font-bold">Awaiting approval</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                  <p className="text-xs text-gray-600 font-bold">TOTAL AMOUNT</p>
                  <p className="text-2xl font-black text-amber-600">{formatCurrency(procurementSummary.totalAmount || 0)}</p>
                  <p className="text-xs text-amber-700 mt-1 font-bold">To be approved</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl">
                  <p className="text-xs text-gray-600 font-bold">SUPPLIERS</p>
                  <p className="text-3xl font-black text-blue-600">{Object.keys(procurementSummary.bySupplier || {}).length}</p>
                  <p className="text-xs text-blue-700 mt-1 font-bold">Involved in pending</p>
                </div>
              </div>
            )}

            {/* Pending Procurement Expenses List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">📦 Pending Procurement Expenses</h2>
                <p className="text-sm text-gray-600 mt-1">Goods received but awaiting manager approval</p>
              </div>

              {pendingProcurements.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p className="text-lg font-bold">✓ All procurement expenses approved!</p>
                  <p className="text-sm mt-1">No pending approvals at this time</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Supplier</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Created By</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Payment Terms</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pendingProcurements.map(expense => (
                        <tr key={expense._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-bold text-gray-900">{expense.supplier?.name || "Unknown"}</p>
                              <p className="text-xs text-gray-600 mt-1">PO #{expense.linkedPurchaseOrder?._id?.slice(-8)}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-black text-emerald-600">{formatCurrency(expense.amount)}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-700">{expense.createdBy?.name || "System"}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-600">{new Date(expense.createdAt).toLocaleDateString()}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-block px-3 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-700">
                              {expense.linkedPurchaseOrder?.paymentTerms || "Immediate"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => approveProcurementExpense(expense._id)}
                                disabled={processing}
                                className="px-3 py-2 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
                              >
                                ✓ Approve
                              </button>
                              <button
                                onClick={() => rejectProcurementExpense(expense._id)}
                                disabled={processing}
                                className="px-3 py-2 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-50"
                              >
                                ✕ Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Expenses;
