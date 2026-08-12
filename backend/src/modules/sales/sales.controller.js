import Sale from "./sale.model.js";
import Product from "../products/product.model.js";
import Business from "../businesses/business.model.js";
import Customer from "../customers/customer.model.js";
import InventoryMovement from "../inventory/inventory.model.js";
import BranchInventory from "../branches/branchInventory.model.js";
import mongoose from "mongoose";
import { canDeleteSale, buildSalesQuery } from "./sales.utils.js";

// 🔥 GENERATE RECEIPT ID
const generateReceiptId = () => {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
};

// 🔥 CREATE SALE
const createSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, autoSend, customerName, customerPhone, notes, paymentMethod, branch } = req.body;
    const businessId = req.user.businessId;
    const branchId = branch || req.user.branchId || null;

    // 1. Fetch Business & Check Subscription
    const business = await Business.findById(businessId).session(session);
    if (!business) throw new Error("Business not found");

    const isPro = business?.subscription?.status === "active";
    const isTrial = business?.subscription?.status === "trial" && new Date() <= new Date(business.trialEndsAt);

    if (!isPro && !isTrial) {
      throw new Error("Subscription inactive. Please renew to process sales.");
    }

    if (autoSend && !isPro) {
      return res.status(403).json({ message: "Auto WhatsApp is a Pro feature" });
    }

    // 2. Handle Customer Logic
    let customer = null;
    if (customerPhone) {
      const normalizedPhone = Customer.normalizePhoneNumber(customerPhone);
      customer = await Customer.findOne({
        business: businessId,
        phoneNormalized: normalizedPhone
      }).session(session);

      if (!customer) {
        customer = await Customer.create([{
          business: businessId,
          name: customerName || "Walk-in Customer",
          phone: normalizedPhone,
          phoneNormalized: normalizedPhone
        }], { session }).then(res => res[0]);
      }
    }

    let totalAmount = 0;
    const saleItems = [];

    // 3. Process Items (Products & Services)
    for (const item of items) {
      if (item.itemType === "product" || !item.itemType) {
        const product = await Product.findById(item.product).session(session);

        if (!product) throw new Error(`Product ${item.name || 'not found'} missing.`);
        
        // Security Check
        if (req.user.role !== "super_admin" && product.business.toString() !== businessId) {
          throw new Error("Unauthorized product access");
        }

        const basePrice = Math.round(Number(product.price));
        const incomingPrice = Math.round(Number(item.sellingPrice ?? product.price));
        
        // Price Override Permission Check
        const canOverride = req.user.role === "owner" || 
                            req.user.role === "super_admin" || 
                            req.user.permissions?.canOverridePrice;

        if (incomingPrice !== basePrice && !canOverride) {
          throw new Error(`Unauthorized price override for ${product.name}`);
        }

        const finalPrice = incomingPrice;
        const quantity = Math.round(Number(item.quantity));
        const itemTotal = finalPrice * quantity;
        totalAmount += itemTotal;

        let previousStock;

        if (branchId) {
          const branchInventory = await BranchInventory.findOne({
            business: businessId,
            branch: branchId,
            product: product._id
          }).session(session);

          if (!branchInventory || branchInventory.quantity < quantity) {
            throw new Error(`Insufficient branch stock for ${product.name}.`);
          }

          previousStock = branchInventory.quantity;
          branchInventory.quantity -= quantity;
          await branchInventory.save({ session });

          await InventoryMovement.create([{
            business: businessId,
            branch: branchId,
            product: product._id,
            type: "sale",
            quantity,
            previousStock,
            newStock: branchInventory.quantity,
            createdBy: req.user.id
          }], { session });

        } else {
          if (product.stock < quantity) {
            throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}`);
          }

          previousStock = product.stock;
          product.stock -= quantity;
          await product.save({ session });

          await InventoryMovement.create([{
            business: businessId,
            product: product._id,
            type: "sale",
            quantity,
            previousStock,
            newStock: product.stock,
            createdBy: req.user.id
          }], { session });
        }

        saleItems.push({
          itemType: "product",
          product: product._id,
          name: product.name,
          quantity,
          costPrice: Number(product.costPrice) || 0,
          sellingPrice: finalPrice,
          total: itemTotal
        });

      } else if (item.itemType === "service") {
        const quantity = Math.round(Number(item.quantity || 1));
        const sellingPrice = Math.round(Number(item.sellingPrice || 0));
        const itemTotal = quantity * sellingPrice;
        totalAmount += itemTotal;

        saleItems.push({
          itemType: "service",
          name: item.name || "Service",
          quantity,
          costPrice: 0,
          sellingPrice,
          total: itemTotal
        });
      }
    }

    // 4. Create Sale Record
    const sale = await Sale.create([{
      items: saleItems,
      totalAmount,
      paymentMethod: paymentMethod || "Cash",
      business: businessId,
      branch: branchId || null,
      createdBy: req.user.id,
      customer: customer?._id || null,
      customerName: customerName || customer?.name || "Walk-in",
      customerPhone: customerPhone || "",
      receiptId: generateReceiptId()
    }], { session });

    // 5. Update Customer Loyalty/History
    if (customer) {
      customer.totalSpent += totalAmount;
      customer.totalOrders += 1;
      customer.lastPurchaseAt = new Date();
      customer.loyaltyPoints += Math.floor(totalAmount / 1000);
      await customer.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Sale completed", sale: sale[0] });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: error.message });
  }
};

// 🔥 GET ALL SALES
const getSales = async (req, res) => {
  try {
    const query = buildSalesQuery({
      businessId: req.user.businessId,
      isSuperAdmin: req.user.role === "super_admin"
    });

    const sales = await Sale.find(query)
      .sort({ createdAt: -1 })
      .populate("createdBy", "name")
      .populate("branch", "name")
      .populate("items.product", "name price")
      .populate("business", "name address phone email receiptFooter receiptTheme logo subscription");

    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getDeletedSales = async (req, res) => {
  try {
    if (!canDeleteSale(req.user)) {
      return res.status(403).json({ message: "Only owners can view archived sales" });
    }

    const query = buildSalesQuery({
      businessId: req.user.businessId,
      isSuperAdmin: req.user.role === "super_admin",
      includeDeleted: true,
      canAccessDeleted: true
    });

    const sales = await Sale.find(query)
      .sort({ deletedAt: -1, createdAt: -1 })
      .populate("createdBy", "name")
      .populate("items.product", "name price")
      .populate("business", "name address phone email receiptFooter receiptTheme logo subscription");

    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔥 GET SINGLE SALE
const getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate("createdBy", "name")
      .populate("branch", "name")
      .populate("items.product", "name price")
      .populate("business", "name address phone email receiptFooter receiptTheme logo subscription");

    if (!sale) return res.status(404).json({ message: "Sale not found" });

    if (req.user.role !== "super_admin" && sale.business._id.toString() !== req.user.businessId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteSale = async (req, res) => {
  try {
    if (!canDeleteSale(req.user)) {
      return res.status(403).json({ message: "Only owners can delete sales" });
    }

    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    if (req.user.role !== "super_admin" && sale.business?.toString() !== req.user.businessId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    sale.isDeleted = true;
    sale.deletedAt = new Date();
    sale.deletedBy = req.user.id;
    await sale.save();

    res.json({ message: "Sale archived", sale });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const restoreSale = async (req, res) => {
  try {
    if (!canDeleteSale(req.user)) {
      return res.status(403).json({ message: "Only owners can restore sales" });
    }

    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    if (req.user.role !== "super_admin" && sale.business?.toString() !== req.user.businessId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    sale.isDeleted = false;
    sale.deletedAt = null;
    sale.deletedBy = null;
    await sale.save();

    res.json({ message: "Sale restored", sale });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔥 PUBLIC RECEIPT
const getPublicSale = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await Sale.findOne({ $or: [{ _id: id }, { receiptId: id }] })
      .populate("branch", "name")
      .populate("items.product", "name price")
      .populate("business", "name address phone email receiptFooter receiptTheme logo subscription");

    if (!sale) return res.status(404).json({ message: "Receipt not found" });
    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export default { createSale, getSales, getDeletedSales, getSaleById, getPublicSale, deleteSale, restoreSale };