import mongoose, { Schema } from "mongoose";

/**
 * Product Lifecycle / Operational Status
 */
export const PRODUCT_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  ARCHIVED: "ARCHIVED",
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

const productSchema = new Schema(
  {
    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      index: true,
      default: "General",
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
      alias: "unitPrice",
    },
    weight: {
      type: Number,
      default: 0,
      min: [0, "Weight cannot be negative"],
    },
    dimensions: {
      type: dimensionsSchema,
      default: () => ({ length: 0, width: 0, height: 0, unit: "cm" }),
    },
    imageUrl: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: Object.values(PRODUCT_STATUS),
      default: PRODUCT_STATUS.ACTIVE,
      index: true,
    },
    barcode: {
      type: String,
      trim: true,
      index: true,
    },
    costPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    images: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.price !== undefined && ret.unitPrice === undefined) ret.unitPrice = ret.price;
        if (ret.status !== undefined && ret.isActive === undefined) ret.isActive = ret.status === PRODUCT_STATUS.ACTIVE;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.price !== undefined && ret.unitPrice === undefined) ret.unitPrice = ret.price;
        if (ret.status !== undefined && ret.isActive === undefined) ret.isActive = ret.status === PRODUCT_STATUS.ACTIVE;
        return ret;
      },
    },
  }
);

// Virtuals for backwards compatibility across existing controllers & frontend
productSchema.virtual("isActive").get(function () {
  return this.status === PRODUCT_STATUS.ACTIVE;
}).set(function (val) {
  this.status = val ? PRODUCT_STATUS.ACTIVE : PRODUCT_STATUS.INACTIVE;
});

productSchema.virtual("unitPrice").get(function () {
  return this.price;
}).set(function (val) {
  this.price = val;
});

export const Product = mongoose.model("Product", productSchema);
