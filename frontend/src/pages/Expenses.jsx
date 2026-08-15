import { useEffect, useState, useMemo, useRef } from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import request from "../api/client.js";
import { formatCurrency } from "../utils/formatters.js";
import { useAuth } from "../context/AuthContext.jsx";
import { getBranches } from "../api/branches.js";

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
    inventoryItems: []
  });

  // Inventory form state for adding multiple items
  const [inventoryForm, setInventoryForm] = useState({
    productName: "",
    quantity: "",
    unitCost: ""
  });

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

    // Top category
    const categoryTotals = {};
    currentMonthExpenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });
    const topCategory = Object.entries(categoryTotals).sort(([,a], [,b]) => b - a)[0];

    // MoM change
    const momChange = totalLastMonth === 0 ? 0 : ((totalCurrentMonth - totalLastMonth) / totalLastMonth) * 100;

    return {
      totalCurrentMonth,
      topCategory: topCategory ? EXPENSE_CATEGORIES.find(c => c.value === topCategory[0])?.label : "N/A",
      momChange
    };
  }, [expenses]);

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
  const addInventoryItem = () => {
    if (!inventoryForm.productName || !inventoryForm.quantity || !inventoryForm.unitCost) {
      setStatusMsg({ type: "error", text: "All inventory fields are required" });
      return;
    }

    const newItem = {
      productName: inventoryForm.productName,
      quantity: Number(inventoryForm.quantity),
      unitCost: Number(inventoryForm.unitCost)
    };

    setFormData(prev => ({
      ...prev,
      inventoryItems: [...prev.inventoryItems, newItem]
    }));

    setInventoryForm({ productName: "", quantity: "", unitCost: "" });
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
          inventoryItems: []
        });
        setInventoryForm({ productName: "", quantity: "", unitCost: "" });
        setIsFormOpen(false);
        setStatusMsg({ type: "success", text: "Expense added successfully!" });
        
        // 🔥 REFRESH INVENTORY DATA IF THIS WAS AN INVENTORY EXPENSE
        if (formData.category === "inventory") {
          refreshInventoryRelatedData();
        }
        
        setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000);
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
        setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000);
      }
    } catch (err) {
      setStatusMsg({ type: "error", text: err.message || "Failed to reject expense." });
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case "approved":
        return "bg-green-50 text-green-700";
      case "rejected":
        return "bg-red-50 text-red-700";
      case "pending":
      default:
        return "bg-yellow-50 text-yellow-700";
    }
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
    <section className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black text-gray-900">Expenses</h1>
            <p className="text-sm text-gray-500 mt-1">Track and manage all business expenses</p>
          </div>
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg"
          >
            + Add Expense
          </button>
        </div>

        {/* STATUS MESSAGE */}
        {statusMsg.text && (
          <div className={`px-4 py-3 rounded-xl text-sm font-bold ${
            statusMsg.type === "error" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
          }`}>
            {statusMsg.text}
          </div>
        )}

        {/* INSIGHTS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2">Total Expenses</p>
            <p className="text-3xl font-black text-gray-900">{formatCurrency(metrics.totalCurrentMonth)}</p>
            <p className="text-xs text-gray-400 mt-2">This month</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2">Top Category</p>
            <p className="text-2xl font-black text-gray-900 truncate">{metrics.topCategory}</p>
            <p className="text-xs text-gray-400 mt-2">Highest spending</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2">MoM Change</p>
            <div className="flex items-baseline gap-2">
              <p className={`text-3xl font-black ${metrics.momChange >= 0 ? "text-red-500" : "text-green-600"}`}>
                {Math.abs(metrics.momChange).toFixed(1)}%
              </p>
              <p className={`text-xs font-bold ${metrics.momChange >= 0 ? "text-red-500" : "text-green-600"}`}>
                {metrics.momChange >= 0 ? "↑ Up" : "↓ Down"}
              </p>
            </div>
            <p className="text-xs text-gray-400 mt-2">vs. last month</p>
          </div>
        </div>

        {/* ADD EXPENSE FORM */}
        {isFormOpen && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Add New Expense</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="number"
                placeholder="Amount (₦)"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
                className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
              />
              
              <input
                type="text"
                placeholder="Description (e.g., 'Generator Diesel')"
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
              />

              <select
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
              >
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>

              <select
                value={formData.paymentMethod}
                onChange={e => setFormData({...formData, paymentMethod: e.target.value})}
                className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
              >
                {PAYMENT_METHODS.map(method => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>

              <input
                type="date"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
              />

              <select
                value={formData.branch}
                onChange={e => setFormData({...formData, branch: e.target.value})}
                className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
              >
                <option value="">Select Branch (Optional)</option>
                {branches.map(branch => (
                  <option key={branch._id} value={branch._id}>{branch.name}</option>
                ))}
              </select>

              <input
                type="number"
                placeholder="Budget Allocation (Optional)"
                value={formData.budgetAllocation}
                onChange={e => setFormData({...formData, budgetAllocation: e.target.value})}
                className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
              />

              {formData.category === "inventory" && (
                <div className="space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h4 className="font-bold text-gray-700">Add Inventory Items</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Product Name"
                      value={inventoryForm.productName}
                      onChange={e => setInventoryForm({...inventoryForm, productName: e.target.value})}
                      className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                    <input
                      type="number"
                      min="1"
                      placeholder="Quantity"
                      value={inventoryForm.quantity}
                      onChange={e => setInventoryForm({...inventoryForm, quantity: e.target.value})}
                      className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Unit Cost"
                      value={inventoryForm.unitCost}
                      onChange={e => setInventoryForm({...inventoryForm, unitCost: e.target.value})}
                      className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                  </div>
                  
                  <button
                    type="button"
                    onClick={addInventoryItem}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
                  >
                    + Add Item
                  </button>

                  {formData.inventoryItems.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="font-semibold text-gray-700">Items in this expense:</h5>
                      {formData.inventoryItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                          <span className="text-sm font-semibold">
                            {item.productName} × {item.quantity} @ ₦{Number(item.unitCost).toLocaleString()}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeInventoryItem(idx)}
                            className="text-red-600 hover:text-red-800 font-bold"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Supplier Name (optional)"
                    value={formData.supplierName}
                    onChange={e => setFormData({...formData, supplierName: e.target.value})}
                    className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Supplier Phone (optional)"
                    value={formData.supplierPhone}
                    onChange={e => setFormData({...formData, supplierPhone: e.target.value})}
                    className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={e => setFormData({...formData, receipt: e.target.files?.[0] || null})}
                className="px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold"
              />
            </div>

            <textarea
              placeholder="Notes (optional)"
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
              rows="2"
            />

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleAddExpense}
                disabled={processing}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {processing ? "Adding..." : "Add Expense"}
              </button>
              <button
                onClick={() => setIsFormOpen(false)}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* FILTERS & CONTROLS */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex flex-wrap gap-2 items-center pb-4 border-b">
            <button
              onClick={() => setViewMode("list")}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${viewMode === "list" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
            >
              📋 List View
            </button>
            {isAdmin && (
              <button
                onClick={loadProcurementApprovals}
                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${viewMode === "procurement" ? "bg-emerald-600 text-white" : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"}`}
              >
                ✓ Procurement Approvals {pendingProcurements.length > 0 && `(${pendingProcurements.length})`}
              </button>
            )}
            <button
              onClick={loadTrends}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${viewMode === "trends" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
            >
              📈 Trends
            </button>
            <button
              onClick={loadReconciliation}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${viewMode === "reconciliation" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
            >
              🔗 Reconciliation
            </button>
            <button
              onClick={loadBudgetAnalysis}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${viewMode === "budget" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
            >
              💰 Budget Analysis
            </button>
            <button
              onClick={loadLedger}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${viewMode === "ledger" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
            >
              📒 General Ledger
            </button>
          </div>

          {viewMode === "list" && (
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="flex-1 min-w-[200px] px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-bold"
              />

              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-bold"
              >
                <option value="">All Categories</option>
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>

              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-bold"
              >
                <option value="">All Branches</option>
                {branches.map(branch => (
                  <option key={branch._id} value={branch._id}>{branch.name}</option>
                ))}
              </select>

              <select
                value={dateRange}
                onChange={e => setDateRange(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-bold"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="all">All Time</option>
              </select>
            </div>
          )}

          {selectedExpenses.size > 0 && viewMode === "list" && (
            <div className="flex gap-2 pt-2 border-t">
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-sm transition-all"
              >
                🗑️ Delete ({selectedExpenses.size})
              </button>
              <button
                onClick={handleBulkExport}
                className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-600 font-bold rounded-xl text-sm transition-all"
              >
                📥 Export ({selectedExpenses.size})
              </button>
            </div>
          )}
        </div>

        {viewMode === "ledger" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-gray-900">General Ledger</h2>
                <p className="text-sm text-gray-500">Approved expense postings and accounting movement</p>
              </div>
              <div className="flex gap-2 text-sm font-bold">
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
              <p className="text-gray-400 font-bold">No expenses found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedExpenses.size === filteredExpenses.length && filteredExpenses.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left font-bold text-gray-700">Date</th>
                    <th className="px-6 py-3 text-left font-bold text-gray-700">Description</th>
                    <th className="px-6 py-3 text-left font-bold text-gray-700">Category</th>
                    <th className="px-6 py-3 text-left font-bold text-gray-700">Supplier</th>
                    <th className="px-6 py-3 text-left font-bold text-gray-700">Payment Method</th>
                    <th className="px-6 py-3 text-right font-bold text-gray-700">Amount</th>
                    <th className="px-6 py-3 text-center font-bold text-gray-700">Status</th>
                    <th className="px-6 py-3 text-left font-bold text-gray-700">Created By</th>
                    <th className="px-6 py-3 text-center font-bold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredExpenses.map(expense => (
                    <tr key={expense._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedExpenses.has(expense._id)}
                          onChange={() => toggleExpenseSelection(expense._id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">
                        {new Date(expense.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        <p className="font-semibold">{expense.description}</p>
                        {expense.notes && <p className="text-xs text-gray-500 mt-1">{expense.notes}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-full">
                          {EXPENSE_CATEGORIES.find(c => c.value === expense.category)?.label || expense.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {expense.supplier?.name ? (
                          <div>
                            <p className="font-semibold text-sm">{expense.supplier.name}</p>
                            {expense.supplier.phone && <p className="text-xs text-gray-500">{expense.supplier.phone}</p>}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-700 font-semibold">
                        {PAYMENT_METHODS.find(m => m.value === expense.paymentMethod)?.label || expense.paymentMethod}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-gray-900">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 font-bold text-xs rounded-full ${getStatusBadgeColor(expense.status)}`}>
                          {getStatusIcon(expense.status)} {expense.status || "pending"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700 text-sm">
                        <p className="font-semibold">{expense.createdBy?.name || "Unknown"}</p>
                        {expense.approvedBy && <p className="text-xs text-green-600">Approved by: {expense.approvedBy.name}</p>}
                      </td>
                      <td className="px-6 py-4 text-center space-y-2">
                        <div className="flex flex-col gap-1">
                          {isAdmin && expense.status === "pending" && (
                            <>
                              <button
                                onClick={() => handleApproveExpense(expense._id)}
                                className="text-xs px-2 py-1 bg-green-50 hover:bg-green-100 text-green-600 font-bold rounded transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectExpense(expense._id)}
                                className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDeleteExpense(expense._id)}
                            className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded transition-colors"
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
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-green-50 border border-green-200 p-4 rounded-2xl">
                <p className="text-xs text-gray-600 font-bold">MATCHED</p>
                <p className="text-2xl font-black text-green-600">{reconciliation.matched.length}</p>
                <p className="text-xs text-green-700 mt-1">{formatCurrency(reconciliation.matchedTotal)}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                <p className="text-xs text-gray-600 font-bold">UNMATCHED</p>
                <p className="text-2xl font-black text-amber-600">{reconciliation.unmatched.length}</p>
                <p className="text-xs text-amber-700 mt-1">{formatCurrency(reconciliation.unmatchedTotal)}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl">
                <p className="text-xs text-gray-600 font-bold">TOTAL</p>
                <p className="text-2xl font-black text-blue-600">{reconciliation.matched.length + reconciliation.unmatched.length}</p>
                <p className="text-xs text-blue-700 mt-1">{formatCurrency(reconciliation.totalExpenses)}</p>
              </div>
              <div className={`${reconciliation.matchRate >= 90 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"} border p-4 rounded-2xl`}>
                <p className="text-xs text-gray-600 font-bold">MATCH RATE</p>
                <p className={`text-2xl font-black ${reconciliation.matchRate >= 90 ? "text-emerald-600" : "text-red-600"}`}>{reconciliation.matchRate.toFixed(1)}%</p>
                <p className={`text-xs mt-1 ${reconciliation.matchRate >= 90 ? "text-emerald-700" : "text-red-700"}`}>{reconciliation.matchRate >= 90 ? "Excellent" : "Action needed"}</p>
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
