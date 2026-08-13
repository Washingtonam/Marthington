import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true
    },

    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "card", "check", "mobile_money", "paystack", "flutterwave", "other"],
      default: "cash"
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    paymentDate: {
      type: Date,
      default: Date.now
    },

    referenceNumber: {
      type: String,
      default: ""
    },

    notes: {
      type: String,
      default: ""
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    status: {
      type: String,
      enum: ["pending", "confirmed", "failed", "refunded"],
      default: "confirmed"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);
