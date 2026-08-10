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
    const {
      branchId,
      productId,
      quantity,
      branchPrice,
      sourceType = "headOffice",
      sourceBranchId
    } = req.body;
    const businessId = req.user.businessId;

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    if (sourceType !== "headOffice" && sourceType !== "branch") {
      return res.status(400).json({ message: "sourceType must be either 'headOffice' or 'branch'" });
    }

    const branch = await Branch.findOne({ _id: branchId, business: businessId });
    if (!branch) {
      return res.status(404).json({ message: "Branch not found" });
    }

    // BULK IMPORT: when no productId supplied, register branch inventory items
    // in the target branch without changing head office stock.
    if (!productId) {
      if (sourceType === "branch") {
        if (!sourceBranchId) {
          return res.status(400).json({ message: "sourceBranchId is required when importing from another branch" });
        }
        if (sourceBranchId.toString() === branchId.toString()) {
          return res.status(400).json({ message: "sourceBranchId must be different from target branchId" });
        }

        const sourceBranch = await Branch.findOne({ _id: sourceBranchId, business: businessId });
        if (!sourceBranch) {
          return res.status(404).json({ message: "Source branch not found" });
        }
      }

      // Create an operation log and enqueue a background job for processing.
      const jobDoc = await OperationLog.create({
        business: businessId,
        branch: branchId,
        operationType: "branch_bulk_import",
        user: req.user.id,
        status: "pending",
        metadata: { sourceType, sourceBranchId }
      });

      try {
        await importQueue.add({
          jobId: jobDoc._id.toString(),
          businessId,
          branchId,
          userId: req.user.id,
          sourceType,
          sourceBranchId
        });
      } catch (err) {
        console.error("Branch import enqueue failed; falling back to inline processing:", err.message || err);
        if (importQueue.addInline) {
          await importQueue.addInline({
            jobId: jobDoc._id.toString(),
            businessId,
            branchId,
            userId: req.user.id,
            sourceType,
            sourceBranchId
          });
        }
      }

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

    const page = Math.max(Number(req.query.page) || 1, 1);
    const requestedLimit = Number(req.query.limit) || 20;
    const limit = Math.min(Math.max(requestedLimit, 1), 100);
    const skip = (page - 1) * limit;
    const search = String(req.query.search || "").trim();

    if (branchId === "headOffice") {
      if (req.user.role !== "owner") {
        return res.status(403).json({ message: "Only the owner can view head office stock" });
      }

      const filter = { business: businessId };
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { sku: { $regex: search, $options: "i" } }
        ];
      }

      const totalItems = await Product.countDocuments(filter);
      const products = await Product.find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const inventory = products.map((product) => ({
        _id: `head-office-${product._id}`,
        product: {
          _id: product._id,
          name: product.name,
          sku: product.sku,
          category: product.category,
          price: product.price,
          costPrice: product.costPrice
        },
        quantity: Number(product.stock || 0),
        branchPrice: Number(product.price || 0),
        isHeadOffice: true,
        sourceLocation: "headOffice"
      }));

      return res.json({
        inventory,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalItems / limit),
          totalItems,
          hasNextPage: page * limit < totalItems,
          hasPrevPage: page > 1
        }
      });
    }

    const branch = await Branch.findOne({ _id: branchId, business: businessId });
    if (!branch) {
      return res.status(404).json({ message: "Branch not found" });
    }

    const inventoryRecords = await BranchInventory.find({ business: businessId, branch: branchId })
      .populate("product", "name sku category price costPrice")
      .sort({ createdAt: -1 })
      .lean();

    const filtered = search
      ? inventoryRecords.filter((entry) => {
          const name = entry.product?.name || "";
          const sku = entry.product?.sku || "";
          return [name, sku].some((value) => value.toLowerCase().includes(search.toLowerCase()));
        })
      : inventoryRecords;

    const paged = filtered.slice(skip, skip + limit);

    res.json({
      inventory: paged,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(filtered.length / limit),
        totalItems: filtered.length,
        hasNextPage: page * limit < filtered.length,
        hasPrevPage: page > 1
      }
    });
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

    if (branchId === "headOffice") {
      if (req.user.role !== "owner") {
        return res.status(403).json({ message: "Only the owner can update head office stock" });
      }

      const product = await Product.findOne({ _id: productId, business: businessId });
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (quantity !== undefined) {
        product.stock = Number(quantity);
      }
      if (branchPrice !== undefined) {
        product.price = Number(branchPrice);
      }

      await product.save();
      return res.json(product);
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
