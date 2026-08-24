import Sale from "./sale.model.js";
import Product from "../products/product.model.js";
import Business from "../businesses/business.model.js";
import Customer from "../customers/customer.model.js";
import InventoryMovement from "../inventory/inventory.model.js";
import BranchInventory from "../branches/branchInventory.model.js";
import Invoice from "../invoices/invoice.model.js";
import InvoiceCounter from "../invoices/invoiceCounter.model.js";
import Transaction from "../transactions/transaction.model.js";
import mongoose from "mongoose";
import {
  canDeleteSale,
  buildSalesQuery,
  buildProductCompensationEntries,
  buildSaleLedgerEntry,
  getCustomerSaleImpact
} from "./sales.utils.js";
import { getScopedBranchQuery, resolveOperationalBranchId } from "../../utils/branchAccess.js";

// 🔥 GENERATE RECEIPT ID
const generateReceiptId = () => {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
};

const reserveStockAtomically = async ({ businessId, branchId, productId, quantity, userId, session }) => {
  if (branchId) {
    const branchInventory = await BranchInventory.findOneAndUpdate(
      {
        business: businessId,
        branch: branchId,
        product: productId,
        quantity: { $gte: quantity }
      },
      {
        $inc: { quantity: -quantity }
      },
      {
        new: true,
        session
      }
    );

    if (!branchInventory) {
      throw new Error(`Insufficient branch stock for product ${productId}.`);
    }

    return {
      stockRecord: branchInventory,
      previousStock: Number(branchInventory.quantity || 0) + quantity,
      newStock: Number(branchInventory.quantity || 0),
      stockKey: "branch"
    };
  }

  const product = await Product.findOneAndUpdate(
    {
      _id: productId,
      business: businessId,
      stock: { $gte: quantity }
    },
    {
      $inc: { stock: -quantity }
    },
    {
      new: true,
      session
    }
  );

  if (!product) {
    throw new Error(`Insufficient stock for product ${productId}.`);
  }

  return {
    stockRecord: product,
    previousStock: Number(product.stock || 0) + quantity,
    newStock: Number(product.stock || 0),
    stockKey: "product"
  };
};

