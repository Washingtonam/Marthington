import Expense from "./expense.model.js";
import Business from "../businesses/business.model.js";
import User from "../users/user.model.js";
import { sendBudgetExceededEmail } from "../../utils/emailService.js";
import { EXPENSE_CATEGORIES } from "../../config/constants.js";
import { postExpenseToGL } from "../transactions/transaction.utils.js";
import { shouldAutoApproveExpense } from "./expenseApproval.utils.js";

// 🔥 CHECK BUDGET AND SEND ALERTS
const checkAndAlertBudgetExceeded = async (businessId, month, year, createdBy) => {
  try {
    // Get the first and last day of the month
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    // Fetch all expenses for this month
    const monthlyExpenses = await Expense.find({
      business: businessId,
      date: { $gte: monthStart, $lte: monthEnd }
    });

    // Calculate spending by category
    const categorySpending = {};
    const categoryBudgets = {};
    let hasOverBudget = false;
    let totalVariance = 0;

    monthlyExpenses.forEach(expense => {
      const cat = expense.category || "miscellaneous";
      categorySpending[cat] = (categorySpending[cat] || 0) + expense.amount;
      if (expense.budgetAllocation) {
        categoryBudgets[cat] = expense.budgetAllocation;
      }
    });

    // Check for budget overages and format for email
    const overBudgetCategories = [];
    Object.entries(categoryBudgets).forEach(([category, budget]) => {
      const actual = categorySpending[category] || 0;
      const variance = budget - actual;
      const variancePercent = (variance / budget) * 100;

      if (actual > budget) {
        hasOverBudget = true;
        totalVariance += (actual - budget);
        const categoryLabel = EXPENSE_CATEGORIES?.find(c => c.value === category)?.label || category;
        overBudgetCategories.push({
          label: categoryLabel,
          budget: Math.round(budget),
          actual: Math.round(actual),
          variance: Math.round(actual - budget),
          variancePercent: Math.abs(variancePercent)
        });
      }
    });

    // If there are budget overages, send alert to finance admins
    if (hasOverBudget) {
      const business = await Business.findById(businessId).select("name");
      const adminUsers = await User.find({
        business: businessId,
        role: { $in: ["owner", "super_admin", "manager"] },
        email: { $exists: true, $ne: "" }
      });

      const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const expensesUrl = `${baseUrl}/expenses`;

      for (const admin of adminUsers) {
        if (admin.email) {
          await sendBudgetExceededEmail({
            recipientEmail: admin.email,
            recipientName: admin.name,
            businessName: business?.name,
            businessId,
            month: `${String(month).padStart(2, '0')}`,
            year,
            categories: overBudgetCategories,
            totalVariance: Math.round(totalVariance),
            expensesUrl,
            createdBy
          });
        }
      }

      console.log(`💰 Budget alert sent for ${business?.name} - ${month}/${year}`);
    }
  } catch (error) {
    console.error("Budget alert check failed:", error.message);
    // Don't throw - allow expense creation to continue even if alert fails
  }
};

// 🔥 CREATE EXPENSE
const createExpense = async (req, res) => {
  try {
    const { amount, description, category, paymentMethod, date, notes, branch, budgetAllocation, linkedInvoice, supplier } = req.body;
    const businessId = req.user.businessId;

    // Validate required fields
    if (!amount || !description) {
      return res.status(400).json({ message: "Amount and description are required" });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    // Check business exists
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }

    const parsedAmount = parseFloat(amount);
    const businessSettings = business?.approvalRules || {};
    const autoApprovalDecision = shouldAutoApproveExpense({
      amount: parsedAmount,
      category: category || "miscellaneous",
      supplierId: supplier || null,
      businessSettings
    });

    // Create expense
    const expense = await Expense.create({
      business: businessId,
      branch: branch || null,
      amount: parsedAmount,
      description: description.trim(),
      category: category || "miscellaneous",
      paymentMethod: paymentMethod || "cash",
      date: date ? new Date(date) : new Date(),
      notes: notes || "",
      createdBy: req.user.id,
      approvedBy: autoApprovalDecision.shouldAutoApprove ? req.user.id : null,
      status: autoApprovalDecision.status,
      linkedInvoice: linkedInvoice || null,
      budgetAllocation: budgetAllocation || null,
      supplier: supplier || null
    });

    if (autoApprovalDecision.shouldAutoApprove) {
      await postExpenseToGL(expense);
    }

    await expense.populate("createdBy", "name email");
    await expense.populate("branch", "name");

    // Check if budget exceeded and send alert
    const expenseDate = new Date(expense.date);
    const month = expenseDate.getMonth() + 1;
    const year = expenseDate.getFullYear();
    
    // Non-blocking budget alert check
    checkAndAlertBudgetExceeded(businessId, month, year, req.user.id).catch(err => 
      console.error("Budget alert check error:", err.message)
    );

    return res.status(201).json({
      message: "Expense created successfully",
      expense
    });
  } catch (err) {
    console.error("Create Expense Error:", err);
    return res.status(500).json({ message: err.message || "Failed to create expense" });
  }
};

