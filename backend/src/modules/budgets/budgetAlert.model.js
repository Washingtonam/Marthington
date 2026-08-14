import mongoose from "mongoose";

const budgetAlertSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true
    },
    category: {
      type: String,
      enum: ["inventory", "logistics", "utilities", "salaries", "rent", "marketing", "miscellaneous"],
      required: true
    },
    month: {
      type: Number, // 0-11
      required: true
    },
    year: {
      type: Number,
      required: true
    },
    alertType: {
      type: String,
      enum: ["threshold_reached", "budget_exceeded"],
      required: true
    },
    threshold: Number, // The threshold percentage that triggered alert
    budgeted: Number, // Budget amount at time of alert
    spent: Number, // Amount spent when alert triggered
    percentUsed: Number, // Percent of budget used when alert triggered
    alertedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    sentAt: {
      type: Date,
      default: Date.now
    },
    isAcknowledged: {
      type: Boolean,
      default: false
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    acknowledgedAt: Date,
    notes: String
  },
  {
    timestamps: true
  }
);

// Unique index: only one alert per business/category/month/year/alertType
budgetAlertSchema.index({ business: 1, category: 1, month: 1, year: 1, alertType: 1 }, { unique: true });

export default mongoose.model("BudgetAlert", budgetAlertSchema);
