import mongoose from "mongoose";

const categoryBudgetSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true
    },

    category: {
      type: String,
      required: true,
      enum: [
        "inventory",
        "logistics",
        "utilities",
        "salaries",
        "rent",
        "marketing",
        "miscellaneous"
      ],
      index: true
    },

    monthlyBudget: {
      type: Number,
      required: true,
      min: 0,
      description: "Maximum allowed spending for this category per month"
    },

    alertThresholdPercent: {
      type: Number,
      default: 80,
      min: 0,
      max: 100,
      description: "Alert when spending reaches this percentage of budget"
    },

    isActive: {
      type: Boolean,
      default: true
    },

    notes: {
      type: String,
      default: ""
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  {
    timestamps: true
  }
);

// Ensure one budget per business per category
categoryBudgetSchema.index({ business: 1, category: 1 }, { unique: true });

export default mongoose.model("CategoryBudget", categoryBudgetSchema);
