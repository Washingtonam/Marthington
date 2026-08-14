import mongoose from "mongoose";

const supplierSchema =
  new mongoose.Schema({

    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true
    },

    name: {
      type: String,
      required: true
    },

    phone: {
      type: String,
      default: ""
    },

    email: {
      type: String,
      default: ""
    },

    address: {
      type: String,
      default: ""
    },

    notes: {
      type: String,
      default: ""
    },

    isActive: {
      type: Boolean,
      default: true
    },

    paymentTerms: {
      type: String,
      enum: ["immediate", "net30", "net60"],
      default: "immediate"
    },

    totalPurchases: {
      type: Number,
      default: 0
    },

    totalPaid: {
      type: Number,
      default: 0
    },

    outstandingBalance: {
      type: Number,
      default: 0
    }

  }, {
    timestamps: true
  });

export default mongoose.model(
  "Supplier",
  supplierSchema
);