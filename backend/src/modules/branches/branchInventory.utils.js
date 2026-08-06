import BranchInventory from "./branchInventory.model.js";

export const getBranchInventoryEntry = async ({ businessId, branchId, productId }) => {
  if (!branchId) return null;
  return BranchInventory.findOne({ business: businessId, branch: branchId, product: productId });
};

export const adjustBranchInventory = async ({ businessId, branchId, productId, quantityChange, branchPrice, userId }) => {
  if (!branchId) return null;

  return BranchInventory.findOneAndUpdate(
    { business: businessId, branch: branchId, product: productId },
    {
      $setOnInsert: {
        business: businessId,
        branch: branchId,
        product: productId,
        createdBy: userId
      },
      $inc: { quantity: quantityChange },
      ...(branchPrice !== undefined ? { $set: { branchPrice } } : {})
    },
    { upsert: true, new: true }
  );
};
