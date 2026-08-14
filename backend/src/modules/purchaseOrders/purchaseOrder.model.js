import mongoose from "mongoose";

const purchaseItemSchema =
  new mongoose.Schema({

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product"
    },

    name: String,

    quantity: Number,

    quantityReceived: {
      type: Number,
      default: 0
    },

    costPrice: Number,

    total: Number,

    receivedDate: Date,

    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }

  }, { _id: false });

const purchaseOrderSchema =
  new mongoose.Schema({

    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true
    },

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier"
    },

    items: [purchaseItemSchema],

    totalAmount: {
      type: Number,
      default: 0
    },

    destinationBranch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null
    },

    paymentTerms: {
      type: String,
      enum: ["immediate", "net30", "net60"],
      default: "immediate"
    },

    status: {
      type: String,

      enum: [
        "pending",
        "partial",
        "received",
        "cancelled"
      ],

      default: "pending"
    },

    receiptStatus: {
      type: String,
      enum: ["awaiting", "partial", "complete"],
      default: "awaiting"
    },

    receivedDate: Date,

    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    linkedExpense: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Expense",
      default: null
    },

    notes: {
      type: String,
      default: ""
    }

  }, {
    timestamps: true
  });

export default mongoose.model(
  "PurchaseOrder",
  purchaseOrderSchema
);