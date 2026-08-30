import mongoose from "mongoose";

const invoiceCounterSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      unique: true
    },

    lastNumber: {
      type: Number,
      default: 0
    },

    prefix: {
      type: String,
      default: "INV"
    },

    format: {
      type: String,
      default: "{prefix}-{YYYY}-{MM}-{000000}"
    }
  },
  { timestamps: true }
);

export default mongoose.model("InvoiceCounter", invoiceCounterSchema);
