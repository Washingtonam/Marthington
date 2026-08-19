import Sale from "../sales/sale.model.js";
import Product from "../products/product.model.js";
import Transaction from "../transactions/transaction.model.js";

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

const getPeriodBoundary = (period) => {
  const now = new Date();

  if (period === "7") {
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 7);
    return cutoff;
  }

  if (period === "30") {
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 30);
    return cutoff;
  }

  if (period === "90") {
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 90);
    return cutoff;
  }

  return null;
};

export const buildReportSnapshot = ({ sales = [], products = [], transactions = [], period = "30" }) => {
  const now = new Date();
  const periodBoundary = getPeriodBoundary(period);

  const filteredSales = periodBoundary
    ? sales.filter((sale) => new Date(sale.createdAt) >= periodBoundary)
    : sales;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date();
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const todaySales = filteredSales.filter((sale) => new Date(sale.createdAt) >= todayStart);
  const weeklySales = filteredSales.filter((sale) => new Date(sale.createdAt) >= weekStart);
  const monthlySales = filteredSales.filter((sale) => new Date(sale.createdAt) >= monthStart);

  const periodRevenue = filteredSales.reduce((sum, sale) => sum + (Number(sale.totalAmount) || 0), 0);
  const periodGrossProfit = filteredSales.reduce((sum, sale) => sum + (Number(sale.totalProfit) || 0), 0);

  const periodTransactions = periodBoundary
    ? transactions.filter((tx) => (!tx.postingType || tx.postingType === "debit") && new Date(tx.occurredAt || tx.createdAt) >= periodBoundary)
    : transactions.filter((tx) => !tx.postingType || tx.postingType === "debit");

  const periodOperatingExpenses = periodTransactions.reduce(
    (sum, tx) => sum + (Number(tx.amount) || 0),
    0
  );

  const periodProfit = periodGrossProfit - periodOperatingExpenses;

  const todayRevenue = todaySales.reduce((sum, sale) => sum + (Number(sale.totalAmount) || 0), 0);
  const monthlyRevenue = monthlySales.reduce((sum, sale) => sum + (Number(sale.totalAmount) || 0), 0);
  const monthlyGrossProfit = monthlySales.reduce((sum, sale) => sum + (Number(sale.totalProfit) || 0), 0);

  const currentMonthTransactions = transactions.filter((tx) => {
    const date = new Date(tx.occurredAt || tx.createdAt);
    return date >= monthStart && tx.status === "posted" && tx.transactionType === "expense" && (!tx.postingType || tx.postingType === "debit");
  });

  const monthlyOperatingExpenses = currentMonthTransactions.reduce(
    (sum, tx) => sum + (Number(tx.amount) || 0),
    0
  );

  const monthlyProfit = monthlyGrossProfit - monthlyOperatingExpenses;
  const inventoryValue = products.reduce((sum, product) => sum + ((Number(product.price) || 0) * (Number(product.stock) || 0)), 0);

  const staffMap = {};

  filteredSales.forEach((sale) => {
    const staffId = sale.createdBy?._id?.toString() || "unknown";
    const name = sale.createdBy?.name || "Unknown Staff";
    const saleDate = new Date(sale.createdAt);

    if (!staffMap[staffId]) {
      staffMap[staffId] = {
        name,
        totalSales: 0,
        totalRevenue: 0,
        todaySales: 0,
        todayRevenue: 0,
        weeklySales: 0,
        weeklyRevenue: 0,
      };
    }

    staffMap[staffId].totalSales += 1;
    staffMap[staffId].totalRevenue += Number(sale.totalAmount) || 0;

    if (saleDate >= todayStart) {
      staffMap[staffId].todaySales += 1;
      staffMap[staffId].todayRevenue += Number(sale.totalAmount) || 0;
    }

    if (saleDate >= weekStart) {
      staffMap[staffId].weeklySales += 1;
      staffMap[staffId].weeklyRevenue += Number(sale.totalAmount) || 0;
    }
  });

  return {
    overview: {
      todayRevenue,
      monthlyRevenue,
      monthlyGrossProfit,
      monthlyOperatingExpenses,
      monthlyProfit,
      inventoryValue,
      periodRevenue,
      periodGrossProfit,
      periodOperatingExpenses,
      periodProfit,
    },
    staffPerformance: Object.values(staffMap).sort((a, b) => b.todayRevenue - a.todayRevenue),
    lowStockProducts: products.filter((product) => (Number(product.stock) || 0) <= 5),
    recentSales: filteredSales.slice(0, 20),
  };
};

