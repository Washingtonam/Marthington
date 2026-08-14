import Supplier from "./supplier.model.js";
import Invoice from "../invoices/invoice.model.js";
import PurchaseOrder from "../purchaseOrders/purchaseOrder.model.js";

const normalizeSupplierPayload = (body = {}) => {
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim();
  const address = String(body.address || "").trim();
  const notes = String(body.notes || "").trim();

  return {
    name,
    phone,
    email,
    address,
    notes,
    isActive: body.isActive !== false
  };
};

const getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find({ business: req.user.businessId }).sort({ createdAt: -1 });

    const supplierIds = suppliers.map((supplier) => supplier._id);
    const invoices = await Invoice.find({
      business: req.user.businessId,
      transactionType: "incoming",
      supplier: { $in: supplierIds }
    }).sort({ createdAt: -1 });

    const invoiceMap = new Map();
    for (const invoice of invoices) {
      const key = invoice.supplier?.toString();
      if (!key) continue;
      const existing = invoiceMap.get(key) || [];
      existing.push(invoice);
      invoiceMap.set(key, existing);
    }

    const payload = suppliers.map((supplier) => {
      const supplierInvoices = invoiceMap.get(supplier._id.toString()) || [];
      const totalPurchases = supplierInvoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0);
      const outstandingBalance = supplierInvoices.reduce((sum, invoice) => {
        const balance = Number(invoice.balanceDue ?? Math.max(0, (invoice.totalAmount || 0) - (invoice.amountPaid || 0)));
        return sum + balance;
      }, 0);
      const lastOrderAt = supplierInvoices[0]?.createdAt || supplier.updatedAt || supplier.createdAt;

      return {
        ...supplier.toObject(),
        totalPurchases,
        outstandingBalance,
        lastOrderAt,
        invoiceCount: supplierInvoices.length
      };
    });

    res.json(payload);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load suppliers" });
  }
};

const getSupplierById = async (req, res) => {
  try {
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      business: req.user.businessId
    });

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    const invoices = await Invoice.find({
      business: req.user.businessId,
      supplier: supplier._id,
      transactionType: "incoming"
    })
      .populate("items.product", "name sku")
      .sort({ createdAt: -1 });

    const purchaseOrders = await PurchaseOrder.find({
      business: req.user.businessId,
      supplier: supplier._id
    })
      .populate("items.product", "name sku")
      .sort({ createdAt: -1 });

    const stockReceipts = invoices.flatMap((invoice) =>
      (invoice.items || []).map((item) => ({
        _id: `${invoice._id}-${item.name || item.product || "item"}`,
        invoiceNumber: invoice.invoiceNumber || "INV",
        invoiceId: invoice._id,
        date: invoice.createdAt,
        productName: item.name || item.product?.name || "Unknown item",
        product: item.product || null,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.price || 0),
        total: Number(item.total || 0),
        status: invoice.paymentStatus || "Unpaid"
      }))
    );

    const totalPurchases = invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0);
    const outstandingBalance = invoices.reduce((sum, invoice) => {
      const balance = Number(invoice.balanceDue ?? Math.max(0, (invoice.totalAmount || 0) - (invoice.amountPaid || 0)));
      return sum + balance;
    }, 0);

    return res.json({
      supplier,
      summary: {
        totalPurchases,
        outstandingBalance,
        invoiceCount: invoices.length,
        purchaseOrderCount: purchaseOrders.length,
        receiptCount: stockReceipts.length,
        lastOrderAt: invoices[0]?.createdAt || purchaseOrders[0]?.createdAt || supplier.updatedAt || supplier.createdAt
      },
      invoices,
      purchaseOrders,
      stockReceipts
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to load supplier" });
  }
};

const createSupplier = async (req, res) => {
  try {
    const payload = normalizeSupplierPayload(req.body);

    if (!payload.name) {
      return res.status(400).json({ message: "Supplier name is required" });
    }

    const supplier = await Supplier.create({
      ...payload,
      business: req.user.businessId
    });

    return res.status(201).json(supplier);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to create supplier" });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      business: req.user.businessId
    });

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    const payload = normalizeSupplierPayload(req.body);
    if (!payload.name) {
      return res.status(400).json({ message: "Supplier name is required" });
    }

    Object.assign(supplier, payload);
    await supplier.save();

    return res.json(supplier);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to update supplier" });
  }
};

const deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findOneAndDelete({
      _id: req.params.id,
      business: req.user.businessId
    });

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    return res.json({ message: "Supplier deleted successfully" });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to delete supplier" });
  }
};

