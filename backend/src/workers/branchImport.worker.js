import importQueue from "../queues/importQueue.js";
import Product from "../modules/products/product.model.js";
import BranchInventory from "../modules/branches/branchInventory.model.js";
import OperationLog from "../models/operationLog.model.js";

// Processor for branch import jobs
importQueue.process(async (job) => {
  const { jobId, businessId, branchId, userId } = job.data;

  try {
    await OperationLog.findByIdAndUpdate(jobId, { status: "in_progress" });

    const batchSize = 200;
    const query = { business: businessId };

    const totalProducts = await Product.countDocuments(query);
    let processed = 0;

    const beforeCount = await BranchInventory.countDocuments({ business: businessId, branch: branchId });

    const cursor = Product.find(query).select("_id price").lean().cursor();
    let batch = [];

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      batch.push(doc);

      if (batch.length >= batchSize) {
        const ops = batch.map((p) => ({
          updateOne: {
            filter: { business: businessId, branch: branchId, product: p._id },
            update: { $setOnInsert: { business: businessId, branch: branchId, product: p._id, createdBy: userId, branchPrice: (p.price || 0) } },
            upsert: true
          }
        }));

        try {
          await BranchInventory.bulkWrite(ops, { ordered: false });
        } catch (e) {
          console.warn("Bulk upsert chunk failed:", e.message);
        }

        processed += batch.length;
        batch = [];
        await OperationLog.findByIdAndUpdate(jobId, { metadata: { totalProducts, processed } });
      }
    }

    if (batch.length) {
      const ops = batch.map((p) => ({
        updateOne: {
          filter: { business: businessId, branch: branchId, product: p._id },
          update: { $setOnInsert: { business: businessId, branch: branchId, product: p._id, createdBy: userId, branchPrice: (p.price || 0) } },
          upsert: true
        }
      }));

      try {
        await BranchInventory.bulkWrite(ops, { ordered: false });
      } catch (e) {
        console.warn("Bulk upsert final chunk failed:", e.message);
      }

      processed += batch.length;
      await OperationLog.findByIdAndUpdate(jobId, { metadata: { totalProducts, processed } });
    }

    const afterCount = await BranchInventory.countDocuments({ business: businessId, branch: branchId });
    const imported = Math.max(0, afterCount - beforeCount);

    await OperationLog.findByIdAndUpdate(jobId, { status: "completed", metadata: { totalProducts, processed, imported } });
  } catch (err) {
    console.error("Branch import worker failed:", err.message || err);
    await OperationLog.findByIdAndUpdate(jobId, { status: "failed", error: err.message || String(err) });
    throw err;
  }
});

// Optional: handle failed event logging
importQueue.on("failed", (job, err) => {
  console.error(`Import job ${job.id} failed:`, err.message || err);
});

export default importQueue;
