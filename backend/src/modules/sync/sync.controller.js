import Business from "../businesses/business.model.js";
import Product from "../products/product.model.js";
import Service from "../services/service.model.js";
import Customer from "../customers/customer.model.js";
import Supplier from "../suppliers/supplier.model.js";
import Branch from "../branches/branch.model.js";
import BranchInventory from "../branches/branchInventory.model.js";
import Sale from "../sales/sale.model.js";
import Expense from "../expenses/expense.model.js";
import Invoice from "../invoices/invoice.model.js";
import CategoryBudget from "../budgets/categoryBudget.model.js";

const getBootstrapSnapshot = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const recentLimit = 500;

    const [
      business,
      products,
      services,
      customers,
      suppliers,
      branches,
      branchInventory,
      sales,
      expenses,
      invoices,
      budgets
    ] = await Promise.all([
      Business.findById(businessId).lean(),
      Product.find({ business: businessId }).sort({ updatedAt: -1 }).lean(),
      Service.find({ business: businessId }).sort({ updatedAt: -1 }).lean(),
      Customer.find({ business: businessId }).sort({ updatedAt: -1 }).lean(),
      Supplier.find({ business: businessId }).sort({ updatedAt: -1 }).lean(),
      Branch.find({ business: businessId }).sort({ name: 1 }).lean(),
      BranchInventory.find({ business: businessId })
        .populate("product", "name sku sellingPrice price costPrice")
        .populate("branch", "name")
        .lean(),
      Sale.find({ business: businessId, isDeleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(recentLimit)
        .lean(),
      Expense.find({ business: businessId })
        .sort({ createdAt: -1 })
        .limit(recentLimit)
        .lean(),
      Invoice.find({ business: businessId })
        .sort({ createdAt: -1 })
        .limit(recentLimit)
        .lean(),
      CategoryBudget.find({ business: businessId, isActive: true }).lean()
    ]);

    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }

    return res.json({
      business,
      products,
      services,
      customers,
      suppliers,
      branches,
      branchInventory,
      sales,
      expenses,
      invoices,
      budgets,
      syncedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Offline bootstrap error:", error);
    return res.status(500).json({ message: "Failed to prepare offline business data" });
  }
};

export default { getBootstrapSnapshot };
