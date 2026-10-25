import mongoose, { Schema } from "mongoose";

/**
 * Warehouse Operational Status
 */
export const WAREHOUSE_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  UNDER_MAINTENANCE: "UNDER_MAINTENANCE",
});

const warehouseAddressSchema = new Schema(
  {
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: "India" },
  },
  { _id: false }
);

const warehouseSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Warehouse name is required"],
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: [true, "Warehouse code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    location: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: warehouseAddressSchema,
      required: true,
    },
    manager: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    capacity: {
      type: Number,
      default: 10000,
      min: [0, "Capacity cannot be negative"],
      alias: "totalCapacity",
    },
    status: {
      type: String,
      enum: Object.values(WAREHOUSE_STATUS),
      default: WAREHOUSE_STATUS.ACTIVE,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.capacity !== undefined && ret.totalCapacity === undefined) ret.totalCapacity = ret.capacity;
        if (ret.status !== undefined && ret.isActive === undefined) ret.isActive = ret.status === WAREHOUSE_STATUS.ACTIVE;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.capacity !== undefined && ret.totalCapacity === undefined) ret.totalCapacity = ret.capacity;
        if (ret.status !== undefined && ret.isActive === undefined) ret.isActive = ret.status === WAREHOUSE_STATUS.ACTIVE;
        return ret;
      },
    },
  }
);

// Virtuals for backwards compatibility across existing controllers & frontend
warehouseSchema.virtual("isActive").get(function () {
  return this.status === WAREHOUSE_STATUS.ACTIVE;
}).set(function (val) {
  this.status = val ? WAREHOUSE_STATUS.ACTIVE : WAREHOUSE_STATUS.INACTIVE;
});

warehouseSchema.virtual("totalCapacity").get(function () {
  return this.capacity;
}).set(function (val) {
  this.capacity = val;
});

export const Warehouse = mongoose.model("Warehouse", warehouseSchema);
