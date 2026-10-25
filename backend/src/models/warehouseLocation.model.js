import mongoose, { Schema } from "mongoose";

export const LOCATION_TYPES = Object.freeze({
  PICKING: "PICKING",
  BULK: "BULK",
  PACKING: "PACKING",
  RECEIVING: "RECEIVING",
  RETURN: "RETURN",
});

const warehouseLocationSchema = new Schema(
  {
    warehouse: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: [true, "Warehouse reference is required"],
      index: true,
    },
    aisle: {
      type: String,
      required: [true, "Aisle is required"],
      trim: true,
      uppercase: true,
    },
    rack: {
      type: String,
      required: [true, "Rack is required"],
      trim: true,
      uppercase: true,
    },
    bin: {
      type: String,
      required: [true, "Bin is required"],
      trim: true,
      uppercase: true,
    },
    zone: {
      type: String,
      trim: true,
      uppercase: true,
      default: "DEFAULT",
    },
    shelf: {
      type: String,
      trim: true,
      uppercase: true,
      default: "01",
    },
    code: {
      type: String,
      uppercase: true,
      trim: true,
    },
    barcode: {
      type: String,
      trim: true,
    },
    locationType: {
      type: String,
      enum: Object.values(LOCATION_TYPES),
      default: LOCATION_TYPES.PICKING,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Auto-populate location code before saving if not explicitly set
warehouseLocationSchema.pre("save", function (next) {
  if (!this.code) {
    this.code = `${this.aisle}-${this.rack}-${this.bin}`;
  }
  next();
});

// Composite index to guarantee unique bin addresses within a warehouse
warehouseLocationSchema.index({ warehouse: 1, aisle: 1, rack: 1, bin: 1 }, { unique: true });
warehouseLocationSchema.index({ warehouse: 1, code: 1 });

export const WarehouseLocation = mongoose.model("WarehouseLocation", warehouseLocationSchema);
