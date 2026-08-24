import mongoose from "mongoose";
import BranchTransferRequest from "./branchTransfer.model.js";
import Branch from "./branch.model.js";
import BranchInventory from "./branchInventory.model.js";
import Product from "../products/product.model.js";
import InventoryMovement from "../inventory/inventory.model.js";
import User from "../users/user.model.js";
import Notification from "../notifications/notification.model.js";
import { canAccessBranch, isPrivileged } from "../../utils/branchAccess.js";

const requestTransfer = async (req, res) => {
  try {
    const { sourceType = "headOffice", sourceBranch, targetBranch, product, quantity } = req.body;
    const amount = Number(quantity);
    if (!targetBranch || !product || !Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ message: "targetBranch, product, and a positive whole quantity are required" });
    }
    if (sourceType !== "headOffice" && sourceType !== "branch") {
      return res.status(400).json({ message: "Invalid sourceType" });
    }
    if (!canAccessBranch(req.user, targetBranch, "manage")) {
      return res.status(403).json({ message: "You cannot request stock for this branch" });
    }
    if (sourceType === "branch" && (!sourceBranch || !canAccessBranch(req.user, sourceBranch, "view"))) {
      return res.status(403).json({ message: "You cannot request stock from this branch" });
    }
    if (sourceType === "branch" && String(sourceBranch) === String(targetBranch)) {
      return res.status(400).json({ message: "Source and target branches must be different" });
    }

    const [target, item] = await Promise.all([
      Branch.findOne({ _id: targetBranch, business: req.user.businessId }),
      Product.findOne({ _id: product, business: req.user.businessId })
    ]);
    if (!target || !item) return res.status(404).json({ message: "Branch or product not found" });
    if (sourceType === "branch" && !(await Branch.findOne({ _id: sourceBranch, business: req.user.businessId }))) {
      return res.status(404).json({ message: "Source branch not found" });
    }

    const transfer = await BranchTransferRequest.create({
      business: req.user.businessId,
      sourceType,
      sourceBranch: sourceType === "branch" ? sourceBranch : null,
      targetBranch,
      product,
      quantity: amount,
      requestedBy: req.user.id
    });

    const approvers = await User.find({
      business: req.user.businessId,
      role: { $in: ["owner", "manager"] },
      isActive: true
    }).select("_id");
    if (approvers.length) {
      await Notification.insertMany(approvers.map(({ _id }) => ({
        recipient: _id,
        type: "branch_transfer_requested",
        title: "Branch transfer requested",
        message: `${req.user.name || "A staff member"} requested ${amount} ${item.name} for ${target.name}.`,
        transferRequestId: transfer._id,
        actionUrl: "/app/branch-inventory",
        metadata: { targetBranch, sourceBranch: sourceBranch || null, product, quantity: amount }
      })));
    }
    return res.status(201).json(transfer);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const listTransfers = async (req, res) => {
  const filter = { business: req.user.businessId };
  if (!isPrivileged(req.user)) filter.targetBranch = req.user.branchId;
  if (req.query.status) filter.status = req.query.status;
  const transfers = await BranchTransferRequest.find(filter)
    .populate("sourceBranch targetBranch", "name")
    .populate("product", "name sku")
    .populate("requestedBy reviewedBy", "name email")
    .sort({ createdAt: -1 });
  return res.json(transfers);
};

const reviewTransfer = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (!isPrivileged(req.user)) return res.status(403).json({ message: "Only the owner can review transfer requests" });
    const transfer = await BranchTransferRequest.findOne({ _id: req.params.id, business: req.user.businessId }).session(session);
    if (!transfer) return res.status(404).json({ message: "Transfer request not found" });
    if (transfer.status !== "pending") return res.status(409).json({ message: "Transfer request has already been reviewed" });

    if (req.body.status === "rejected") {
      transfer.status = "rejected";
      transfer.reviewNote = String(req.body.note || "");
    } else if (req.body.status === "approved") {
      session.startTransaction();
      const product = await Product.findOne({ _id: transfer.product, business: transfer.business }).session(session);
      const target = await BranchInventory.findOne({ business: transfer.business, branch: transfer.targetBranch, product: transfer.product }).session(session);
      let sourceBefore;
      let sourceAfter;
      if (transfer.sourceType === "headOffice") {
        if (Number(product?.stock || 0) < transfer.quantity) throw new Error("Insufficient head-office stock");
        sourceBefore = Number(product.stock);
        product.stock -= transfer.quantity;
        sourceAfter = product.stock;
        await product.save({ session });
      } else {
        const source = await BranchInventory.findOne({ business: transfer.business, branch: transfer.sourceBranch, product: transfer.product }).session(session);
        if (!source || source.quantity < transfer.quantity) throw new Error("Insufficient source branch stock");
        sourceBefore = source.quantity;
        source.quantity -= transfer.quantity;
        await source.save({ session });
        sourceAfter = source.quantity;
      }
      const targetBefore = Number(target?.quantity || 0);
      const targetAfter = targetBefore + transfer.quantity;
      if (target) {
        target.quantity = targetAfter;
        await target.save({ session });
      } else {
        await BranchInventory.create([{ business: transfer.business, branch: transfer.targetBranch, product: transfer.product, quantity: targetAfter, unitCost: Number(product?.costPrice || 0), createdBy: transfer.requestedBy }], { session });
      }
      await InventoryMovement.create([
        { business: transfer.business, branch: transfer.sourceType === "branch" ? transfer.sourceBranch : null, product: transfer.product, type: "transfer", quantity: transfer.quantity, previousStock: sourceBefore, newStock: sourceAfter, createdBy: req.user.id },
        { business: transfer.business, branch: transfer.targetBranch, product: transfer.product, type: "transfer", quantity: transfer.quantity, previousStock: targetBefore, newStock: targetAfter, createdBy: req.user.id }
      ], { session });
      transfer.status = "approved";
      transfer.reviewNote = String(req.body.note || "");
      await transfer.save({ session });
      await session.commitTransaction();
    } else {
      return res.status(400).json({ message: "status must be approved or rejected" });
    }
    transfer.reviewedBy = req.user.id;
    transfer.reviewedAt = new Date();
    await transfer.save();
    await Notification.create({ recipient: transfer.requestedBy, type: transfer.status === "approved" ? "branch_transfer_approved" : "branch_transfer_rejected", title: `Branch transfer ${transfer.status}`, message: `Your transfer request was ${transfer.status}.`, transferRequestId: transfer._id, actionUrl: "/app/branch-inventory", metadata: { note: transfer.reviewNote } });
    return res.json(transfer);
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    return res.status(400).json({ message: err.message });
  } finally {
    await session.endSession();
  }
};

export default { requestTransfer, listTransfers, reviewTransfer };