// 🔥 CREATE SALE
const createSale = async (req, res) => {
  const clientOperationId = req.get("X-Operation-Id");
  const businessId = req.user.businessId;

  if (clientOperationId) {
    const existingSale = await Sale.findOne({ business: businessId, clientOperationId });
    if (existingSale) {
      return res.json({ message: "Sale already completed", sale: existingSale, duplicate: true });
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, autoSend, customerName, customerPhone, notes, paymentMethod, branch } = req.body;
    const branchId = resolveOperationalBranchId({ user: req.user, requestedBranchId: branch });
    if (branchId === undefined) {
      throw new Error("You can only create sales for your assigned branch unless cross-branch management is enabled.");
    }

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
        ...(branchId ? { branch: branchId } : {}),
        phoneNormalized: normalizedPhone
      }).session(session);

      if (!customer) {
        customer = await Customer.create([{
          business: businessId,
          name: customerName || "Walk-in Customer",
          phone: normalizedPhone,
          phoneNormalized: normalizedPhone,
          branch: branchId
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

        const stockState = await reserveStockAtomically({
          businessId,
          branchId,
          productId: product._id,
          quantity,
          userId: req.user.id,
          session
        });

        await InventoryMovement.create([{
          business: businessId,
          ...(branchId ? { branch: branchId } : {}),
          product: product._id,
          type: "sale",
          quantity,
          previousStock: stockState.previousStock,
          newStock: stockState.newStock,
          createdBy: req.user.id
        }], { session });

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
      ...(clientOperationId ? { clientOperationId } : {}),
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

    // 🔥 6. AUTO-CREATE INVOICE FROM SALE
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");

      let counter = await InvoiceCounter.findOne({ business: businessId }).session(session);
      if (!counter) {
        counter = await InvoiceCounter.create([{
          business: businessId,
          lastNumber: 0,
          prefix: "INV"
        }], { session }).then(res => res[0]);
      }

      counter.lastNumber += 1;
      await counter.save({ session });
      const invoiceNumber = `${counter.prefix}-${year}-${month}-${String(counter.lastNumber).padStart(6, "0")}`;

      // Map sale items to invoice items
      const invoiceItems = items.map(item => ({
        product: item.product || null,
        name: item.name,
        quantity: Number(item.quantity || 0),
        price: Number(item.sellingPrice || 0),
        total: Number(item.total || 0),
        returned: false,
        returnQuantity: 0,
        returnAmount: 0,
        receivedQuantity: 0,
        soldQuantity: Number(item.quantity || 0),
        supplierCreditStatus: null,
        supplierBatchLabel: ""
      }));

      const invoice = await Invoice.create([{
        business: businessId,
        branch: branchId,
        createdBy: req.user.id,
        transactionType: "outgoing",
        customer: customer?._id || null,
        customerName: customerName || customer?.name || "Walk-in",
        customerPhone: customerPhone || "",
        items: invoiceItems,
        subtotal: totalAmount,
        tax: 0,
        discount: 0,
        totalAmount: totalAmount,
        amountPaid: paymentMethod === "Cash" || paymentMethod === "cash" ? totalAmount : 0,
        balance: paymentMethod === "Cash" || paymentMethod === "cash" ? 0 : totalAmount,
        balanceDue: paymentMethod === "Cash" || paymentMethod === "cash" ? 0 : totalAmount,
        returnedAmount: 0,
        paymentStatus: paymentMethod === "Cash" || paymentMethod === "cash" ? "Fully Paid" : "Unpaid",
        status: paymentMethod === "Cash" || paymentMethod === "cash" ? "paid" : "pending",
        invoiceType: "invoice",
        invoiceNumber
      }], { session }).then(res => res[0]);

      // Link sale to invoice
      sale[0].invoice = invoice._id;
      await sale[0].save({ session });

      // Update customer outstanding balance if not cash payment
      if (customer && paymentMethod !== "Cash" && paymentMethod !== "cash") {
        customer.outstandingBalance = (customer.outstandingBalance || 0) + totalAmount;
        await customer.save({ session });
      }
    } catch (invoiceErr) {
      console.error("Failed to create linked invoice:", invoiceErr);
      // Don't fail the sale if invoice creation fails
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
    const branchQuery = getScopedBranchQuery(req.user, req.user.businessId, req.query.branchId);
    if (!branchQuery) return res.status(403).json({ message: "You do not have access to these sales" });
    Object.assign(query, branchQuery);

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
    const branchQuery = getScopedBranchQuery(req.user, req.user.businessId, req.query.branchId);
    if (!branchQuery) return res.status(403).json({ message: "You do not have access to these sales" });
    Object.assign(query, branchQuery);

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

    const branchQuery = getScopedBranchQuery(req.user, req.user.businessId, sale.branch?.toString());
    if (!branchQuery) return res.status(403).json({ message: "You do not have access to this sale" });

    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!canDeleteSale(req.user)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: "Only owners can delete sales" });
    }

    const sale = await Sale.findById(req.params.id).session(session);
    if (!sale) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Sale not found" });
    }

    if (req.user.role !== "super_admin" && sale.business?.toString() !== req.user.businessId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: "Unauthorized" });
    }

    for (const item of sale.items) {
      if (item.itemType !== "product" && item.itemType !== undefined) continue;
      if (!item.product || Number(item.quantity || 0) <= 0) continue;

      const quantity = Number(item.quantity || 0);
      if (sale.branch) {
        const branchInventory = await BranchInventory.findOne({
          business: sale.business,
          branch: sale.branch,
          product: item.product
        }).session(session);

        if (branchInventory) {
          const previousStock = Number(branchInventory.quantity || 0);
          branchInventory.quantity = previousStock + quantity;
          await branchInventory.save({ session });
          await InventoryMovement.create([{
            business: sale.business,
            branch: sale.branch,
            product: item.product,
            type: "return",
            quantity,
            unitCost: Number(item.costPrice || 0),
            previousStock,
            newStock: branchInventory.quantity,
            note: `Sale reversal ${sale._id}`,
            createdBy: req.user.id
          }], { session });
        } else {
          const createdInventory = await BranchInventory.create([{
            business: sale.business,
            branch: sale.branch,
            product: item.product,
            quantity,
            createdBy: req.user.id
          }], { session }).then(res => res[0]);

          await InventoryMovement.create([{
            business: sale.business,
            branch: sale.branch,
            product: item.product,
            type: "return",
            quantity,
            unitCost: Number(item.costPrice || 0),
            previousStock: 0,
            newStock: createdInventory.quantity,
            note: `Sale reversal ${sale._id}`,
            createdBy: req.user.id
          }], { session });
        }
      } else {
        const product = await Product.findById(item.product).session(session);
        if (product) {
          const previousStock = Number(product.stock || 0);
          product.stock = previousStock + quantity;
          await product.save({ session });
          await InventoryMovement.create([{
            business: sale.business,
            product: item.product,
            type: "return",
            quantity,
            unitCost: Number(item.costPrice || 0),
            previousStock,
            newStock: product.stock,
            note: `Sale reversal ${sale._id}`,
            createdBy: req.user.id
          }], { session });
        }
      }
    }

    const saleLedgerEntry = buildSaleLedgerEntry({
      sale,
      businessId: sale.business,
      createdBy: req.user.id,
      status: "reversed",
      notePrefix: "Sale reversal"
    });

    const existingLedger = await Transaction.findOne({
      businessId: sale.business,
      sourceModel: "Sale",
      sourceId: sale._id
    }).session(session);

    if (existingLedger) {
      existingLedger.status = "reversed";
      existingLedger.deletedAt = null;
      existingLedger.deletedBy = null;
      existingLedger.isDeleted = false;
      await existingLedger.save({ session });
    } else {
      await Transaction.create([saleLedgerEntry], { session });
    }

    if (sale.customer) {
      const customer = await Customer.findById(sale.customer).session(session);
      if (customer) {
        const impact = getCustomerSaleImpact({
          paymentMethod: sale.paymentMethod,
          totalAmount: sale.totalAmount,
          action: "delete"
        });

        customer.totalSpent = Math.max(0, Number(customer.totalSpent || 0) + impact.totalSpentDelta);
        customer.totalOrders = Math.max(0, Number(customer.totalOrders || 0) + impact.totalOrdersDelta);
        customer.outstandingBalance = Math.max(0, Number(customer.outstandingBalance || 0) + impact.outstandingBalanceDelta);
        await customer.save({ session });
      }
    }

    sale.isDeleted = true;
    sale.deletedAt = new Date();
    sale.deletedBy = req.user.id;
    await sale.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Sale archived", sale });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: error.message });
  }
};

const restoreSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!canDeleteSale(req.user)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: "Only owners can restore sales" });
    }

    const sale = await Sale.findById(req.params.id).session(session);
    if (!sale) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Sale not found" });
    }

    if (req.user.role !== "super_admin" && sale.business?.toString() !== req.user.businessId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: "Unauthorized" });
    }

    for (const item of sale.items) {
      if (item.itemType !== "product" && item.itemType !== undefined) continue;
      if (!item.product || Number(item.quantity || 0) <= 0) continue;

      const quantity = Number(item.quantity || 0);
      if (sale.branch) {
        const branchInventory = await BranchInventory.findOne({
          business: sale.business,
          branch: sale.branch,
          product: item.product
        }).session(session);

        if (branchInventory) {
          const previousStock = Number(branchInventory.quantity || 0);
          branchInventory.quantity = Math.max(0, previousStock - quantity);
          await branchInventory.save({ session });
          await InventoryMovement.create([{
            business: sale.business,
            branch: sale.branch,
            product: item.product,
            type: "sale",
            quantity,
            unitCost: Number(item.costPrice || 0),
            previousStock,
            newStock: branchInventory.quantity,
            note: `Sale restored ${sale._id}`,
            createdBy: req.user.id
          }], { session });
        }
      } else {
        const product = await Product.findById(item.product).session(session);
        if (product) {
          const previousStock = Number(product.stock || 0);
          product.stock = Math.max(0, previousStock - quantity);
          await product.save({ session });
          await InventoryMovement.create([{
            business: sale.business,
            product: item.product,
            type: "sale",
            quantity,
            unitCost: Number(item.costPrice || 0),
            previousStock,
            newStock: product.stock,
            note: `Sale restored ${sale._id}`,
            createdBy: req.user.id
          }], { session });
        }
      }
    }

    const existingLedger = await Transaction.findOne({
      businessId: sale.business,
      sourceModel: "Sale",
      sourceId: sale._id
    }).session(session);

    if (existingLedger) {
      existingLedger.status = "posted";
      existingLedger.deletedAt = null;
      existingLedger.deletedBy = null;
      existingLedger.isDeleted = false;
      await existingLedger.save({ session });
    } else {
      await Transaction.create([buildSaleLedgerEntry({
        sale,
        businessId: sale.business,
        createdBy: req.user.id,
        status: "posted",
        notePrefix: "Sale restored"
      })], { session });
    }

    if (sale.customer) {
      const customer = await Customer.findById(sale.customer).session(session);
      if (customer) {
        const impact = getCustomerSaleImpact({
          paymentMethod: sale.paymentMethod,
          totalAmount: sale.totalAmount,
          action: "restore"
        });

        customer.totalSpent = Math.max(0, Number(customer.totalSpent || 0) + impact.totalSpentDelta);
        customer.totalOrders = Math.max(0, Number(customer.totalOrders || 0) + impact.totalOrdersDelta);
        customer.outstandingBalance = Math.max(0, Number(customer.outstandingBalance || 0) + impact.outstandingBalanceDelta);
        await customer.save({ session });
      }
    }

    sale.isDeleted = false;
    sale.deletedAt = null;
    sale.deletedBy = null;
    await sale.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Sale restored", sale });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
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