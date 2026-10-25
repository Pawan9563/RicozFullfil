import mongoose, { Schema } from "mongoose";

/**
 * Return Lifecycle Status Enum
 */
export const RETURN_STATUS = Object.freeze({
  REQUESTED: "REQUESTED",
  APPROVED: "APPROVED",
  PICKUP_SCHEDULED: "PICKUP_SCHEDULED",
  RETURN_IN_TRANSIT: "RETURN_IN_TRANSIT",
  RECEIVED: "RECEIVED",
  INSPECTED: "INSPECTED",
  REFUNDED: "REFUNDED",
  REPLACED: "REPLACED",
  REJECTED: "REJECTED",
  // Aliases matching orderStateMachine
  RETURN_REQUESTED: "RETURN_REQUESTED",
  RETURN_APPROVED: "RETURN_APPROVED",
  RETURN_RECEIVED: "RETURN_RECEIVED",
  RETURN_INSPECTED: "RETURN_INSPECTED",
  RETURN_REFUNDED: "RETURN_REFUNDED",
  RETURN_REPLACED: "RETURN_REPLACED",
});

/**
 * Return Item Condition Enum
 */
export const ITEM_CONDITION = Object.freeze({
  UNOPENED: "UNOPENED",
  OPENED: "OPENED",
  DAMAGED: "DAMAGED",
  DEFECTIVE: "DEFECTIVE",
});

/**
 * Return Item Disposition Enum
 */
export const ITEM_DISPOSITION = Object.freeze({
  PENDING_INSPECTION: "PENDING_INSPECTION",
  RESTOCK: "RESTOCK",
  REPAIR: "REPAIR",
  REJECT: "REJECT",
  SCRAP: "SCRAP",
  DAMAGED: "DAMAGED",
});

/**
 * Embedded subdocument schema for return items
 * Rule: Returns embed returnItems (non-negotiable).
 */
const returnItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"],
      alias: "productId",
    },
    sku: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Return item quantity must be at least 1"],
    },
    condition: {
      type: String,
      enum: Object.values(ITEM_CONDITION),
      default: ITEM_CONDITION.UNOPENED,
    },
    disposition: {
      type: String,
      enum: Object.values(ITEM_DISPOSITION),
      default: ITEM_DISPOSITION.PENDING_INSPECTION,
    },
    reason: {
      type: String,
      trim: true,
    },
  },
  {
    _id: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

returnItemSchema.virtual("productId").get(function () {
  return this.product;
}).set(function (val) {
  this.product = val;
});

const returnSchema = new Schema(
  {
    returnNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order reference is required"],
      index: true,
      alias: "orderId",
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    warehouse: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      index: true,
    },
    reason: {
      type: String,
      required: [true, "Return reason is required"],
      trim: true,
    },
    returnItems: {
      type: [returnItemSchema],
      required: true,
      validate: [
        (items) => items && items.length > 0,
        "Return must contain at least one item",
      ],
      alias: "items",
    },
    status: {
      type: String,
      enum: Object.values(RETURN_STATUS),
      default: RETURN_STATUS.REQUESTED,
      index: true,
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: [0, "Refund amount cannot be negative"],
    },
    replacementOrderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
    inspectedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    inspectedAt: {
      type: Date,
    },
    trackingNumber: {
      type: String,
      trim: true,
    },
    pickupDate: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.returnItems && !ret.items) ret.items = ret.returnItems;
        if (ret.order && !ret.orderId) ret.orderId = ret.order;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.returnItems && !ret.items) ret.items = ret.returnItems;
        if (ret.order && !ret.orderId) ret.orderId = ret.order;
        return ret;
      },
    },
  }
);

returnSchema.virtual("items").get(function () {
  return this.returnItems;
}).set(function (val) {
  this.returnItems = val;
});

returnSchema.virtual("orderId").get(function () {
  return this.order;
}).set(function (val) {
  this.order = val;
});

export const Return = mongoose.model("Return", returnSchema);
