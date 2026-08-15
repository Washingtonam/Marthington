import mongoose from "mongoose";

const inventorySchema =
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

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },

    type: {
      type: String,

      enum: [
        "sale",
        "purchase",
        "adjustment",
        "return",
        "transfer"
      ],

      required: true
    },

    quantity: {
      type: Number,
      required: true
    },

    unitCost: {
      type: Number,
      default: 0
    },

    previousStock: Number,

    newStock: Number,

    note: {
      type: String,
      default: ""
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }

  }, {
    timestamps: true
  });

export default mongoose.model(
  "InventoryMovement",
  inventorySchema
);