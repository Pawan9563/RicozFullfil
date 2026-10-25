import mongoose, { Schema } from "mongoose";

/**
 * Package Status Enum
 */
export const PACKAGE_STATUS = Object.freeze({
  PACKING: "PACKING",
  PACKED: "PACKED",
  SHIPPED: "SHIPPED",
});

const dimensionsSchema = new Schema(
  {
    length: { type: Number, default: 0, min: 0 },
    width: { type: Number, default: 0, min: 0 },
    height: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: "cm", trim: true },
  },
  { _id: false }
);

const packageSchema = new Schema(
  {
    packageNumber: {
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
    warehouse: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      index: true,
    },
    packedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    boxSize: {
      type: String,
      default: "Standard Box",
      trim: true,
      alias: "boxType",
    },
    dimensions: {
      type: dimensionsSchema,
      default: () => ({ length: 0, width: 0, height: 0, unit: "cm" }),
    },
    weight: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Weight cannot be negative"],
    },
    status: {
      type: String,
      enum: Object.values(PACKAGE_STATUS),
      default: PACKAGE_STATUS.PACKING,
      index: true,
    },
    packingSlipUrl: {
      type: String,
      trim: true,
    },
    packedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.boxSize && !ret.boxType) ret.boxType = ret.boxSize;
        if (ret.order && !ret.orderId) ret.orderId = ret.order;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.boxSize && !ret.boxType) ret.boxType = ret.boxSize;
        if (ret.order && !ret.orderId) ret.orderId = ret.order;
        return ret;
      },
    },
  }
);

packageSchema.virtual("boxType").get(function () {
  return this.boxSize;
}).set(function (val) {
  this.boxSize = val;
});

packageSchema.virtual("orderId").get(function () {
  return this.order;
}).set(function (val) {
  this.order = val;
});

export const Package = mongoose.model("Package", packageSchema);
