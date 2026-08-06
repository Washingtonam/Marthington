import BranchInventory from "./branchInventory.model.js";
import Branch from "./branch.model.js";
import Product from "../products/product.model.js";
import Business from "../businesses/business.model.js";
import InventoryMovement from "../inventory/inventory.model.js";
import User from "../users/user.model.js";
import OperationLog from "../../models/operationLog.model.js";
import importQueue from "../../queues/importQueue.js";

const importProductToBranch = async (req, res) => {
  try {
    const { branchId, productId, quantity, branchPrice } = req.body;
    const businessId = req.user.businessId;

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    const branch = await Branch.findOne({ _id: branchId, business: businessId });
    if (!branch) {
      return res.status(404).json({ message: "Branch not found" });
    }

    // BULK IMPORT: when no productId supplied, register all central products
    // in the branch inventory (without touching central stock). This makes
    // branch-level inventory records available for managers to update.
    if (!productId) {
      // Create an operation log and enqueue a background job for processing.
      const jobDoc = await OperationLog.create({
        business: businessId,
        branch: branchId,
        operationType: "branch_bulk_import",
        user: req.user.id,
        status: "pending",
        metadata: {}
      });

      // enqueue job in Redis-backed queue
      await importQueue.add({ jobId: jobDoc._id.toString(), businessId, branchId, userId: req.user.id });

      return res.json({ jobId: jobDoc._id });
    }

    // SINGLE PRODUCT TRANSFER: keep existing semantics (move stock)
    const transferQuantity = Number(quantity || 0);

    if (transferQuantity <= 0) {
      return res.status(400).json({ message: "Quantity must be a positive number" });
    }

    const product = await Product.findOne({ _id: productId, business: businessId });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.stock < transferQuantity) {
      return res.status(400).json({ message: "Insufficient central stock for transfer" });
    }

    product.stock -= transferQuantity;
    await product.save();

    await InventoryMovement.create({
      business: businessId,
      branch: branchId,
      product: productId,
      type: "transfer",
      quantity: transferQuantity,
      previousStock: product.stock + transferQuantity,
      newStock: product.stock,
      note: `Transferred to branch ${branch.name}`,
      createdBy: req.user.id
    });

    const update = {
      $setOnInsert: {
        business: businessId,
        branch: branchId,
        product: productId,
        createdBy: req.user.id
      },
      $inc: {
        quantity: transferQuantity
      }
    };

    if (branchPrice !== undefined) {
      update.$set = { branchPrice: Number(branchPrice) };
    }

    const inventory = await BranchInventory.findOneAndUpdate(
      { business: businessId, branch: branchId, product: productId },
      update,
      { upsert: true, new: true }
    );

    res.json(inventory);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getBranchInventory = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const branchId = req.query.branchId || req.user.branchId;

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    const branch = await Branch.findOne({ _id: branchId, business: businessId });
    if (!branch) {
      return res.status(404).json({ message: "Branch not found" });
    }

    const inventory = await BranchInventory.find({ business: businessId, branch: branchId })
      .populate("product", "name sku category price costPrice")
      .lean();

    res.json(inventory);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateBranchInventory = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const branchId = req.body.branchId || req.user.branchId;
    const { productId, quantity, branchPrice } = req.body;

    if (!branchId || !productId) {
      return res.status(400).json({ message: "branchId and productId are required" });
    }

    const branch = await Branch.findOne({ _id: branchId, business: businessId });
    if (!branch) {
      return res.status(404).json({ message: "Branch not found" });
    }

    const inventory = await BranchInventory.findOne({ business: businessId, branch: branchId, product: productId });
    if (!inventory) {
      return res.status(404).json({ message: "Branch inventory entry not found" });
    }

    if (quantity !== undefined) {
      inventory.quantity = Number(quantity);
    }
    if (branchPrice !== undefined) {
      inventory.branchPrice = Number(branchPrice);
    }

    await inventory.save();
    res.json(inventory);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getImportStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const job = await OperationLog.findById(id).lean();
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json({ status: job.status, metadata: job.metadata, error: job.error });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export default {
  importProductToBranch,
  getBranchInventory,
  updateBranchInventory,
  getImportStatus
};
