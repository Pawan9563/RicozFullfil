import mongoose, { Schema } from "mongoose";

/**
 * Carrier Status Enum
 */
export const CARRIER_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
});

const contactInfoSchema = new Schema(
  {
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const carrierSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Carrier name is required"],
      trim: true,
      index: true,
    },
    code: {
      type: String,
      uppercase: true,
      trim: true,
      index: true,
    },
    contactInfo: {
      type: contactInfoSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: Object.values(CARRIER_STATUS),
      default: CARRIER_STATUS.ACTIVE,
      index: true,
    },
    serviceTypes: [
      {
        type: String,
        trim: true,
      },
    ],
    accountId: {
      type: String,
      trim: true,
    },
    trackingUrlTemplate: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.status !== undefined && ret.isActive === undefined) {
          ret.isActive = ret.status === CARRIER_STATUS.ACTIVE;
        }
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.status !== undefined && ret.isActive === undefined) {
          ret.isActive = ret.status === CARRIER_STATUS.ACTIVE;
        }
        return ret;
      },
    },
  }
);

// Virtual for backwards compatibility with existing UI / stubs
carrierSchema.virtual("isActive").get(function () {
  return this.status === CARRIER_STATUS.ACTIVE;
}).set(function (val) {
  this.status = val ? CARRIER_STATUS.ACTIVE : CARRIER_STATUS.INACTIVE;
});

export const Carrier = mongoose.model("Carrier", carrierSchema);