// 🔥 GET ALL EXPENSES (WITH FILTERS)
const getExpenses = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { category, startDate, endDate, paymentMethod, status, branch } = req.query;

    // Build filter
    const filter = { business: businessId };

    if (category && category !== "all") {
      filter.category = category;
    }

    if (paymentMethod && paymentMethod !== "all") {
      filter.paymentMethod = paymentMethod;
    }

    if (status && status !== "all") {
      filter.status = status;
    }

    if (branch && branch !== "all") {
      filter.branch = branch;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const expenses = await Expense.find(filter)
      .populate("createdBy", "name email")
      .populate("approvedBy", "name email")
      .populate("branch", "name")
      .sort({ date: -1 })
      .exec();

    // Calculate summary metrics
    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
    const categoryTotals = {};
    const methodTotals = {};
    const branchTotals = {};

    expenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
      methodTotals[e.paymentMethod] = (methodTotals[e.paymentMethod] || 0) + e.amount;
      if (e.branch) {
        const branchKey = e.branch?.name || "Unassigned";
        branchTotals[branchKey] = (branchTotals[branchKey] || 0) + e.amount;
      }
    });

    return res.status(200).json({
      count: expenses.length,
      totalAmount,
      categoryTotals,
      methodTotals,
      branchTotals,
      expenses
    });
  } catch (err) {
    console.error("Get Expenses Error:", err);
    return res.status(500).json({ message: err.message || "Failed to fetch expenses" });
  }
};

// 🔥 GET SINGLE EXPENSE
const getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.user.businessId;

    const expense = await Expense.findOne({ _id: id, business: businessId })
      .populate("createdBy", "name email")
      .populate("approvedBy", "name email")
      .exec();

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    return res.status(200).json(expense);
  } catch (err) {
    console.error("Get Expense Error:", err);
    return res.status(500).json({ message: err.message || "Failed to fetch expense" });
  }
};

// 🔥 UPDATE EXPENSE
const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.user.businessId;
    const { amount, description, category, paymentMethod, date, notes, status } = req.body;

    const expense = await Expense.findOne({ _id: id, business: businessId });
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    // Only owner/admin can change status
    if (status && req.user.role !== "owner" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Unauthorized to change expense status" });
    }

    if (amount !== undefined) {
      if (amount <= 0) return res.status(400).json({ message: "Amount must be > 0" });
      expense.amount = parseFloat(amount);
    }

    if (description) expense.description = description.trim();
    if (category) expense.category = category;
    if (paymentMethod) expense.paymentMethod = paymentMethod;
    if (date) expense.date = new Date(date);
    if (notes !== undefined) expense.notes = notes;
    if (status) {
      expense.status = status;
      if (status === "approved") {
        expense.approvedBy = req.user.id;
      }
    }

    await expense.save();
    await expense.populate("createdBy", "name email");
    await expense.populate("approvedBy", "name email");

    return res.status(200).json({
      message: "Expense updated successfully",
      expense
    });
  } catch (err) {
    console.error("Update Expense Error:", err);
    return res.status(500).json({ message: err.message || "Failed to update expense" });
  }
};

// 🔥 DELETE EXPENSE
const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.user.businessId;

    const expense = await Expense.findOneAndDelete({ _id: id, business: businessId });
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    return res.status(200).json({
      message: "Expense deleted successfully",
      expenseId: id
    });
  } catch (err) {
    console.error("Delete Expense Error:", err);
    return res.status(500).json({ message: err.message || "Failed to delete expense" });
  }
};

