import mongoose from "mongoose";

const branchTransferRequestSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
  sourceBranch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
  sourceType: { type: String, enum: ["headOffice", "branch"], required: true },
  targetBranch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  quantity: { type: Number, required: true, min: 1 },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewNote: { type: String, default: "" },
  reviewedAt: { type: Date, default: null }
}, { timestamps: true });

branchTransferRequestSchema.index({ business: 1, targetBranch: 1, status: 1 });

export default mongoose.model("BranchTransferRequest", branchTransferRequestSchema);