// 🔥 GET SUPPLIER PERFORMANCE METRICS
const getSupplierMetrics = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const supplierId = req.params.id;

    const supplier = await Supplier.findOne({
      _id: supplierId,
      business: businessId
    });

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    // Fetch all invoices for this supplier
    const invoices = await Invoice.find({
      business: businessId,
      supplier: supplierId,
      transactionType: "incoming"
    }).sort({ createdAt: -1 });

    // Fetch all purchase orders for this supplier
    const purchaseOrders = await PurchaseOrder.find({
      business: businessId,
      supplier: supplierId
    }).sort({ createdAt: -1 });

    // Calculate basic metrics
    const totalSpent = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.amountPaid || 0), 0);
    const outstandingBalance = invoices.reduce((sum, inv) => {
      const balance = Number(inv.balanceDue ?? Math.max(0, (inv.totalAmount || 0) - (inv.amountPaid || 0)));
      return sum + balance;
    }, 0);

    const paidInvoices = invoices.filter(inv => inv.paymentStatus === "Paid").length;
    const pendingInvoices = invoices.filter(inv => inv.paymentStatus === "Pending" || inv.paymentStatus !== "Paid").length;
    const paymentSuccessRate = invoices.length > 0 ? (paidInvoices / invoices.length) * 100 : 0;
    const averageOrderValue = invoices.length > 0 ? totalSpent / invoices.length : 0;

    // Calculate monthly trend data (last 6 months)
    const monthlyTrendData = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthInvoices = invoices.filter(inv => {
        const invDate = new Date(inv.createdAt);
        return invDate >= monthStart && invDate <= monthEnd;
      });

      const monthStr = monthStart.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      monthlyTrendData.push({
        month: monthStr,
        purchases: monthInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0),
        orders: monthInvoices.length
      });
    }

    // Payment status distribution
    const paymentStatusDistribution = [
      { name: "Paid", value: paidInvoices, color: "#10b981" },
      { name: "Pending", value: pendingInvoices, color: "#f59e0b" }
    ];

    // Performance score calculation
    const performanceScore = Math.round(paymentSuccessRate * 0.7 + 92 * 0.3); // 70% payment rate, 30% delivery (mocked at 92%)

    return res.json({
      supplier: {
        _id: supplier._id,
        name: supplier.name,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address
      },
      metrics: {
        totalSpent,
        totalPaid,
        outstandingBalance,
        totalOrders: invoices.length,
        averageOrderValue,
        paymentSuccessRate: parseFloat(paymentSuccessRate.toFixed(1)),
        performanceScore,
        onTimeDeliveryRate: 92, // Mocked - would need tracking in data
        priceIncreaseTrend: 2.5, // Mocked - would need historical pricing
        lastOrderDate: invoices[0]?.createdAt || supplier.createdAt
      },
      monthlyTrendData,
      paymentStatusDistribution
    });
  } catch (err) {
    console.error("Get Supplier Metrics Error:", err);
    return res.status(500).json({ message: err.message || "Failed to load supplier metrics" });
  }
};

// 🔥 GET ALL SUPPLIERS PERFORMANCE SUMMARY
const getSupplierPerformanceSummary = async (req, res) => {
  try {
    const businessId = req.user.businessId;

    const suppliers = await Supplier.find({ business: businessId }).sort({ createdAt: -1 });

    const supplierIds = suppliers.map(s => s._id);
    const invoices = await Invoice.find({
      business: businessId,
      transactionType: "incoming",
      supplier: { $in: supplierIds }
    });

    const supplierMetrics = suppliers.map(supplier => {
      const supplierInvoices = invoices.filter(inv => inv.supplier?.toString() === supplier._id.toString());
      const totalSpent = supplierInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
      const totalPaid = supplierInvoices.reduce((sum, inv) => sum + Number(inv.amountPaid || 0), 0);
      const outstandingBalance = supplierInvoices.reduce((sum, inv) => {
        const balance = Number(inv.balanceDue ?? Math.max(0, (inv.totalAmount || 0) - (inv.amountPaid || 0)));
        return sum + balance;
      }, 0);

      const paidInvoices = supplierInvoices.filter(inv => inv.paymentStatus === "Paid").length;
      const paymentSuccessRate = supplierInvoices.length > 0 ? (paidInvoices / supplierInvoices.length) * 100 : 0;
      const performanceScore = Math.round(paymentSuccessRate * 0.7 + 92 * 0.3);

      return {
        _id: supplier._id,
        name: supplier.name,
        email: supplier.email,
        phone: supplier.phone,
        totalSpent,
        totalPaid,
        outstandingBalance,
        totalOrders: supplierInvoices.length,
        paymentSuccessRate: parseFloat(paymentSuccessRate.toFixed(1)),
        performanceScore,
        lastOrderDate: supplierInvoices[0]?.createdAt || supplier.createdAt
      };
    });

    return res.json(supplierMetrics);
  } catch (err) {
    console.error("Get Supplier Performance Summary Error:", err);
    return res.status(500).json({ message: err.message || "Failed to load supplier performance summary" });
  }
};

export default {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierMetrics,
  getSupplierPerformanceSummary
};
