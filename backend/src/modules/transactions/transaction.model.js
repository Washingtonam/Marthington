import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true
    },
    transactionType: {
      type: String,
      enum: ["income", "expense", "transfer", "adjustment"],
      default: "income"
    },
    category: {
      type: String,
      default: "general"
    },
    description: {
      type: String,
      default: ""
    },
    accountName: {
      type: String,
      default: "General Expenses"
    },
    postingType: {
      type: String,
      enum: ["debit", "credit"],
      default: "debit"
    },
    sourceModel: {
      type: String,
      default: null
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null
    },
    status: {
      type: String,
      enum: ["pending", "posted", "reversed"],
      default: "pending"
    },
    occurredAt: {
      type: Date,
      default: Date.now
    },
    amount: {
      type: Number,
      required: true,
      default: 0
    },
    profit: {
      type: Number,
      default: 0
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  { timestamps: true }
);

transactionSchema.set("toJSON", {
  virtuals: true
});

transactionSchema.set("toObject", {
  virtuals: true
});

export default mongoose.model("Transaction", transactionSchema);
