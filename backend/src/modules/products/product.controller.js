import Product from "./product.model.js";
import Business from "../businesses/business.model.js";
import applyBusinessFilter from "../../utils/applyBusinessFilter.js";
import XLSX from "xlsx";
import { findCatalogMatch, mergeCatalogValues } from "../catalog/catalogUtils.js";
import { isPrivileged } from "../../utils/branchAccess.js";
import BranchInventory from "../branches/branchInventory.model.js";

const findExistingProductMatch = async (businessId, name, excludeId = null) => {
  if (!name || !String(name).trim()) return null;

  const query = { business: businessId };
  if (excludeId) query._id = { $ne: excludeId };

  const items = await Product.find(query).select("_id name stock price costPrice sku").lean();
  return findCatalogMatch(items, name);
};

// 🔥 CREATE PRODUCT
const createProduct = async (req, res) => {
  try {
    const business = await Business.findById(req.user.businessId);
    if (!business) return res.status(404).json({ message: "Business not found" });

    // 1. Subscription Check
    const isExpired = business.subscription?.status === "expired" || 
                     (business.subscription?.status === "trial" && new Date() > business.trialEndsAt);
    if (isExpired) return res.status(403).json({ message: "Subscription expired. Please upgrade." });

    // 2. Limit Check
    const limits = business.getLimits();
    const currentCount = await Product.countDocuments({ business: business._id });
    if (currentCount >= limits.products) return res.status(403).json({ message: "Product limit reached for your plan." });

    const { name, sellingPrice, costPrice, stock, category, sku } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Product name is required" });
    }

    const existing = await findExistingProductMatch(business._id, name);
    if (existing) {
      const merged = mergeCatalogValues(existing, {
        name,
        stock: isPrivileged(req.user) ? Number(stock) || 0 : Number(existing.stock || 0),
        price: Number(sellingPrice) || Number(existing.price) || 0,
        costPrice: Number(costPrice) || Number(existing.costPrice) || 0,
        sku: sku || existing.sku || ""
      });

      const product = await Product.findByIdAndUpdate(existing._id, {
        $set: {
          name: merged.name,
          category: category || existing.category || "General",
          price: Number(merged.price) || 0,
          costPrice: Number(merged.costPrice) || 0,
          stock: isPrivileged(req.user) ? Number(merged.stock) || 0 : Number(existing.stock || 0),
          sku: merged.sku || `SKU-${Date.now()}`
        }
      }, { new: true });

      return res.status(200).json({ ...product.toObject(), merged: true, duplicateOf: existing._id });
    }

    const product = await Product.create({
      name: String(name).trim(),
      category: category || "General",
      price: Number(sellingPrice) || 0,
      costPrice: Number(costPrice) || 0,
      stock: isPrivileged(req.user) ? Number(stock) || 0 : 0,
      sku: sku || `SKU-${Date.now()}`,
      business: business._id
    });

    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔥 BULK IMPORT
const bulkImportProducts = async (req, res) => {
  try {
    const business = await Business.findById(req.user.businessId);
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    if (!rows.length) return res.status(400).json({ message: "File is empty" });

    const productsToInsert = [];
    const existingProducts = await Product.find({ business: business._id }).select("_id name stock price costPrice sku").lean();

    for (const row of rows) {
      if (!row.name) continue;

      const existing = findCatalogMatch(existingProducts, row.name);
      if (existing) {
        const merged = mergeCatalogValues(existing, {
          name: row.name,
          stock: isPrivileged(req.user) ? Number(row.stock || 0) : Number(existing.stock || 0),
          price: Number(row.sellingPrice || row.price || 0),
          costPrice: Number(row.costPrice || 0),
          sku: row.sku || existing.sku || ""
        });

        await Product.findByIdAndUpdate(existing._id, {
          $set: {
            name: merged.name,
            price: Number(merged.price) || 0,
            costPrice: Number(merged.costPrice) || 0,
            stock: isPrivileged(req.user) ? Number(merged.stock) || 0 : Number(existing.stock || 0),
            sku: merged.sku || existing.sku || `SKU-${Date.now()}`
          }
        });
        continue;
      }

      productsToInsert.push({
        name: String(row.name),
        category: row.category || "General",
        price: Number(row.sellingPrice || row.price || 0),
        costPrice: Number(row.costPrice || 0),
        stock: isPrivileged(req.user) ? Number(row.stock || 0) : 0,
        sku: row.sku || `SKU-${Math.random().toString(36).substr(2, 9)}`,
        business: business._id
      });
    }

    if (!productsToInsert.length) return res.status(400).json({ message: "No new valid products found" });

    await Product.insertMany(productsToInsert);
    res.json({ message: `${productsToInsert.length} products imported.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔥 GET PRODUCTS
const getProducts = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const requestedLimit = Number(req.query.limit) || 20;
    const limit = Math.min(Math.max(requestedLimit, 1), 5000);
    const skip = (page - 1) * limit;

    // Retail-only products for POS. School and hospital accounts should not crash.
    if (["school", "hospital"].includes(req.user?.industryType)) {
      return res.json({
        products: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalProducts: 0,
          hasNextPage: false,
          hasPrevPage: page > 1
        }
      });
    }

    const filter = {
      business: req.user.businessId
    };

    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { sku: { $regex: req.query.search, $options: "i" } }
      ];
    }
    if (req.query.category) filter.category = req.query.category;

    const totalProducts = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const branchInventory = req.user.branchId
      ? await BranchInventory.find({
          business: req.user.businessId,
          branch: req.user.branchId,
          product: { $in: products.map((product) => product._id) }
        }).lean()
      : [];
    const branchStockByProduct = new Map(
      branchInventory.map((entry) => [String(entry.product), entry])
    );

    // Standardize price fields for frontend
    const safeProducts = products.map((product) => {
      const branchEntry = branchStockByProduct.get(String(product._id));
      const isBranchUser = Boolean(req.user.branchId) && !isPrivileged(req.user);

      return {
        ...product,
        stock: isBranchUser ? Number(branchEntry?.quantity || 0) : product.stock,
        price: isBranchUser ? Number(branchEntry?.branchPrice ?? product.price ?? 0) : product.price || 0,
        sellingPrice: isBranchUser ? Number(branchEntry?.branchPrice ?? product.price ?? 0) : product.price || 0
      };
    });

    res.json({
      products: safeProducts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalProducts / limit),
        totalProducts,
        hasNextPage: page * limit < totalProducts,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    console.error("GET PRODUCTS ERROR:", err);
    return res.status(200).json({ success: true, data: [] });
  }
};

// 🔥 UPDATE PRODUCT
const updateProduct = async (req, res) => {
  try {
    const { name, sellingPrice, costPrice, stock, category, sku } = req.body;
    const updateData = {};

    if (name !== undefined) {
      const duplicate = await findExistingProductMatch(req.user.businessId, name, req.params.id);
      if (duplicate) {
        const merged = mergeCatalogValues(duplicate, {
          name,
          stock: isPrivileged(req.user) ? Number(stock ?? duplicate.stock ?? 0) : Number(duplicate.stock || 0),
          price: Number(sellingPrice ?? duplicate.price ?? 0),
          costPrice: Number(costPrice ?? duplicate.costPrice ?? 0),
          sku: sku || duplicate.sku || ""
        });

        await Product.findByIdAndUpdate(duplicate._id, {
          $set: {
            name: merged.name,
            category: category || duplicate.category || "General",
            price: Number(merged.price) || 0,
            costPrice: Number(merged.costPrice) || 0,
            stock: isPrivileged(req.user) ? Number(merged.stock) || 0 : Number(duplicate.stock || 0),
            sku: merged.sku || duplicate.sku || `SKU-${Date.now()}`
          }
        });

        return res.status(200).json({ ...duplicate, name: merged.name, stock: Number(merged.stock) || 0, merged: true });
      }

      updateData.name = String(name).trim();
    }

    if (category !== undefined) updateData.category = category;
    if (sellingPrice !== undefined) updateData.price = Number(sellingPrice);
    if (costPrice !== undefined) updateData.costPrice = Number(costPrice);
    if (stock !== undefined && isPrivileged(req.user)) updateData.stock = Number(stock);
    if (sku !== undefined) updateData.sku = sku;

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, business: req.user.businessId },
      { $set: updateData },
      { new: true }
    );

    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔥 BULK DELETE PRODUCTS
const bulkDeleteProducts = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: "A non-empty array of product ids is required." });
    }

    const result = await Product.deleteMany({
      _id: { $in: ids },
      business: req.user.businessId
    });

    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} product(s)`
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔥 DELETE PRODUCT
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({ 
      _id: req.params.id, 
      business: req.user.businessId 
    });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔥 GET PRODUCTS FOR AUTOCOMPLETE (minimal data for searchable dropdown)
const getProductsForAutocomplete = async (req, res) => {
  try {
    const { search = "", limit = 20 } = req.query;
    const businessId = req.user.businessId;

    const filter = { business: businessId };
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } }
      ];
    }

    const products = await Product.find(filter)
      .select('_id name category price costPrice stock sku')
      .limit(parseInt(limit))
      .lean();

    res.json({ products });
  } catch (error) {
    res.status(500).json({ message: "Error fetching products", error: error.message });
  }
};

export default { createProduct, bulkImportProducts, getProducts, getProductsForAutocomplete, updateProduct, deleteProduct, bulkDeleteProducts };