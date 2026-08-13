import PurchaseOrder from "./purchaseOrder.model.js";
import Supplier from "../suppliers/supplier.model.js";
import Product from "../products/product.model.js";
import InventoryMovement from "../inventory/inventory.model.js";

const getPurchaseOrders = async (req, res) => {
  try {
    const { supplierId, status } = req.query;
    const query = { business: req.user.businessId };

    if (supplierId) query.supplier = supplierId;
    if (status) query.status = status;

    const orders = await PurchaseOrder.find(query)
      .populate("supplier", "name phone email isActive")
      .populate("items.product", "name sku stock")
      .sort({ createdAt: -1 });

    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to load purchase orders" });
  }
};

const createPurchaseOrder = async (req, res) => {
  try {
    const { supplier, items = [], status = "pending", notes = "" } = req.body;

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
      costPrice: Number(item.costPrice || 0),
      total: Number(item.total || Number(item.costPrice || 0) * Number(item.quantity || 0))
    }));

    const totalAmount = normalizedItems.reduce((sum, item) => sum + Number(item.total || 0), 0);

    const order = await PurchaseOrder.create({
      business: req.user.businessId,
      supplier,
      items: normalizedItems,
      totalAmount,
      status,
      notes
    });

    const populatedOrder = await PurchaseOrder.findById(order._id)
      .populate("supplier", "name phone email isActive")
      .populate("items.product", "name sku stock");

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

    const previousStatus = order.status;
    const { status, notes, items = [] } = req.body;

    if (status) order.status = status;
    if (notes !== undefined) order.notes = notes;
    if (Array.isArray(items) && items.length > 0) {
      order.items = items.map((item) => ({
        product: item.product || null,
        name: item.name || "Item",
        quantity: Number(item.quantity || 0),
        costPrice: Number(item.costPrice || 0),
        total: Number(item.total || Number(item.costPrice || 0) * Number(item.quantity || 0))
      }));
      order.totalAmount = order.items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    }

    if (order.status === "received" && previousStatus !== "received") {
      for (const item of order.items || []) {
        if (!item.product) continue;

        const product = await Product.findOne({
          _id: item.product,
          business: req.user.businessId
        });

        if (!product) continue;

        const previousStock = Number(product.stock || 0);
        const receivedQuantity = Number(item.quantity || 0);

        product.stock = previousStock + receivedQuantity;
        await product.save();

        await InventoryMovement.create({
          business: req.user.businessId,
          product: product._id,
          type: "purchase",
          quantity: receivedQuantity,
          previousStock,
          newStock: product.stock,
          note: `Purchase order received from supplier ${order.supplier || "supplier"}`,
          createdBy: req.user.id
        });
      }
    }

    await order.save();

    const populatedOrder = await PurchaseOrder.findById(order._id)
      .populate("supplier", "name phone email isActive")
      .populate("items.product", "name sku stock");

    return res.json(populatedOrder);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to update purchase order" });
  }
};

export default {
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder
};
