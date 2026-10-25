import mongoose, { Schema } from "mongoose";

/**
 * Pick List Status Enum
 */
export const PICKLIST_STATUS = Object.freeze({
  ASSIGNED: "ASSIGNED",
  PICKING: "PICKING",
  PICKED: "PICKED",
  // Backwards compatibility / lifecycle extensions
  DRAFT: "DRAFT",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
});

/**
 * Individual Pick Item Status Enum
 */
export const PICK_ITEM_STATUS = Object.freeze({
  PENDING: "PENDING",
  PICKING: "PICKING",
  PICKED: "PICKED",
  SKIPPED: "SKIPPED",
});

/**
 * Embedded subdocument schema for pick list items
 * Embedded items array with product ref, quantity, location, pickedQuantity
 */
const pickListItemSchema = new Schema(
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
      required: [true, "Required quantity is required"],
      min: [1, "Quantity must be at least 1"],
      alias: "quantityRequired",
    },
    location: {
      type: Schema.Types.ObjectId,
      ref: "WarehouseLocation",
      alias: "warehouseLocationId",
    },
    pickedQuantity: {
      type: Number,
      default: 0,
      min: [0, "Picked quantity cannot be negative"],
      alias: "quantityPicked",
    },
    status: {
      type: String,
      enum: Object.values(PICK_ITEM_STATUS),
      default: PICK_ITEM_STATUS.PENDING,
    },
  },
  {
    _id: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual aliases for compatibility
pickListItemSchema.virtual("productId").get(function () {
  return this.product;
}).set(function (val) {
  this.product = val;
});

pickListItemSchema.virtual("warehouseLocationId").get(function () {
  return this.location;
}).set(function (val) {
  this.location = val;
});

pickListItemSchema.virtual("quantityRequired").get(function () {
  return this.quantity;
}).set(function (val) {
  this.quantity = val;
});

pickListItemSchema.virtual("quantityPicked").get(function () {
  return this.pickedQuantity;
}).set(function (val) {
  this.pickedQuantity = val;
});

const pickListSchema = new Schema(
  {
    pickListNumber: {
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
      index: true,
      alias: "orderId",
    },
    warehouse: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: [true, "Warehouse reference is required"],
      index: true,
    },
    assignedPicker: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    items: {
      type: [pickListItemSchema],
      required: true,
      validate: [
        (items) => items && items.length > 0,
        "Pick list must contain at least one item",
      ],
      alias: "pickListItems",
    },
    status: {
      type: String,
      enum: Object.values(PICKLIST_STATUS),
      default: PICKLIST_STATUS.ASSIGNED,
      index: true,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.items && !ret.pickListItems) ret.pickListItems = ret.items;
        if (ret.order && !ret.orderId) ret.orderId = ret.order;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.items && !ret.pickListItems) ret.pickListItems = ret.items;
        if (ret.order && !ret.orderId) ret.orderId = ret.order;
        return ret;
      },
    },
  }
);

pickListSchema.virtual("pickListItems").get(function () {
  return this.items;
}).set(function (val) {
  this.items = val;
});

pickListSchema.virtual("orderId").get(function () {
  return this.order;
}).set(function (val) {
  this.order = val;
});

export const PickList = mongoose.model("PickList", pickListSchema);
