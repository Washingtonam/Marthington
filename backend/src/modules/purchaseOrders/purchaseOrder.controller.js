import PurchaseOrder from "./purchaseOrder.model.js";
import Supplier from "../suppliers/supplier.model.js";
import Product from "../products/product.model.js";
import InventoryMovement from "../inventory/inventory.model.js";
import BranchInventory from "../branches/branchInventory.model.js";
import Expense from "../expenses/expense.model.js";
import { getPurchaseApprovalStatus } from "./purchaseOrderBudget.js";

const getPurchaseOrders = async (req, res) => {
  try {
    const { supplierId, status } = req.query;
    const query = { business: req.user.businessId };

    if (supplierId) query.supplier = supplierId;
    if (status) query.status = status;

    const orders = await PurchaseOrder.find(query)
      .populate("supplier", "name phone email isActive paymentTerms")
      .populate("items.product", "name sku stock costPrice")
      .populate("destinationBranch", "name")
      .populate("receivedBy", "name email")
      .sort({ createdAt: -1 });

    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to load purchase orders" });
  }
};

const createPurchaseOrder = async (req, res) => {
  try {
    const { supplier, items = [], status = "pending", notes = "", destinationBranch, paymentTerms = "immediate" } = req.body;

    if (!supplier) {
      return res.status(400).json({ message: "Supplier is required" });
    }

    const supplierRecord = await Supplier.findOne({ _id: supplier, business: req.user.businessId });
    if (!supplierRecord) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    const normalizedItems = (items || []).map((item) => ({
      product: item.product || null,
      name: item.name || "Item",
      quantity: Number(item.quantity || 0),
      quantityReceived: 0,
      costPrice: Number(item.costPrice || 0),
      total: Number(item.total || Number(item.costPrice || 0) * Number(item.quantity || 0))
    }));

    const totalAmount = normalizedItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const approvalStatus = getPurchaseApprovalStatus(totalAmount);

    if (approvalStatus.requiresApproval && !["owner", "super_admin", "manager"].includes(req.user.role)) {
      return res.status(403).json({
        message: approvalStatus.reason,
        threshold: approvalStatus.threshold,
        amount: approvalStatus.amount
      });
    }

    const order = await PurchaseOrder.create({
      business: req.user.businessId,
      supplier,
      items: normalizedItems,
      totalAmount,
      status,
      notes,
      destinationBranch: destinationBranch || null,
      paymentTerms,
      receiptStatus: "awaiting"
    });

    const populatedOrder = await PurchaseOrder.findById(order._id)
      .populate("supplier", "name phone email isActive paymentTerms")
      .populate("items.product", "name sku stock costPrice")
      .populate("destinationBranch", "name");

    return res.status(201).json(populatedOrder);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to create purchase order" });
  }
};

const updatePurchaseOrder = async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne({ _id: req.params.id, business: req.user.businessId });
    if (!order) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    const { status, notes, items = [] } = req.body;

    if (status) order.status = status;
    if (notes !== undefined) order.notes = notes;
    if (Array.isArray(items) && items.length > 0) {
      order.items = items.map((item) => ({
        product: item.product || null,
        name: item.name || "Item",
        quantity: Number(item.quantity || 0),
        quantityReceived: Number(item.quantityReceived || 0),
        costPrice: Number(item.costPrice || 0),
        total: Number(item.total || Number(item.costPrice || 0) * Number(item.quantity || 0))
      }));
      order.totalAmount = order.items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    }

    const approvalStatus = getPurchaseApprovalStatus(order.totalAmount);
    if (approvalStatus.requiresApproval && !["owner", "super_admin", "manager"].includes(req.user.role)) {
      return res.status(403).json({
        message: approvalStatus.reason,
        threshold: approvalStatus.threshold,
        amount: approvalStatus.amount
      });
    }

    await order.save();

    const populatedOrder = await PurchaseOrder.findById(order._id)
      .populate("supplier", "name phone email isActive paymentTerms")
      .populate("items.product", "name sku stock costPrice")
      .populate("destinationBranch", "name")
      .populate("receivedBy", "name email");

    return res.json(populatedOrder);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to update purchase order" });
  }
};

/**
 * PHASE 1: RECORD GOODS RECEIPT - Core sync endpoint
 * Atomically:
 * 1. Records partial/full quantities received per item
 * 2. Updates Inventory stock for each product
 * 3. Creates InventoryMovement records with cost tracking
 * 4. Auto-creates Expense record (categorized as "inventory")
 * 5. Updates Supplier ledger (outstanding balance)
 * 6. Updates PO receipt status (awaiting → partial → complete)
 */
const recordReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const { receivedItems = [], paymentStatus = "unpaid", branch = null } = req.body;

    if (!Array.isArray(receivedItems) || receivedItems.length === 0) {
      return res.status(400).json({ message: "receivedItems array is required with at least one item" });
    }

    // Fetch PO with all details
    const po = await PurchaseOrder.findOne({ _id: id, business: req.user.businessId })
      .populate("supplier")
      .populate("items.product");

    if (!po) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    if (po.status === "cancelled") {
      return res.status(400).json({ message: "Cannot record receipt for cancelled purchase order" });
    }

    const supplier = po.supplier;
    if (!supplier) {
      return res.status(400).json({ message: "Supplier not found for this purchase order" });
    }

    // Validate received items and build mapping
    const receivedMap = new Map();
    let totalReceivedCost = 0;

    for (const received of receivedItems) {
      const { itemIndex, quantityReceived, unitCost } = received;
      const poItem = po.items[itemIndex];

      if (!poItem) {
        return res.status(400).json({ message: `Item at index ${itemIndex} not found in PO` });
      }

      const qtyReceived = Number(quantityReceived || 0);
      const qtyOrdered = Number(poItem.quantity || 0);
      const qtyPreviouslyReceived = Number(poItem.quantityReceived || 0);
      const actualUnitCost = Number(unitCost ?? poItem.costPrice ?? 0);

      if (qtyReceived < 0) {
        return res.status(400).json({ message: `Invalid quantity for item ${itemIndex}: cannot be negative` });
      }

      const totalAllowed = qtyOrdered - qtyPreviouslyReceived;
      if (qtyReceived > totalAllowed) {
        return res.status(400).json({
          message: `Item ${itemIndex}: Only ${totalAllowed} units can still be received (${qtyOrdered} ordered - ${qtyPreviouslyReceived} already received)`
        });
      }

      if (qtyReceived > 0) {
        const itemCost = qtyReceived * actualUnitCost;
        receivedMap.set(itemIndex, {
          item: poItem,
          quantityReceived: qtyReceived,
          actualUnitCost,
          cost: itemCost
        });
        totalReceivedCost += itemCost;
      }
    }

    if (receivedMap.size === 0) {
      return res.status(400).json({ message: "No items with quantity > 0 received" });
    }

    // ===== START: ATOMIC TRANSACTION =====
    
    // Step 1: Update inventory for each received item
    const inventoryMovements = [];
    const targetBranchId = branch || po.destinationBranch || null;

    for (const [, received] of receivedMap) {
      const { item, quantityReceived, actualUnitCost } = received;
      const productId = item.product?._id || item.product;

      if (!productId) continue;

      const product = await Product.findOne({
        _id: productId,
        business: req.user.businessId
      });

      if (!product) continue;

      const previousStock = Number(product.stock || 0);
      const previousCost = Number(product.costPrice || 0);
      const updatedStock = previousStock + quantityReceived;
      const newCost = updatedStock > 0
        ? ((previousStock * previousCost) + (quantityReceived * actualUnitCost)) / updatedStock
        : actualUnitCost;

      product.stock = updatedStock;
      product.costPrice = Number(newCost.toFixed(2));
      await product.save();

      if (targetBranchId) {
        const branchInventory = await BranchInventory.findOne({
          business: req.user.businessId,
          branch: targetBranchId,
          product: product._id
        });

        const previousBranchStock = Number(branchInventory?.quantity || 0);
        const updatedBranchStock = previousBranchStock + quantityReceived;

        if (branchInventory) {
          branchInventory.quantity = updatedBranchStock;
          await branchInventory.save();
        } else {
          await BranchInventory.create({
            business: req.user.businessId,
            branch: targetBranchId,
            product: product._id,
            quantity: quantityReceived,
            createdBy: req.user.id
          });
        }

        const movement = await InventoryMovement.create({
          business: req.user.businessId,
          branch: targetBranchId,
          product: product._id,
          type: "purchase",
          quantity: quantityReceived,
          unitCost: actualUnitCost,
          previousStock: previousBranchStock,
          newStock: updatedBranchStock,
          note: `Received ${quantityReceived} units from ${supplier.name} (PO: ${po._id})`,
          createdBy: req.user.id
        });

        inventoryMovements.push(movement);
      }

      const movement = await InventoryMovement.create({
        business: req.user.businessId,
        branch: targetBranchId,
        product: product._id,
        type: "purchase",
        quantity: quantityReceived,
        unitCost: actualUnitCost,
        previousStock,
        newStock: product.stock,
        note: `Central stock adjustment for PO receipt ${po._id}`,
        createdBy: req.user.id
      });

      inventoryMovements.push(movement);
    }

    // Step 2: Auto-create Expense record (categorized as "inventory")
    const expenseDescription = `Stock purchase from ${supplier.name}`;
    const expense = await Expense.create({
      business: req.user.businessId,
      branch: branch || po.destinationBranch || null,
      amount: totalReceivedCost,
      description: expenseDescription,
      category: "inventory",
      paymentMethod: paymentStatus === "paid" ? "cash" : "store_credit",
      date: new Date(),
      createdBy: req.user.id,
      status: paymentStatus === "paid" ? "approved" : "pending",
      linkedPurchaseOrder: po._id,
      supplier: supplier._id,
      notes: `Auto-created from receipt of ${po._id}`
    });

    // Step 3: Update PO receipt tracking
    for (const [itemIndex, received] of receivedMap) {
      po.items[itemIndex].quantityReceived = (Number(po.items[itemIndex].quantityReceived || 0)) + received.quantityReceived;
      po.items[itemIndex].receivedDate = new Date();
      po.items[itemIndex].receivedBy = req.user.id;
    }

    // Step 4: Calculate overall PO receipt status
    const allFullyReceived = po.items.every(item => Number(item.quantityReceived || 0) >= Number(item.quantity || 0));
    const anyReceived = po.items.some(item => Number(item.quantityReceived || 0) > 0);

    if (allFullyReceived) {
      po.receiptStatus = "complete";
      po.status = "received";
    } else if (anyReceived) {
      po.receiptStatus = "partial";
      po.status = "partial";
    }

    po.receivedDate = new Date();
    po.receivedBy = req.user.id;
    po.linkedExpense = expense._id;

    await po.save();

    // Step 5: Update Supplier ledger
    supplier.totalPurchases = (Number(supplier.totalPurchases || 0)) + totalReceivedCost;
    
    if (paymentStatus === "paid") {
      supplier.totalPaid = (Number(supplier.totalPaid || 0)) + totalReceivedCost;
    } else {
      supplier.outstandingBalance = (Number(supplier.outstandingBalance || 0)) + totalReceivedCost;
    }

    await supplier.save();

    // ===== END: ATOMIC TRANSACTION =====

    // Fetch and return updated PO with all details
    const updatedPO = await PurchaseOrder.findById(po._id)
      .populate("supplier", "name phone email isActive paymentTerms totalPurchases totalPaid outstandingBalance")
      .populate("items.product", "name sku stock costPrice")
      .populate("items.receivedBy", "name email")
      .populate("destinationBranch", "name")
      .populate("receivedBy", "name email")
      .populate("linkedExpense", "amount category status");

    return res.json({
      success: true,
      message: `Receipt recorded successfully. Created expense: ₦${totalReceivedCost.toLocaleString()} | PO status: ${po.status}`,
      data: {
        purchaseOrder: updatedPO,
        expense,
        inventoryMovements,
        supplierLedger: {
          totalPurchases: supplier.totalPurchases,
          totalPaid: supplier.totalPaid,
          outstandingBalance: supplier.outstandingBalance
        }
      }
    });
  } catch (err) {
    console.error("recordReceipt error:", err);
    return res.status(500).json({ message: err.message || "Failed to record receipt" });
  }
};

