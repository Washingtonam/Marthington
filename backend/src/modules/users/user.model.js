import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    // PRODUCTS
    canManageProducts: {
      type: Boolean,
      default: false
    },

    canViewProducts: {
      type: Boolean,
      default: true
    },

    canViewDashboard: {
      type: Boolean,
      default: false
    },

    // SALES
    canMakeSale: {
      type: Boolean,
      default: true
    },

    canViewSales: {
      type: Boolean,
      default: true
    },

    // REPORTS
    canViewReports: {
      type: Boolean,
      default: false
    },

    // PRICE OVERRIDE
    canOverridePrice: {
      type: Boolean,
      default: false
    },

    // BRANCHES
    canViewBranches: {
      type: Boolean,
      default: false
    },

    canManageBranches: {
      type: Boolean,
      default: false
    },

    canViewBranchInventory: {
      type: Boolean,
      default: false
    },

    canManageBranchInventory: {
      type: Boolean,
      default: false
    },

    // CUSTOMERS
    canViewCustomers: {
      type: Boolean,
      default: false
    },

    canManageCustomers: {
      type: Boolean,
      default: false
    },

    // INVOICES
    canViewInvoices: {
      type: Boolean,
      default: false
    },

    canManageInvoices: {
      type: Boolean,
      default: false
    },

    // EXPENSES
    canViewExpenses: {
      type: Boolean,
      default: false
    },

    canManageExpenses: {
      type: Boolean,
      default: false
    },

    // PAYMENTS
    canViewPayments: {
      type: Boolean,
      default: false
    },

    canManagePayments: {
      type: Boolean,
      default: false
    },

    // POS
    canAccessPOS: {
      type: Boolean,
      default: true
    },

    canApplyDiscounts: {
      type: Boolean,
      default: false
    },

    canProcessReturns: {
      type: Boolean,
      default: false
    },

    // REPORTS BREAKDOWN
    canViewSalesReports: {
      type: Boolean,
      default: false
    },

    canViewFinancialReports: {
      type: Boolean,
      default: false
    },

    canViewStaffReports: {
      type: Boolean,
      default: false
    },

    // STAFF CONTROL
    canInviteStaff: {
      type: Boolean,
      default: false
    },

    canEditStaffPermissions: {
      type: Boolean,
      default: false
    },

    canDeactivateStaff: {
      type: Boolean,
      default: false
    },

    // SETTINGS
    canManageSettings: {
      type: Boolean,
      default: false
    },

    canManageBilling: {
      type: Boolean,
      default: false
    },

    canManageBusinessProfile: {
      type: Boolean,
      default: false
    },

    canManageIntegrations: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    phone: {
      type: String,
      default: ""
    },

    phoneNumber: {
      type: String,
      default: ""
    },

    address: {
      type: String,
      default: ""
    },

    password: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: [
        "super_admin",
        "owner",
        "manager",
        "cashier",
        "staff",
        "affiliate"
      ],
      default: "staff"
    },

    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      default: null
    },

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null
    },

    refreshToken: {
      type: String,
      default: null
    },

    permissions: {
      type: permissionSchema,

      default: () => ({
        canViewDashboard: false,
        canManageProducts: false,
        canViewProducts: true,
        canMakeSale: true,
        canViewSales: true,
        canViewReports: false,
        canOverridePrice: false,
        canManageStaff: false,
        canManageSettings: false,
        canViewBranches: false,
        canManageBranches: false,
        canViewBranchInventory: false,
        canManageBranchInventory: false,
        canViewCustomers: false,
        canManageCustomers: false,
        canViewInvoices: false,
        canManageInvoices: false,
        canViewExpenses: false,
        canManageExpenses: false,
        canViewPayments: false,
        canManagePayments: false,
        canAccessPOS: true,
        canApplyDiscounts: false,
        canProcessReturns: false,
        canViewSalesReports: false,
        canViewFinancialReports: false,
        canViewStaffReports: false,
        canInviteStaff: false,
        canEditStaffPermissions: false,
        canDeactivateStaff: false,
        canManageBilling: false,
        canManageBusinessProfile: false,
        canManageIntegrations: false
      })
    },

    isActive: {
      type: Boolean,
      default: true
    },

    affiliateCode: {
      type: String
    },

    walletBalance: {
      type: Number,
      default: 0
    },

    totalEarned: {
      type: Number,
      default: 0
    },

    bankName: {
      type: String,
      default: ""
    },

    accountNumber: {
      type: String,
      default: ""
    },

    accountName: {
      type: String,
      default: ""
    },

    paymentDetails: {
      bankName: {
        type: String,
        default: ""
      },
      accountNumber: {
        type: String,
        default: ""
      },
      accountName: {
        type: String,
        default: ""
      }
    }
  },
  {
    timestamps: true
  }
);

// Ensure affiliateCode is not stored as explicit null (which breaks unique sparse index)
userSchema.pre('save', function (next) {
  if (this.isModified('affiliateCode') && this.affiliateCode === null) {
    this.affiliateCode = undefined;
  }
  next();
});

userSchema.pre('insertMany', function (next, docs) {
  if (Array.isArray(docs)) {
    for (const doc of docs) {
      if (doc && doc.affiliateCode === null) {
        delete doc.affiliateCode;
      }
    }
  }
  next();
});

// Partial unique index for affiliateCode: enforce uniqueness only when the field exists and is not null
userSchema.index({ affiliateCode: 1 }, { unique: true, partialFilterExpression: { affiliateCode: { $exists: true, $ne: null } } });

export default mongoose.model(
  "User",
  userSchema
);