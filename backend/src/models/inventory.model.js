import mongoose, { Schema } from "mongoose";

const inventoryAdjustmentSchema = new Schema({
  adjustmentType: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  reason: { type: String, required: true, trim: true },
  changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  timestamp: { type: Date, required: true, default: Date.now },
}, { _id: true });

const inventorySchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"],
      index: true,
    },
    warehouse: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: [true, "Warehouse reference is required"],
      index: true,
    },
    available: {
      type: Number,
      required: true,
      min: [0, "Available inventory cannot be negative"],
      default: 0,
      index: true,
    },
    reserved: {
      type: Number,
      required: true,
      min: [0, "Reserved inventory cannot be negative"],
      default: 0,
      index: true,
    },
    damaged: {
      type: Number,
      required: true,
      min: [0, "Damaged inventory cannot be negative"],
      default: 0,
    },
    returned: {
      type: Number,
      required: true,
      min: [0, "Returned inventory cannot be negative"],
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      required: true,
      default: 10,
      min: [0, "Low stock threshold cannot be negative"],
      alias: "reorderLevel",
    },
    location: {
      type: Schema.Types.ObjectId,
      ref: "WarehouseLocation",
      index: true,
    },
    maxCapacity: {
      type: Number,
      default: 1000,
    },
    adjustments: {
      type: [inventoryAdjustmentSchema],
      default: () => [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.lowStockThreshold !== undefined && ret.reorderLevel === undefined) {
          ret.reorderLevel = ret.lowStockThreshold;
        }
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.lowStockThreshold !== undefined && ret.reorderLevel === undefined) {
          ret.reorderLevel = ret.lowStockThreshold;
        }
        return ret;
      },
    },
  }
);

inventorySchema.virtual("reorderLevel").get(function () {
  return this.lowStockThreshold;
}).set(function (val) {
  this.lowStockThreshold = val;
});

// Non-negotiable requirement: Unique compound index on (product, warehouse)
inventorySchema.index({ product: 1, warehouse: 1 }, { unique: true });

export const Inventory = mongoose.model("Inventory", inventorySchema);
