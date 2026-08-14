import mongoose from "mongoose";

const businessSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },

    logo: { type: String, default: "" },

    receiptTheme: {
      type: String,
      enum: ["modern", "classic", "minimal", "premium"],
      default: "modern"
    },

    receiptFooter: {
      type: String,
      default: "Thank you for your business!"
    },

    brandSettings: {

      primaryColor: {
        type: String,
        default: "#16a34a"
      },

      secondaryColor: {
        type: String,
        default: "#0f172a"
      },

      accentColor: {
        type: String,
        default: "#dcfce7"
      },

      showLogo: {
        type: Boolean,
        default: true
      },

      showBusinessAddress: {
        type: Boolean,
        default: true
      },

      showPhone: {
        type: Boolean,
        default: true
      },

      showEmail: {
        type: Boolean,
        default: true
      },

      watermarkText: {
        type: String,
        default: ""
      }
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    referredBy: {
      type: String,
      default: null,
      index: true
    },

    businessType: {
      type: String,
      enum: [
        "retail_hardware",
        "restaurant_hospitality",
        "hotel_lodging",
        "general_services"
      ],
      default: "general_services"
    },

    industryType: {
      type: String,
      enum: ["retail", "school", "hospital"],
      default: "retail",
      required: true
    },

    // 🔥 SINGLE SOURCE OF TRUTH
    subscription: {
      plan: {
        type: String,
        enum: ["free", "pro"],
        default: "free"
      },

      billingCycle: {
        type: String,
        enum: ["monthly", "yearly", null],
        default: null
      },

      status: {
        type: String,
        enum: ["trial", "active", "expired"],
        default: "trial"
      },

      startedAt: {
        type: Date,
        default: null
      },

      expiresAt: {
        type: Date,
        default: null
      },

      amount: {
        type: Number,
        default: 0
      },

      tier: {
        type: String,
        default: ""
      },

      reference: {
        type: String,
        default: ""
      }
    },

    approvalRules: {
      autoApproveEnabled: {
        type: Boolean,
        default: false
      },
      maxAutoApproveAmount: {
        type: Number,
        default: 0
      },
      exemptCategories: {
        type: [String],
        default: []
      },
      trustedSuppliers: {
        type: [String],
        default: []
      }
    },

    // 🔥 TRIAL SYSTEM
    trialEndsAt: {
      type: Date,
      default: () => {
        const now = new Date();
        now.setDate(now.getDate() + 7);
        return now;
      }
    }

    ,
    // 🔥 SOFT STATUS: active | suspended | archived | deleted
    status: {
      type: String,
      enum: ["active", "suspended", "archived", "deleted"],
      default: "active",
      index: true
    }
  },
  {
    timestamps: true
  }
);

// 🔥 SMART LIMIT SYSTEM (BASED ON REAL PLAN)
businessSchema.methods.getLimits = function () {
  const plan = this.subscription?.plan;

  if (plan === "pro") {
    return {
      products: Infinity,
      staff: Infinity
    };
  }

  return {
    products: 20,
    staff: 1
  };
};

const Business = mongoose.model("Business", businessSchema);

export default Business;