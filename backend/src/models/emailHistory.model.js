import mongoose from "mongoose";

const emailHistorySchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true
    },
    recipientEmail: {
      type: String,
      required: true,
      lowercase: true
    },
    recipientName: {
      type: String
    },
    subject: {
      type: String,
      required: true
    },
    emailType: {
      type: String,
      enum: [
        "invoice_created",
        "payment_received",
        "invoice_overdue",
        "invoice_shared",
        "invoice_reminder",
        "custom"
      ],
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "sent", "failed", "bounced"],
      default: "pending"
    },
    errorMessage: {
      type: String,
      default: null
    },
    sentAt: {
      type: Date,
      default: null
    },
    sharedMessage: {
      type: String,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    retryCount: {
      type: Number,
      default: 0,
      max: 3
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

// Index for querying overdue emails
emailHistorySchema.index({ business: 1, emailType: 1, status: 1 });
emailHistorySchema.index({ invoice: 1, emailType: 1 });
emailHistorySchema.index({ createdAt: 1 });

// TTL index to auto-delete old records after 90 days
emailHistorySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

const EmailHistory = mongoose.model("EmailHistory", emailHistorySchema);

export default EmailHistory;
