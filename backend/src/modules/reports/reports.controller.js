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

const getReports = async (req, res) => {
  try {
    const businessId = req.user.businessId;

    // 1. Load Data
    const sales = await Sale.find({ ...retailSalesFilter(businessId), isDeleted: { $ne: true } })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    const products = await Product.find({ business: businessId });

    // 2. Precise Time Boundaries
    const now = new Date();
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date();
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 3. Filter Sales by Timeframes
    const todaySales = sales.filter(s => new Date(s.createdAt) >= todayStart);
    const weeklySales = sales.filter(s => new Date(s.createdAt) >= weekStart);
    const monthlySales = sales.filter(s => new Date(s.createdAt) >= monthStart);

    // 4. Revenue & Profit Calculations
    const todayRevenue = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
    const monthlyRevenue = monthlySales.reduce((sum, s) => sum + s.totalAmount, 0);
    
    // 🔥 GROSS PROFIT CALCULATION
    const monthlyGrossProfit = monthlySales.reduce((sum, s) => sum + (s.totalProfit || 0), 0);
    
    // 🔥 GET OPERATING EXPENSES FOR THE MONTH FROM POSTED LEDGER ENTRIES
    const postedExpenseTransactions = await Transaction.find({
      businessId,
      transactionType: "expense",
      status: "posted",
      isDeleted: { $ne: true },
      occurredAt: { $gte: monthStart }
    }).lean();

    const monthlyOperatingExpenses = postedExpenseTransactions.reduce(
      (sum, tx) => sum + (Number(tx.amount) || 0),
      0
    );

    // 🔥 NET PROFIT = GROSS PROFIT - OPERATING EXPENSES
    const monthlyProfit = monthlyGrossProfit - monthlyOperatingExpenses;

    // 5. Inventory Value
    const inventoryValue = products.reduce((sum, p) => sum + (p.price || 0) * (p.stock || 0), 0);

    // 6. 🔥 ADVANCED STAFF PERFORMANCE (Daily & Weekly breakdown)
    const staffMap = {};

    sales.forEach((sale) => {
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
          weeklyRevenue: 0
        };
      }

      // Lifetime (Current Records) Stats
      staffMap[staffId].totalSales += 1;
      staffMap[staffId].totalRevenue += sale.totalAmount;

      // Today's Stats
      if (saleDate >= todayStart) {
        staffMap[staffId].todaySales += 1;
        staffMap[staffId].todayRevenue += sale.totalAmount;
      }

      // This Week's Stats
      if (saleDate >= weekStart) {
        staffMap[staffId].weeklySales += 1;
        staffMap[staffId].weeklyRevenue += sale.totalAmount;
      }
    });

    // 7. Final Response JSON
    res.json({
      overview: { 
        todayRevenue, 
        monthlyRevenue, 
        monthlyGrossProfit,
        monthlyOperatingExpenses,
        monthlyProfit, 
        inventoryValue 
      },
      staffPerformance: Object.values(staffMap).sort((a, b) => b.todayRevenue - a.todayRevenue),
      lowStockProducts: products.filter((p) => p.stock <= 5),
      recentSales: sales.slice(0, 20)
    });

  } catch (err) {
    console.error("Report Generation Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

export default { getReports };