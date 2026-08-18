import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true
    },

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    description: {
      type: String,
      required: true,
      trim: true
    },

    category: {
      type: String,
      enum: ["inventory", "logistics", "utilities", "salaries", "rent", "marketing", "miscellaneous"],
      default: "miscellaneous"
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "card", "store_credit"],
      default: "cash"
    },

    date: {
      type: Date,
      required: true,
      default: () => new Date()
    },

    receiptUrl: {
      type: String,
      default: null
    },

    notes: {
      type: String,
      default: ""
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    clientOperationId: {
      type: String
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },

    linkedInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null
    },

    linkedPurchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      default: null
    },

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      default: null
    },

    budgetAllocation: {
      type: Number,
      default: null
    },

    inventoryItems: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product"
        },
        productName: String,
        quantity: Number,
        unitCost: Number,
        inventoryUpdated: {
          type: Boolean,
          default: false
        }
      }
    ]
  },
  { timestamps: true }
);

// Index for faster queries
expenseSchema.index({ business: 1, date: -1 });
expenseSchema.index({ business: 1, category: 1 });
expenseSchema.index({ business: 1, createdAt: -1 });
expenseSchema.index({ business: 1, branch: 1 });
expenseSchema.index({ business: 1, status: 1 });
expenseSchema.index({ linkedInvoice: 1 });
expenseSchema.index(
  { business: 1, clientOperationId: 1 },
  { unique: true, sparse: true }
);

const Expense = mongoose.model("Expense", expenseSchema);

export default Expense;
