import mongoose from "mongoose";
import Business from "../businesses/business.model.js";
import Sale from "../sales/sale.model.js";
import Product from "../products/product.model.js";
import Invoice from "../invoices/invoice.model.js";
import Transaction from "../transactions/transaction.model.js";
import School from "../schools/School.js";
import Student from "../schools/Student.js";

const retailSalesFilter = (businessId) => ({
  $and: [
    {
      $or: [
        { business: businessId },
        { businessId: businessId }
      ]
    },
    {
      $or: [
        { industryType: "retail" },
        { industryType: { $exists: false } }
      ]
    }
  ]
});

const getAnalytics = async (req, res) => {
  try {
    // 1. Fetch business and check industry type safely
    const business = await Business.findById(req.user?.businessId).lean();
    const industry = business?.industryType?.trim() || "retail";

    if (industry !== "retail") {
      return res.status(200).json({
        success: true,
        data: {
          totalSales: 0,
          productsCount: 0
        }
      });
    }

    const businessObjectId = new mongoose.Types.ObjectId(req.user.businessId);

    // 2. Original retail metrics calculation logic goes here...
    const sales = await Sale.find(retailSalesFilter(businessObjectId)).lean();
    const products = await Product.find({ business: businessObjectId }).lean();

    const totalSales = sales.length;
    const productsCount = products.length;

    const totalRevenue = sales.reduce(
      (sum, sale) => sum + (sale.totalAmount || 0),
      0
    );

    // 🔥 CALCULATE GROSS PROFIT (from sales)
    const grossProfit = sales.reduce(
      (sum, sale) => sum + (sale.totalProfit || 0),
      0
    );

    // 🔥 GET OPERATING EXPENSES FROM POSTED LEDGER ENTRIES
    const postedExpenseTransactions = await Transaction.find({
      businessId: businessObjectId,
      transactionType: "expense",
      $or: [{ postingType: "debit" }, { postingType: { $exists: false } }],
      status: "posted",
      isDeleted: { $ne: true }
    }).lean();

    const totalOperatingExpenses = postedExpenseTransactions.reduce(
      (sum, tx) => sum + (Number(tx.amount) || 0),
      0
    );

    // 🔥 NET PROFIT = GROSS PROFIT - OPERATING EXPENSES
    const totalProfit = grossProfit - totalOperatingExpenses;

    const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

    const inventoryValue = products.reduce(
      (sum, product) => sum + (Number(product.price) || 0) * (Number(product.stock) || 0),
      0
    );

    const lowStockCount = products.filter((product) => Number(product.stock) <= 5).length;

    // 🔥 ADD AR/AP METRICS
    const invoices = await Invoice.find({ business: businessObjectId }).lean();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
    const sixtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
    const ninetyDaysAgo = new Date(now.setDate(now.getDate() - 30));

    const receivables = invoices.filter(inv => inv.transactionType === "outgoing");
    const payables = invoices.filter(inv => inv.transactionType === "incoming");

    const totalReceivable = receivables.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
    const totalPayable = payables.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
    const overdueReceivables = receivables
      .filter(inv => inv.status === "overdue" || (inv.dueDate && new Date(inv.dueDate) < new Date()))
      .reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
    const overduePayables = payables
      .filter(inv => inv.status === "overdue" || (inv.dueDate && new Date(inv.dueDate) < new Date()))
      .reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
    const pendingInvoices = invoices.filter(inv => inv.status === "pending" || inv.status === "draft").length;

    const map = {};
    sales.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        if (!item?.name) return;
        if (!map[item.name]) {
          map[item.name] = {
            name: item.name,
            quantity: 0,
            revenue: 0
          };
        }
        map[item.name].quantity += Number(item.quantity) || 0;
        map[item.name].revenue += Number(item.total) || 0;
      });
    });

    const topProducts = Object.values(map)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const salesTrendMap = {};
    sales.forEach((sale) => {
      const date = new Date(sale.createdAt).toLocaleDateString();
      salesTrendMap[date] = (salesTrendMap[date] || 0) + (sale.totalAmount || 0);
    });

    const salesTrend = Object.entries(salesTrendMap).map(([date, revenue]) => ({ date, revenue }));

    const metrics = {
      totalSales,
      productsCount,
      totalRevenue,
      totalProfit,
      averageOrderValue,
      inventoryValue,
      lowStockCount,
      totalReceivable,
      totalPayable,
      overdueReceivables,
      overduePayables,
      pendingInvoices
    };

    return res.status(200).json({
      success: true,
      metrics,
      salesTrend,
      topProducts,
      lowStockProducts: []
    });
  } catch (err) {
    console.error("Restoration analytics block failed:", err);
    return res.status(200).json({
      success: true,
      metrics: {
        totalSales: 0,
        productsCount: 0,
        totalRevenue: 0,
        grossProfit: 0,
        totalOperatingExpenses: 0,
        totalProfit: 0,
        averageOrderValue: 0,
        inventoryValue: 0,
        lowStockCount: 0,
        totalReceivable: 0,
        totalPayable: 0,
        overdueReceivables: 0,
        overduePayables: 0,
        pendingInvoices: 0
      },
      salesTrend: [],
      topProducts: [],
      lowStockProducts: []
    });
  }
};

export default {
  getAnalytics
};