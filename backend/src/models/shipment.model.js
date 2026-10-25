import mongoose, { Schema } from "mongoose";

/**
 * Shipment Lifecycle Status Enum
 */
export const SHIPMENT_STATUS = Object.freeze({
  CREATED: "CREATED",
  CARRIER_ASSIGNED: "CARRIER_ASSIGNED",
  DISPATCHED: "DISPATCHED",
  IN_TRANSIT: "IN_TRANSIT",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  FAILED_DELIVERY: "FAILED_DELIVERY",
  CANCELLED: "CANCELLED",
});

const addressSnapshotSchema = new Schema(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true, default: "India" },
  },
  { _id: false }
);

const shipmentSchema = new Schema(
  {
    shipmentNumber: {
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
    },
    package: {
      type: Schema.Types.ObjectId,
      ref: "Package",
      required: [true, "Package reference is required"],
      index: true,
    },
    carrier: {
      type: Schema.Types.ObjectId,
      ref: "Carrier",
      index: true,
    },
    trackingId: {
      type: String,
      trim: true,
      index: true,
      alias: "trackingNumber",
    },
    shippingMethod: {
      type: String,
      trim: true,
      default: "Standard Ground",
    },
    origin: {
      type: addressSnapshotSchema,
    },
    destination: {
      type: addressSnapshotSchema,
    },
    status: {
      type: String,
      enum: Object.values(SHIPMENT_STATUS),
      default: SHIPMENT_STATUS.CREATED,
      index: true,
    },
    expectedDeliveryDate: {
      type: Date,
      alias: "estimatedDeliveryDate",
    },
    dispatchedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    labelUrl: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.trackingId && !ret.trackingNumber) ret.trackingNumber = ret.trackingId;
        if (ret.expectedDeliveryDate && !ret.estimatedDeliveryDate) ret.estimatedDeliveryDate = ret.expectedDeliveryDate;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.trackingId && !ret.trackingNumber) ret.trackingNumber = ret.trackingId;
        if (ret.expectedDeliveryDate && !ret.estimatedDeliveryDate) ret.estimatedDeliveryDate = ret.expectedDeliveryDate;
        return ret;
      },
    },
  }
);

// Virtual aliases for backwards compatibility with existing UI / stubs
shipmentSchema.virtual("trackingNumber").get(function () {
  return this.trackingId;
}).set(function (val) {
  this.trackingId = val;
});

shipmentSchema.virtual("estimatedDeliveryDate").get(function () {
  return this.expectedDeliveryDate;
}).set(function (val) {
  this.expectedDeliveryDate = val;
});

export const Shipment = mongoose.model("Shipment", shipmentSchema);
