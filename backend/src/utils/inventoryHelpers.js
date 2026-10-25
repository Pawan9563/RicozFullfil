import mongoose from "mongoose";
import { Inventory } from "../models/inventory.model.js";
import { ApiError } from "./ApiError.js";

/**
 * Normalizes parameters to support both positional: (productId, warehouseId, qty)
 * and object: ({ productId, warehouseId, qty/quantity })
 */
const parseArgs = (arg1, arg2, arg3) => {
  if (typeof arg1 === "object" && arg1 !== null) {
    return {
      productId: arg1.productId,
      warehouseId: arg1.warehouseId,
      qty: arg1.qty !== undefined ? arg1.qty : arg1.quantity,
      fromReserved: arg1.fromReserved || false,
      session: arg1.session,
    };
  }
  return {
    productId: arg1,
    warehouseId: arg2,
    qty: arg3,
    fromReserved: false,
    session: undefined,
  };
};

const validateInventoryArguments = ({ productId, warehouseId, qty }, action) => {
  const quantity = Number(qty);
  if (!productId || !warehouseId || !Number.isFinite(quantity) || quantity <= 0) {
    throw new ApiError(400, `Valid productId, warehouseId, and positive quantity are required to ${action}`);
  }
  return quantity;
};

/**
 * 1. reserveStock(productId, warehouseId, qty)
 * Reserves inventory for an order item atomically.
 * Rule: Always use findOneAndUpdate with $inc and guard conditions to prevent race conditions.
 */
export const reserveStock = async (productIdOrObj, warehouseIdArg, qtyArg) => {
  const args = parseArgs(productIdOrObj, warehouseIdArg, qtyArg);
  const quantity = validateInventoryArguments(args, "reserve stock");
  const updated = await Inventory.findOneAndUpdate(
    { product: args.productId, warehouse: args.warehouseId, available: { $gte: quantity } },
    { $inc: { available: -quantity, reserved: quantity } },
    { new: true, session: args.session }
  );
  if (!updated) throw new ApiError(409, `Insufficient available inventory to reserve ${quantity} units of product '${args.productId}'`);
  return updated;
};

/**
 * 2. releaseStock(productId, warehouseId, qty)
 * Releases previously reserved inventory back to available stock.
 */
export const releaseStock = async (productIdOrObj, warehouseIdArg, qtyArg) => {
  const args = parseArgs(productIdOrObj, warehouseIdArg, qtyArg);
  const quantity = validateInventoryArguments(args, "release stock");
  const updated = await Inventory.findOneAndUpdate(
    { product: args.productId, warehouse: args.warehouseId, reserved: { $gte: quantity } },
    { $inc: { reserved: -quantity, available: quantity } },
    { new: true, session: args.session }
  );
  if (!updated) throw new ApiError(409, `Insufficient reserved stock to release ${quantity} units of product '${args.productId}'`);
  return updated;
};

/**
 * 3. restockInventory(productId, warehouseId, qty)
 * Restocks inventory or adds new stock to a warehouse.
 */