// 🔥 BULK DELETE EXPENSES
const bulkDeleteExpenses = async (req, res) => {
  try {
    const { ids } = req.body;
    const businessId = req.user.businessId;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No expenses selected for deletion" });
    }

    const result = await Expense.deleteMany({ _id: { $in: ids }, business: businessId });

    return res.status(200).json({
      message: `${result.deletedCount} expense(s) deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error("Bulk Delete Error:", err);
    return res.status(500).json({ message: err.message || "Failed to delete expenses" });
  }
};

// 🔥 GET EXPENSE SUMMARY (FOR DASHBOARD/REPORTS)
const getExpenseSummary = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { startDate, endDate } = req.query;

    const filter = { business: businessId };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const expenses = await Expense.find(filter);

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    
    const categoryBreakdown = {};
    const CATEGORIES = ["inventory", "logistics", "utilities", "salaries", "rent", "marketing", "miscellaneous"];
    
    CATEGORIES.forEach(cat => {
      const catTotal = expenses
        .filter(e => e.category === cat)
        .reduce((sum, e) => sum + e.amount, 0);
      if (catTotal > 0) {
        categoryBreakdown[cat] = catTotal;
      }
    });

    // Get top category
    const topCategory = Object.entries(categoryBreakdown).sort(([,a], [,b]) => b - a)[0];

    // Get month-over-month comparison
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const currentMonthExpenses = expenses.filter(e => {
      const eDate = new Date(e.date);
      return eDate.getMonth() === currentMonth && eDate.getFullYear() === currentYear;
    });

    const lastMonthExpenses = expenses.filter(e => {
      const eDate = new Date(e.date);
      return eDate.getMonth() === lastMonth && eDate.getFullYear() === lastMonthYear;
    });

    const currentMonthTotal = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const lastMonthTotal = lastMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const momChange = lastMonthTotal === 0 ? 0 : ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;

    return res.status(200).json({
      totalExpenses,
      currentMonthTotal,
      lastMonthTotal,
      momChange: Math.round(momChange * 100) / 100,
      topCategory: topCategory ? { category: topCategory[0], amount: topCategory[1] } : null,
      categoryBreakdown,
      expenseCount: expenses.length
    });
  } catch (err) {
    console.error("Get Summary Error:", err);
    return res.status(500).json({ message: err.message || "Failed to get expense summary" });
  }
};

// 🔥 APPROVE EXPENSE
const approveExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.user.businessId;
    const { notes } = req.body;

    // Only owner/admin can approve
    if (req.user.role !== "owner" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Unauthorized to approve expenses" });
    }

    const expense = await Expense.findOne({ _id: id, business: businessId });
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    expense.status = "approved";
    expense.approvedBy = req.user.id;
    if (notes) expense.notes = notes;

    await expense.save();

    const postedLedgerEntry = await postExpenseToGL(expense);

    await expense.populate("createdBy", "name email");
    await expense.populate("approvedBy", "name email");

    return res.status(200).json({
      message: "Expense approved successfully",
      expense,
      ledgerEntry: postedLedgerEntry
    });
  } catch (err) {
    console.error("Approve Expense Error:", err);
    return res.status(500).json({ message: err.message || "Failed to approve expense" });
  }
};

// 🔥 REJECT EXPENSE
const rejectExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.user.businessId;
    const { notes } = req.body;

    // Only owner/admin can reject
    if (req.user.role !== "owner" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Unauthorized to reject expenses" });
    }

    const expense = await Expense.findOne({ _id: id, business: businessId });
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    expense.status = "rejected";
    if (notes) expense.notes = notes;

    await expense.save();
    await expense.populate("createdBy", "name email");

    return res.status(200).json({
      message: "Expense rejected successfully",
      expense
    });
  } catch (err) {
    console.error("Reject Expense Error:", err);
    return res.status(500).json({ message: err.message || "Failed to reject expense" });
  }
};

// 🔥 GET EXPENSE TRENDS (FOR CHARTS)
const getExpenseTrends = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { months = 6, category } = req.query;

    const filter = { business: businessId };
    if (category && category !== "all") {
      filter.category = category;
    }

    const expenses = await Expense.find(filter)
      .select("amount date category")
      .lean();

    // Build month-by-month breakdown
    const now = new Date();
    const trendMap = {};
    const categoryMap = {};

    for (let i = parseInt(months) - 1; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = monthDate.toLocaleString("default", { month: "short", year: "numeric" });
      trendMap[monthKey] = 0;
    }

    expenses.forEach(e => {
      const expenseDate = new Date(e.date);
      const monthKey = expenseDate.toLocaleString("default", { month: "short", year: "numeric" });
      
      if (trendMap.hasOwnProperty(monthKey)) {
        trendMap[monthKey] += e.amount;
      }

      // Category breakdown
      const catKey = e.category;
      if (!categoryMap[catKey]) {
        categoryMap[catKey] = 0;
      }
      categoryMap[catKey] += e.amount;
    });

    const trend = Object.entries(trendMap).map(([month, total]) => ({ month, total }));
    const categoryBreakdown = Object.entries(categoryMap).map(([category, total]) => ({ category, total }));

    return res.status(200).json({
      trend,
      categoryBreakdown,
      totalExpenses: expenses.reduce((sum, e) => sum + e.amount, 0)
    });
  } catch (err) {
    console.error("Get Expense Trends Error:", err);
    return res.status(500).json({ message: err.message || "Failed to fetch expense trends" });
  }
};

// 🔥 LINK SUPPLIER INVOICE TO EXPENSE (RECONCILIATION)
const linkInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.user.businessId;
    const { invoiceId } = req.body;

    const expense = await Expense.findOne({ _id: id, business: businessId });
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    expense.linkedInvoice = invoiceId;
    await expense.save();

    return res.status(200).json({
      message: "Invoice linked successfully",
      expense
    });
  } catch (err) {
    console.error("Link Invoice Error:", err);
    return res.status(500).json({ message: err.message || "Failed to link invoice" });
  }
};

// 🔥 GET RECONCILIATION REPORT (MATCHED & UNMATCHED INVOICES)
const getReconciliationReport = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { category, branch } = req.query;

    const filter = { business: businessId };
    if (category && category !== "all") {
      filter.category = category;
    }
    if (branch && branch !== "all") {
      filter.branch = branch;
    }

    const expenses = await Expense.find(filter)
      .populate("linkedInvoice", "invoiceNumber amount balanceDue status")
      .populate("branch", "name")
      .lean();

    const matched = expenses.filter(e => e.linkedInvoice !== null);
    const unmatched = expenses.filter(e => e.linkedInvoice === null);

    const matchedTotal = matched.reduce((sum, e) => sum + e.amount, 0);
    const unmatchedTotal = unmatched.reduce((sum, e) => sum + e.amount, 0);

    return res.status(200).json({
      matched,
      unmatched,
      matchedTotal,
      unmatchedTotal,
      matchRate: expenses.length > 0 ? (matched.length / expenses.length) * 100 : 0
    });
  } catch (err) {
    console.error("Get Reconciliation Report Error:", err);
    return res.status(500).json({ message: err.message || "Failed to fetch reconciliation report" });
  }
};

// 🔥 GET BUDGET VS ACTUAL
const getBudgetVsActual = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { category, month, year } = req.query;

    const filter = { business: businessId };
    if (category && category !== "all") {
      filter.category = category;
    }

    // Set month/year filter
    const currentDate = new Date();
    const filterMonth = month ? parseInt(month) : currentDate.getMonth();
    const filterYear = year ? parseInt(year) : currentDate.getFullYear();

    const monthStart = new Date(filterYear, filterMonth, 1);
    const monthEnd = new Date(filterYear, filterMonth + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    filter.date = { $gte: monthStart, $lte: monthEnd };

    const expenses = await Expense.find(filter)
      .select("amount category budgetAllocation")
      .lean();

    const budgetData = {};
    const CATEGORIES = ["inventory", "logistics", "utilities", "salaries", "rent", "marketing", "miscellaneous"];

    CATEGORIES.forEach(cat => {
      const categoryExpenses = expenses.filter(e => e.category === cat);
      const actual = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
      const budgeted = categoryExpenses.reduce((sum, e) => sum + (e.budgetAllocation || 0), 0) || actual * 1.1; // Default to +10% if no budget

      budgetData[cat] = {
        budget: budgeted,
        actual,
        variance: budgeted - actual,
        variancePercent: budgeted > 0 ? ((budgeted - actual) / budgeted) * 100 : 0
      };
    });

    const totalBudget = Object.values(budgetData).reduce((sum, cat) => sum + cat.budget, 0);
    const totalActual = Object.values(budgetData).reduce((sum, cat) => sum + cat.actual, 0);

    return res.status(200).json({
      month: filterMonth + 1,
      year: filterYear,
      byCategory: budgetData,
      totals: {
        budget: totalBudget,
        actual: totalActual,
        variance: totalBudget - totalActual,
        variancePercent: totalBudget > 0 ? ((totalBudget - totalActual) / totalBudget) * 100 : 0
      }
    });
  } catch (err) {
    console.error("Get Budget vs Actual Error:", err);
    return res.status(500).json({ message: err.message || "Failed to fetch budget report" });
  }
};

// 🔥 GET PENDING PROCUREMENT EXPENSES
const getPendingProcurementExpenses = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { branch, supplier } = req.query;

    const filter = {
      business: businessId,
      status: "pending",
      linkedPurchaseOrder: { $exists: true, $ne: null },
      category: "inventory"
    };

    if (branch) filter.branch = branch;
    if (supplier) filter.supplier = supplier;

    const expenses = await Expense.find(filter)
      .populate("createdBy", "name email")
      .populate("linkedPurchaseOrder", "totalAmount items supplier receiptStatus")
      .populate("linkedPurchaseOrder.supplier", "name paymentTerms")
      .populate("supplier", "name outstandingBalance")
      .populate("branch", "name")
      .sort({ createdAt: -1 });

    const summary = {
      totalPending: expenses.length,
      totalAmount: expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
      byBranch: {},
      bySupplier: {}
    };

    expenses.forEach(expense => {
      const branchName = expense.branch?.name || "Head Office";
      const supplierName = expense.supplier?.name || "Unknown";
      
      summary.byBranch[branchName] = (summary.byBranch[branchName] || 0) + Number(expense.amount);
      summary.bySupplier[supplierName] = (summary.bySupplier[supplierName] || 0) + Number(expense.amount);
    });

    return res.json({
      expenses,
      summary
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to fetch pending procurement expenses" });
  }
};

// 🔥 APPROVE PROCUREMENT EXPENSE (WITH SUPPLIER LEDGER UPDATE)
const approveProcurementExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.user.businessId;
    const { notes } = req.body;

    // Only owner/admin can approve
    if (req.user.role !== "owner" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Unauthorized to approve expenses" });
    }

    const expense = await Expense.findOne({ _id: id, business: businessId })
      .populate("linkedPurchaseOrder")
      .populate("supplier");

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    if (!expense.linkedPurchaseOrder) {
      return res.status(400).json({ message: "This is not a procurement expense" });
    }

    if (expense.status === "approved") {
      return res.status(400).json({ message: "This expense is already approved" });
    }

    // Update expense status
    expense.status = "approved";
    expense.approvedBy = req.user.id;
    if (notes) expense.notes = notes;

    await expense.save();

    // Post to GL
    const postedLedgerEntry = await postExpenseToGL(expense);

    // Populate for response
    await expense.populate("createdBy", "name email");
    await expense.populate("approvedBy", "name email");
    await expense.populate("linkedPurchaseOrder", "totalAmount items supplier");
    await expense.populate("supplier", "name outstandingBalance");

    return res.status(200).json({
      message: "Procurement expense approved successfully",
      expense,
      ledgerEntry: postedLedgerEntry
    });
  } catch (err) {
    console.error("Approve Procurement Expense Error:", err);
    return res.status(500).json({ message: err.message || "Failed to approve expense" });
  }
};

// 🔥 BATCH APPROVE PROCUREMENT EXPENSES
const batchApproveProcurementExpenses = async (req, res) => {
  try {
    const { expenseIds } = req.body;
    const businessId = req.user.businessId;

    if (!Array.isArray(expenseIds) || expenseIds.length === 0) {
      return res.status(400).json({ message: "expenseIds array is required" });
    }

    if (req.user.role !== "owner" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Unauthorized to approve expenses" });
    }

    const expenses = await Expense.find({
      _id: { $in: expenseIds },
      business: businessId,
      linkedPurchaseOrder: { $exists: true, $ne: null }
    });

    if (expenses.length === 0) {
      return res.status(404).json({ message: "No procurement expenses found" });
    }

    const approved = [];
    const failed = [];

    for (const expense of expenses) {
      try {
        if (expense.status === "approved") {
          failed.push({
            id: expense._id,
            reason: "Already approved"
          });
          continue;
        }

        expense.status = "approved";
        expense.approvedBy = req.user.id;
        await expense.save();

        await postExpenseToGL(expense);

        await expense.populate("createdBy", "name email");
        await expense.populate("approvedBy", "name email");

        approved.push(expense);
      } catch (err) {
        failed.push({
          id: expense._id,
          reason: err.message
        });
      }
    }

    return res.status(200).json({
      message: `Approved ${approved.length} expenses`,
      approved,
      failed,
      summary: {
        totalProcessed: expenseIds.length,
        approvedCount: approved.length,
        failedCount: failed.length,
        totalApprovedAmount: approved.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
      }
    });
  } catch (err) {
    console.error("Batch Approve Error:", err);
    return res.status(500).json({ message: err.message || "Failed to batch approve expenses" });
  }
};

export default {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  bulkDeleteExpenses,
  getExpenseSummary,
  approveExpense,
  rejectExpense,
  getExpenseTrends,
  linkInvoice,
  getReconciliationReport,
  getBudgetVsActual,
  getPendingProcurementExpenses,
  approveProcurementExpense,
  batchApproveProcurementExpenses
};