const getReports = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const period = req.query.period || "30";

    const sales = await Sale.find({ ...retailSalesFilter(businessId), isDeleted: { $ne: true } })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    const products = await Product.find({ business: businessId });

    const transactions = await Transaction.find({
      businessId,
      transactionType: "expense",
      $or: [{ postingType: "debit" }, { postingType: { $exists: false } }],
      status: "posted",
      isDeleted: { $ne: true },
    }).lean();

    const snapshot = buildReportSnapshot({ sales, products, transactions, period });
    res.json(snapshot);
  } catch (err) {
    console.error("Report Generation Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

export const buildSalesReportSnapshot = ({ sales = [], period = "30" }) => {
  const filteredSales = getPeriodBoundary(period)
    ? sales.filter((sale) => new Date(sale.createdAt) >= getPeriodBoundary(period))
    : sales;

  const chartData = [...filteredSales].reverse().slice(0, 14).reduce((acc, sale) => {
    const date = new Date(sale.createdAt);
    const key = date.toISOString().slice(0, 10);
    const label = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
    const existing = acc.find((item) => item.key === key);

    if (existing) {
      existing.revenue += Number(sale.totalAmount || 0);
      existing.profit += Number(sale.totalProfit || 0);
      return acc;
    }

    acc.push({ key, label, revenue: Number(sale.totalAmount || 0), profit: Number(sale.totalProfit || 0) });
    return acc;
  }, []);

  const overview = {
    totalRevenue: filteredSales.reduce((sum, sale) => sum + (Number(sale.totalAmount) || 0), 0),
    totalProfit: filteredSales.reduce((sum, sale) => sum + (Number(sale.totalProfit) || 0), 0),
    totalSales: filteredSales.length,
    period,
  };

  return {
    overview,
    chartData,
    recentSales: filteredSales.slice(0, 20),
    period,
  };
};

export const buildStaffReportSnapshot = ({ sales = [], period = "30" }) => {
  const filteredSales = getPeriodBoundary(period)
    ? sales.filter((sale) => new Date(sale.createdAt) >= getPeriodBoundary(period))
    : sales;

  const now = new Date();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date();
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const staffMap = {};

  filteredSales.forEach((sale) => {
    const staffId = sale.createdBy?._id?.toString() || "unknown";
    const name = sale.createdBy?.name || "Unknown Staff";
    const saleDate = new Date(sale.createdAt);

    if (!staffMap[staffId]) {
      staffMap[staffId] = {
        name,
        totalSales: 0,
        totalRevenue: 0,
        todaySales: 0,
        todayRevenue: 0,
        weeklySales: 0,
        weeklyRevenue: 0,
      };
    }

    staffMap[staffId].totalSales += 1;
    staffMap[staffId].totalRevenue += Number(sale.totalAmount) || 0;

    if (saleDate >= todayStart) {
      staffMap[staffId].todaySales += 1;
      staffMap[staffId].todayRevenue += Number(sale.totalAmount) || 0;
    }

    if (saleDate >= weekStart) {
      staffMap[staffId].weeklySales += 1;
      staffMap[staffId].weeklyRevenue += Number(sale.totalAmount) || 0;
    }
  });

  const staffPerformance = Object.values(staffMap).sort((a, b) => b.totalRevenue - a.totalRevenue);

  return {
    overview: {
      totalStaff: staffPerformance.length,
      totalRevenue: staffPerformance.reduce((sum, staff) => sum + (Number(staff.totalRevenue) || 0), 0),
      totalSales: staffPerformance.reduce((sum, staff) => sum + (Number(staff.totalSales) || 0), 0),
      period,
    },
    staffPerformance,
    period,
  };
};

export const buildInventoryReportSnapshot = ({ products = [], period = "30" }) => {
  const lowStockProducts = (products || []).filter((product) => (Number(product.stock) || 0) <= 5);
  const inventoryValue = products.reduce((sum, product) => sum + ((Number(product.price) || 0) * (Number(product.stock) || 0)), 0);

  return {
    overview: {
      inventoryValue,
      lowStockCount: lowStockProducts.length,
      totalProducts: products.length,
      period,
    },
    lowStockProducts,
    chartData: lowStockProducts.map((product) => ({
      name: product.name || "Product",
      stock: Number(product.stock) || 0,
    })),
    period,
  };
};

export const buildFinancialReportSnapshot = ({ sales = [], transactions = [], period = "30" }) => {
  const filteredSales = getPeriodBoundary(period)
    ? sales.filter((sale) => new Date(sale.createdAt) >= getPeriodBoundary(period))
    : sales;

  const periodRevenue = filteredSales.reduce((sum, sale) => sum + (Number(sale.totalAmount) || 0), 0);
  const periodGrossProfit = filteredSales.reduce((sum, sale) => sum + (Number(sale.totalProfit) || 0), 0);

  const relevantTransactions = getPeriodBoundary(period)
    ? transactions.filter((tx) => (!tx.postingType || tx.postingType === "debit") && new Date(tx.occurredAt || tx.createdAt) >= getPeriodBoundary(period))
    : transactions.filter((tx) => !tx.postingType || tx.postingType === "debit");

  const periodOperatingExpenses = relevantTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const periodProfit = periodGrossProfit - periodOperatingExpenses;

  const chartData = [...filteredSales].reverse().slice(0, 14).reduce((acc, sale) => {
    const date = new Date(sale.createdAt);
    const key = date.toISOString().slice(0, 10);
    const label = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
    const existing = acc.find((item) => item.key === key);

    if (existing) {
      existing.revenue += Number(sale.totalAmount || 0);
      existing.profit += Number(sale.totalProfit || 0);
      existing.expenses += Number(sale.totalAmount || 0) * 0.42;
      return acc;
    }

    acc.push({
      key,
      label,
      revenue: Number(sale.totalAmount || 0),
      profit: Number(sale.totalProfit || 0),
      expenses: Number(sale.totalAmount || 0) * 0.42,
    });

    return acc;
  }, []);

  return {
    overview: {
      periodRevenue,
      periodGrossProfit,
      periodOperatingExpenses,
      periodProfit,
      period,
    },
    chartData,
    period,
  };
};

const getOverviewReport = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const period = req.query.period || "30";

    const sales = await Sale.find({ ...retailSalesFilter(businessId), isDeleted: { $ne: true } })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    const products = await Product.find({ business: businessId });
    const transactions = await Transaction.find({
      businessId,
      transactionType: "expense",
      $or: [{ postingType: "debit" }, { postingType: { $exists: false } }],
      status: "posted",
      isDeleted: { $ne: true },
    }).lean();

    res.json(buildReportSnapshot({ sales, products, transactions, period }));
  } catch (err) {
    console.error("Overview Report Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

const getSalesReport = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const period = req.query.period || "30";

    const sales = await Sale.find({ ...retailSalesFilter(businessId), isDeleted: { $ne: true } })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.json(buildSalesReportSnapshot({ sales, period }));
  } catch (err) {
    console.error("Sales Report Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

const getStaffReport = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const period = req.query.period || "30";

    const sales = await Sale.find({ ...retailSalesFilter(businessId), isDeleted: { $ne: true } })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.json(buildStaffReportSnapshot({ sales, period }));
  } catch (err) {
    console.error("Staff Report Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

const getInventoryReport = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const period = req.query.period || "30";
    const products = await Product.find({ business: businessId });

    res.json(buildInventoryReportSnapshot({ products, period }));
  } catch (err) {
    console.error("Inventory Report Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

const getFinancialReport = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const period = req.query.period || "30";

    const sales = await Sale.find({ ...retailSalesFilter(businessId), isDeleted: { $ne: true } })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    const transactions = await Transaction.find({
      businessId,
      transactionType: "expense",
      $or: [{ postingType: "debit" }, { postingType: { $exists: false } }],
      status: "posted",
      isDeleted: { $ne: true },
    }).lean();

    res.json(buildFinancialReportSnapshot({ sales, transactions, period }));
  } catch (err) {
    console.error("Financial Report Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

export default {
  getReports,
  getOverviewReport,
  getSalesReport,
  getStaffReport,
  getInventoryReport,
  getFinancialReport,
  buildReportSnapshot,
  buildSalesReportSnapshot,
  buildStaffReportSnapshot,
  buildInventoryReportSnapshot,
  buildFinancialReportSnapshot,
};