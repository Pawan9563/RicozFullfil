import mongoose, { Schema } from "mongoose";

export const NOTIFICATION_TYPES = Object.freeze({
  ORDER_STATUS: "ORDER_STATUS",
  INVENTORY_ALERT: "INVENTORY_ALERT",
  PICK_ASSIGNMENT: "PICK_ASSIGNMENT",
  SHIPMENT_UPDATE: "SHIPMENT_UPDATE",
  SYSTEM: "SYSTEM",
});

const notificationSchema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      default: NOTIFICATION_TYPES.SYSTEM,
      index: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    linkUrl: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

export const Notification = mongoose.model("Notification", notificationSchema);
