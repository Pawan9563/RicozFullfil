import mongoose, { Schema } from "mongoose";

/**
 * TrackingEvent Model - Audit Trail for Shipments
 * Rule: Maintain a trackingEvents collection for shipments.
 * Fully implemented.
 */
const trackingEventSchema = new Schema(
  {
    shipment: {
      type: Schema.Types.ObjectId,
      ref: "Shipment",
      required: [true, "Shipment reference is required"],
      index: true,
    },
    eventType: {
      type: String,
      required: [true, "Event type is required"],
      trim: true,
      index: true,
      alias: "eventStatus",
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
      alias: "eventTimestamp",
    },
    location: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    rawCarrierPayload: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.eventType && !ret.eventStatus) ret.eventStatus = ret.eventType;
        if (ret.timestamp && !ret.eventTimestamp) ret.eventTimestamp = ret.timestamp;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.eventType && !ret.eventStatus) ret.eventStatus = ret.eventType;
        if (ret.timestamp && !ret.eventTimestamp) ret.eventTimestamp = ret.timestamp;
        return ret;
      },
    },
  }
);

// Virtual aliases for backwards compatibility with existing UI / stubs
trackingEventSchema.virtual("eventStatus").get(function () {
  return this.eventType;
}).set(function (val) {
  this.eventType = val;
});

trackingEventSchema.virtual("eventTimestamp").get(function () {
  return this.timestamp;
}).set(function (val) {
  this.timestamp = val;
});

export const TrackingEvent = mongoose.model("TrackingEvent", trackingEventSchema);
