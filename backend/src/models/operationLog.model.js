import mongoose from "mongoose";

const operationLogSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    operationType: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["pending", "in_progress", "completed", "failed"], default: "pending" },
    metadata: { type: Object, default: {} },
    error: { type: String }
  },
  { timestamps: true }
);

// Indexes to speed up admin queries and filtering
operationLogSchema.index({ createdAt: -1 });
operationLogSchema.index({ status: 1 });
operationLogSchema.index({ operationType: 1 });
operationLogSchema.index({ business: 1 });
operationLogSchema.index({ branch: 1 });

const OperationLog = mongoose.model("OperationLog", operationLogSchema);

export default OperationLog;
