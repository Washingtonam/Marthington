import BranchInventory from "../modules/branches/branchInventory.model.js";
import Product from "../modules/products/product.model.js";
import OperationLog from "../models/operationLog.model.js";

export const processBranchImportJob = async ({
  jobId,
  businessId,
  branchId,
  userId,
  sourceType = "headOffice",
  sourceBranchId = null
}) => {
  try {
    await OperationLog.findByIdAndUpdate(jobId, { status: "in_progress" });

    const batchSize = 200;
    const items = [];
    let totalProducts = 0;

    if (sourceType === "headOffice") {
      const query = { business: businessId };
      totalProducts = await Product.countDocuments(query);
      const cursor = Product.find(query).select("_id price").lean().cursor();

      for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        items.push({ productId: doc._id, branchPrice: doc.price || 0, quantity: 0 });
      }
    } else if (sourceType === "branch") {
      if (!sourceBranchId) {
        throw new Error("sourceBranchId is required for branch import");
      }

      const cursor = BranchInventory.find({ business: businessId, branch: sourceBranchId })
        .populate("product", "price")
        .lean()
        .cursor();

      for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        const branchPrice = doc.branchPrice !== undefined && doc.branchPrice !== null
          ? doc.branchPrice
          : doc.product?.price || 0;

        items.push({ productId: doc.product._id, branchPrice, quantity: Number(doc.quantity || 0) });
      }
      totalProducts = items.length;
    } else {
      throw new Error("Invalid sourceType for branch import");
    }

    let processed = 0;
    const beforeCount = await BranchInventory.countDocuments({ business: businessId, branch: branchId });

    const flushBatch = async (batch) => {
      if (!batch.length) return;

      const ops = batch.map((item) => ({
        updateOne: {
          filter: { business: businessId, branch: branchId, product: item.productId },
          update: {
            $setOnInsert: {
              business: businessId,
              branch: branchId,
              product: item.productId,
              createdBy: userId,
              branchPrice: item.branchPrice,
              quantity: Number(item.quantity || 0)
            },
            $set: {
              branchPrice: item.branchPrice,
              quantity: Number(item.quantity || 0)
            }
          },
          upsert: true
        }
      }));

      try {
        await BranchInventory.bulkWrite(ops, { ordered: false });
      } catch (err) {
        console.warn("Bulk upsert chunk failed:", err.message || err);
      }

      processed += batch.length;
      await OperationLog.findByIdAndUpdate(jobId, { metadata: { totalProducts, processed } });
    };

    let batch = [];
    for (const item of items) {
      batch.push(item);
      if (batch.length >= batchSize) {
        await flushBatch(batch);
        batch = [];
      }
    }

    if (batch.length) {
      await flushBatch(batch);
    }

    const afterCount = await BranchInventory.countDocuments({ business: businessId, branch: branchId });
    const imported = Math.max(0, afterCount - beforeCount);

    await OperationLog.findByIdAndUpdate(jobId, {
      status: "completed",
      metadata: { totalProducts, processed, imported, sourceType, sourceBranchId }
    });
  } catch (err) {
    console.error("Branch import processor failed:", err.message || err);
    await OperationLog.findByIdAndUpdate(jobId, {
      status: "failed",
      error: err.message || String(err)
    });
    throw err;
  }
};
