import mongoose from "mongoose";

const saleItemSchema = new mongoose.Schema(
  {
    // 🔥 SUPPORT PRODUCT OR SERVICE
    itemType: {
      type: String,
      enum: ["product", "service"],
      default: "product"
    },

    // 🔥 OPTIONAL PRODUCT LINK
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null
    },

    // 🔥 SERVICE NAME SNAPSHOT
    serviceName: {
      type: String,
      default: ""
    },

    // 🔥 ITEM NAME SNAPSHOT
    name: {
      type: String,
      required: true
    },

    quantity: {
      type: Number,
      required: true,
      min: 1
    },

    costPrice: {
      type: Number,
      default: 0
    },

    // 🔥 IMMUTABLE SALE PRICE
    sellingPrice: {
      type: Number,
      required: true,
      default: 0
    },

    // 🔥 ITEM TOTAL SNAPSHOT
    total: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    items: {
      type: [saleItemSchema],

      required: true,

      validate: [
        (val) => val.length > 0,
        "Sale must have at least one item"
      ]
    },

    totalAmount: {
      type: Number,
      required: true,
      default: 0
    },

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

    // 🔥 CUSTOMER SUPPORT
    customerName: {
      type: String,
      default: ""
    },

    customerPhone: {
      type: String,
      default: ""
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null
    },

    // 🔥 LINKED INVOICE
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null
    },

    notes: {
      type: String,
      default: ""
    },

    receiptId: {
      type: String,
      unique: true,
      index: true
    },

    clientOperationId: {
      type: String
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },

    deletedAt: {
      type: Date,
      default: null
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  { timestamps: true }
);


// 🔥 PROFIT CALCULATION
saleSchema.virtual("totalProfit").get(function () {

  if (!this.items || !Array.isArray(this.items)) {
    return 0;
  }

  return this.items.reduce((sum, item) => {

    const selling =
      item.sellingPrice || 0;

    const cost =
      item.costPrice || 0;

    const qty =
      item.quantity || 0;

    return (
      sum + (selling - cost) * qty
    );

  }, 0);
});


saleSchema.set("toJSON", {
  virtuals: true
});

saleSchema.set("toObject", {
  virtuals: true
});

saleSchema.index(
  { business: 1, clientOperationId: 1 },
  { unique: true, sparse: true }
);


export default mongoose.model(
  "Sale",
  saleSchema
);