export const restockInventory = async (productIdOrObj, warehouseIdArg, qtyArg) => {
  const args = parseArgs(productIdOrObj, warehouseIdArg, qtyArg);
  const quantity = validateInventoryArguments(args, "restock inventory");
  try {
    return await Inventory.findOneAndUpdate(
      { product: args.productId, warehouse: args.warehouseId },
      { $inc: { available: quantity, returned: quantity }, $setOnInsert: { product: args.productId, warehouse: args.warehouseId } },
      { new: true, upsert: true, setDefaultsOnInsert: true, session: args.session }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    return Inventory.findOneAndUpdate(
      { product: args.productId, warehouse: args.warehouseId },
      { $inc: { available: quantity, returned: quantity } },
      { new: true, session: args.session }
    );
  }
};

/**
 * 4. markDamaged(productId, warehouseId, qty, fromReserved = false)
 * Records damaged items by deducting from available (or reserved) stock.
 */
export const markDamaged = async (productIdOrObj, warehouseIdArg, qtyArg, fromReservedArg = false) => {
  const parsed = parseArgs(productIdOrObj, warehouseIdArg, qtyArg);
  const productId = parsed.productId;
  const warehouseId = parsed.warehouseId;
  const qty = parsed.qty;
  const fromReserved = parsed.fromReserved || fromReservedArg;
  const quantity = validateInventoryArguments({ productId, warehouseId, qty }, "mark items as damaged");
  const sourceField = fromReserved ? "reserved" : "available";
  const updated = await Inventory.findOneAndUpdate(
    { product: productId, warehouse: warehouseId, [sourceField]: { $gte: quantity } },
    { $inc: { [sourceField]: -quantity, damaged: quantity } },
    { new: true, session: parsed.session }
  );
  if (!updated) throw new ApiError(409, `Insufficient stock to mark ${quantity} units as damaged for product '${productId}'`);
  return updated;
};

export const adjustInventory = async ({ inventoryId, adjustmentType, quantity, reason, changedBy, session }) => {
  const amount = Number(quantity);
  if (!inventoryId || !Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "Inventory ID and positive quantity are required");
  }
  const type = String(adjustmentType || "").toUpperCase();
  const filters = { _id: inventoryId };
  let increments;
  if (type === "INCREASE" || type === "RESTOCK") increments = { available: amount };
  else if (type === "DECREASE") {
    filters.available = { $gte: amount };
    increments = { available: -amount };
  } else if (type === "DAMAGE") {
    filters.available = { $gte: amount };
    increments = { available: -amount, damaged: amount };
  } else throw new ApiError(400, "Adjustment type must be INCREASE, DECREASE, DAMAGE, or RESTOCK");

  const updated = await Inventory.findOneAndUpdate(filters, {
    $inc: increments,
    $push: { adjustments: { adjustmentType: type, quantity: amount, reason, changedBy, timestamp: new Date() } },
  }, { new: true, session });
  if (!updated) throw new ApiError(409, `Insufficient available stock for ${type} adjustment of ${amount}`);
  return updated;
};

export const transferInventory = async ({ productId, sourceWarehouseId, targetWarehouseId, quantity }) => {
  const amount = Number(quantity);
  if (!productId || !sourceWarehouseId || !targetWarehouseId || sourceWarehouseId.toString() === targetWarehouseId.toString() || !Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "Valid product, distinct source and target warehouses, and positive quantity are required");
  }
  const session = await mongoose.startSession();
  let sourceInventory;
  let targetInventory;
  try {
    await session.withTransaction(async () => {
      sourceInventory = await Inventory.findOneAndUpdate(
        { product: productId, warehouse: sourceWarehouseId, available: { $gte: amount } },
        { $inc: { available: -amount } },
        { new: true, session }
      );
      if (!sourceInventory) throw new ApiError(409, "Insufficient available stock at the source warehouse");
      targetInventory = await Inventory.findOneAndUpdate(
        { product: productId, warehouse: targetWarehouseId },
        { $inc: { available: amount }, $setOnInsert: { product: productId, warehouse: targetWarehouseId } },
        { new: true, upsert: true, setDefaultsOnInsert: true, session }
      );
    });
  } finally { await session.endSession(); }
  return { sourceInventory, targetInventory };
};

// Aliases for compatibility across other existing modules and controllers
export const reserveInventory = reserveStock;
export const releaseReservedInventory = releaseStock;
export const recordDamagedInventory = markDamaged;
export const commitReservedInventory = async (productIdOrObj, warehouseIdArg, qtyArg) => {
  const args = parseArgs(productIdOrObj, warehouseIdArg, qtyArg);
  const quantity = validateInventoryArguments(args, "commit reserved stock");
  const updated = await Inventory.findOneAndUpdate(
    { product: args.productId, warehouse: args.warehouseId, reserved: { $gte: quantity } },
    { $inc: { reserved: -quantity } },
    { new: true, session: args.session }
  );
  if (!updated) throw new ApiError(409, `Insufficient reserved stock to commit ${quantity} units of product '${args.productId}'`);
  return updated;
};
