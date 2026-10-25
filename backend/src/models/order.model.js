import mongoose, { Schema } from "mongoose";
import { ORDER_STATUS } from "../utils/orderStateMachine.js";

/**
 * Payment Status Enum
 */
export const PAYMENT_STATUS = Object.freeze({
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
});

/**
 * Embedded subdocument schema for order items
 * Rule: Orders embed items / orderItems (non-negotiable architectural rule).
 */
const orderItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    sku: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    isReserved: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

/**
 * Embedded subdocument schema for order status audit trail
 * Rule: Maintain statusHistory array on orders.
 */
const statusHistorySchema = new Schema(
  {
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    note: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

/**
 * Embedded subdocument schema for delivery address
 */
const deliveryAddressSchema = new Schema(
  {
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: "India" },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    warehouse: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      index: true,
      alias: "assignedWarehouse",
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [
        (items) => items && items.length > 0,
        "Order must contain at least one item",
      ],
      alias: "orderItems",
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.ORDER_CREATED,
      index: true,
    },
    deliveryAddress: {
      type: deliveryAddressSchema,
      required: true,
      alias: "shippingAddress",
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: () => [
        {
          status: ORDER_STATUS.ORDER_CREATED,
          timestamp: new Date(),
          note: "Order created initially",
        },
      ],
    },
    pickList: {
      type: Schema.Types.ObjectId,
      ref: "PickList",
    },
    package: {
      type: Schema.Types.ObjectId,
      ref: "Package",
    },
    shipment: {
      type: Schema.Types.ObjectId,
      ref: "Shipment",
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.items && !ret.orderItems) ret.orderItems = ret.items;
        if (ret.deliveryAddress && !ret.shippingAddress) ret.shippingAddress = ret.deliveryAddress;
        if (ret.warehouse && !ret.assignedWarehouse) ret.assignedWarehouse = ret.warehouse;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.items && !ret.orderItems) ret.orderItems = ret.items;
        if (ret.deliveryAddress && !ret.shippingAddress) ret.shippingAddress = ret.deliveryAddress;
        if (ret.warehouse && !ret.assignedWarehouse) ret.assignedWarehouse = ret.warehouse;
        return ret;
      },
    },
  }
);

// Virtual getters/setters for compatibility across components and services
orderSchema.virtual("orderItems").get(function () {
  return this.items;
}).set(function (val) {
  this.items = val;
});

orderSchema.virtual("shippingAddress").get(function () {
  return this.deliveryAddress;
}).set(function (val) {
  this.deliveryAddress = val;
});

orderSchema.virtual("assignedWarehouse").get(function () {
  return this.warehouse;
}).set(function (val) {
  this.warehouse = val;
});

export const Order = mongoose.model("Order", orderSchema);
