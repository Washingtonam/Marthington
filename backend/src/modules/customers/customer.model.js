import mongoose from "mongoose";

const normalizePhoneNumber = (value = "") => {
  if (typeof value !== "string") {
    return "";
  }

  const digits = value.replace(/\D/g, "").trim();

  if (!digits) {
    return "";
  }

  if (digits.startsWith("234")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `234${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    return `234${digits}`;
  }

  return digits;
};

const customerSchema =
  new mongoose.Schema({

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

    name: {
      type: String,
      required: true,
      trim: true
    },

    phone: {
      type: String,
      default: ""
    },

    phoneNormalized: {
      type: String,
      default: "",
      index: true,
      sparse: true
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

    totalSpent: {
      type: Number,
      default: 0
    },

    totalOrders: {
      type: Number,
      default: 0
    },

    outstandingBalance: {
      type: Number,
      default: 0
    },

    loyaltyPoints: {
      type: Number,
      default: 0
    },

    lastPurchaseAt: {
      type: Date,
      default: null
    },

    isActive: {
      type: Boolean,
      default: true
    }

  }, {
    timestamps: true
  });

customerSchema.statics.normalizePhoneNumber = normalizePhoneNumber;

customerSchema.pre("save", function (next) {
  if (this.phone) {
    const normalized = normalizePhoneNumber(this.phone);
    this.phone = normalized || this.phone.trim();
    this.phoneNormalized = normalized;
  } else {
    this.phoneNormalized = "";
  }
  next();
});

customerSchema.index({ business: 1, phoneNormalized: 1 }, { sparse: true });

export default mongoose.model(
  "Customer",
  customerSchema
);