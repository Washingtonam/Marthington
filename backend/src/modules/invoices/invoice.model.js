import mongoose from "mongoose";

const invoiceItemSchema =
  new mongoose.Schema({

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null
    },

    name: {
      type: String,
      required: true
    },

    quantity: {
      type: Number,
      default: 1
    },

    price: {
      type: Number,
      default: 0
    },

    total: {
      type: Number,
      default: 0
    },

    returned: {
      type: Boolean,
      default: false
    },

    returnQuantity: {
      type: Number,
      default: 0
    },

    returnAmount: {
      type: Number,
      default: 0
    },

    receivedQuantity: {
      type: Number,
      default: 0
    },

    soldQuantity: {
      type: Number,
      default: 0
    },

    supplierCreditStatus: {
      type: String,
      enum: ["Unpaid", "Partially Paid", "Fully Paid", "Returned", null],
      default: null
    },

    supplierBatchLabel: {
      type: String,
      default: ""
    }

  }, { _id: false });

const invoiceSchema =
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

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    transactionType: {
      type: String,
      enum: ["outgoing", "incoming"],
      default: "outgoing"
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null
    },

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      default: null
    },

    customerName: {
      type: String,
      default: ""
    },

    customerPhone: {
      type: String,
      default: ""
    },

    customerEmail: {
      type: String,
      default: ""
    },

    items: [invoiceItemSchema],

    subtotal: {
      type: Number,
      default: 0
    },

    tax: {
      type: Number,
      default: 0
    },

    discount: {
      type: Number,
      default: 0
    },

    totalAmount: {
      type: Number,
      default: 0
    },

    amountPaid: {
      type: Number,
      default: 0
    },

    balance: {
      type: Number,
      default: 0
    },

    balanceDue: {
      type: Number,
      default: 0
    },

    returnedAmount: {
      type: Number,
      default: 0
    },

    paymentStatus: {
      type: String,
      enum: ["Unpaid", "Partially Paid", "Fully Paid", "Returned"],
      default: "Unpaid"
    },

    status: {
      type: String,

      enum: [
        "draft",
        "sent",
        "partial",
        "paid",
        "overdue"
      ],

      default: "draft"
    },

    invoiceType: {
      type: String,

      enum: [
        "invoice",
        "quotation",
        "proforma"
      ],

      default: "invoice"
    },

    dueDate: {
      type: Date,
      default: null
    },

    notes: {
      type: String,
      default: ""
    },

    invoiceNumber: {
      type: String,
      unique: true
    }

  }, {
    timestamps: true
  });

export default mongoose.model(
  "Invoice",
  invoiceSchema
);