/**
 * Get Supplier Payment Status/Ledger
 * Returns outstanding balance, payment terms, and order history
 */
const getSupplierLedger = async (req, res) => {
  try {
    const { supplierId } = req.params;

    const supplier = await Supplier.findOne({
      _id: supplierId,
      business: req.user.businessId
    });

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    // Get all purchase orders from this supplier
    const purchaseOrders = await PurchaseOrder.find({
      business: req.user.businessId,
      supplier: supplierId
    }).sort({ createdAt: -1 });

    // Get all related expenses
    const expenses = await Expense.find({
      business: req.user.businessId,
      supplier: supplierId
    }).sort({ createdAt: -1 });

    return res.json({
      supplier: {
        id: supplier._id,
        name: supplier.name,
        paymentTerms: supplier.paymentTerms,
        totalPurchases: supplier.totalPurchases,
        totalPaid: supplier.totalPaid,
        outstandingBalance: supplier.outstandingBalance
      },
      summary: {
        totalOrders: purchaseOrders.length,
        pendingOrders: purchaseOrders.filter(po => po.status === "pending").length,
        partialOrders: purchaseOrders.filter(po => po.status === "partial").length,
        completedOrders: purchaseOrders.filter(po => po.status === "received").length,
        totalExpensesRecorded: expenses.length,
        approvedExpenses: expenses.filter(e => e.status === "approved").length,
        pendingExpenses: expenses.filter(e => e.status === "pending").length
      },
      recentOrders: purchaseOrders.slice(0, 10),
      recentExpenses: expenses.slice(0, 10)
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to load supplier ledger" });
  }
};

export default {
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  recordReceipt,
  getSupplierLedger
};
