import mongoose, { Schema } from "mongoose";

export const ONBOARDING_STATUS = {
  PENDING_REVIEW: "PENDING_REVIEW",
  CONTACTED: "CONTACTED",
  KYC_VERIFIED: "KYC_VERIFIED",
  APPROVED: "APPROVED",
  ONBOARDED: "ONBOARDED",
  REJECTED: "REJECTED",
};

const onboardingSchema = new Schema(
  {
    referenceNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    companyWebsite: {
      type: String,
      trim: true,
      default: "",
    },
    contactName: {
      type: String,
      required: true,
      trim: true,
    },
    contactEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    contactPhone: {
      type: String,
      required: true,
      trim: true,
    },
    industry: {
      type: String,
      default: "E-Commerce / D2C",
    },
    monthlyOrderVolume: {
      type: String,
      required: true,
      default: "500 - 2,000 orders/mo",
    },
    skuCount: {
      type: String,
      default: "50 - 200 SKUs",
    },
    currentFulfillment: {
      type: String,
      default: "In-house / Self-fulfilled",
    },
    preferredWarehouses: [
      {
        type: String,
      },
    ],
    salesChannels: [
      {
        type: String,
      },
    ],
    valueAddedServices: [
      {
        type: String,
      },
    ],
    notes: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: Object.values(ONBOARDING_STATUS),
      default: ONBOARDING_STATUS.PENDING_REVIEW,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

export const Onboarding = mongoose.model("Onboarding", onboardingSchema);
