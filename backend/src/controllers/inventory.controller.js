import mongoose from "mongoose";
import { Inventory } from "../models/inventory.model.js";
import { Warehouse } from "../models/warehouse.model.js";
import { Product } from "../models/product.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { USER_ROLES } from "../models/user.model.js";
import {
  reserveStock as reserveStockHelper,
  releaseStock as releaseStockHelper,
  adjustInventory,
  transferInventory,
} from "../utils/inventoryHelpers.js";

/**
 * Get inventory stock levels across warehouses
 * Fully implemented (Read operation)
 * Supports query filters: warehouse, lowStock, product, and pagination
 */
export const getInventoryLevels = asyncHandler(async (req, res) => {
  const { warehouse, warehouseId, lowStock, product, productId, page = 1, limit = 20 } = req.query;

  const filter = {};

  if (req.user.role === USER_ROLES.WAREHOUSE_MANAGER) {
    const assignedWarehouse = req.user.assignedWarehouse?.toString();
    if (!assignedWarehouse) throw new ApiError(403, "Warehouse Manager has no assigned warehouse");
    const requestedWarehouse = warehouse || warehouseId;
    if (requestedWarehouse && requestedWarehouse !== assignedWarehouse) throw new ApiError(403, "You may view inventory only in your assigned warehouse");
    filter.warehouse = assignedWarehouse;
  }

  // 1. Warehouse filter
  const targetWarehouse = warehouse || warehouseId;
  if (targetWarehouse) {
    if (mongoose.Types.ObjectId.isValid(targetWarehouse)) {
      filter.warehouse = targetWarehouse;
    }
  }

  // 2. Product filter
  const targetProduct = product || productId;
  if (targetProduct) {
    if (mongoose.Types.ObjectId.isValid(targetProduct)) {
      filter.product = targetProduct;
    }
  }

  // 3. Low stock threshold alert filter: available <= lowStockThreshold
  if (lowStock === "true" || lowStock === true) {
    filter.$expr = { $lte: ["$available", "$lowStockThreshold"] };
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 20);
  const skip = (pageNum - 1) * limitNum;

  const [inventory, totalCount] = await Promise.all([
    Inventory.find(filter)
      .populate("product", "name sku price category imageUrl status")
      .populate("warehouse", "name code location status")
      .populate("location", "code zone aisle rack shelf bin")
      .sort({ available: 1 })
      .skip(skip)
      .limit(limitNum),
    Inventory.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalCount / limitNum);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        inventory,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
        page: pageNum,
        limit: limitNum,
        totalCount,
      },
      "Inventory stock levels fetched successfully"
    )
  );
});

/**
 * Adjust stock quantities manually (PATCH /inventory/:id/adjust or POST /inventory/adjust)
 * Role-gate: Warehouse Manager can adjust inventory within their assigned warehouse; Admin / Super Admin globally.
 */
export const adjustStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    inventoryId,
    productId,
    warehouseId,
    adjustmentType,
    quantity,
    reason,
  } = req.body;

  const targetId = id || inventoryId;

  let inventoryRecord;

  if (targetId) {
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      throw new ApiError(400, "Invalid inventory record ID format");
    }
    inventoryRecord = await Inventory.findById(targetId).populate("warehouse", "name code");
  } else if (productId && warehouseId) {
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(warehouseId)) {
      throw new ApiError(400, "Invalid productId or warehouseId format");
    }
    inventoryRecord = await Inventory.findOne({
      product: productId,
      warehouse: warehouseId,
    }).populate("warehouse", "name code");
  } else {
    throw new ApiError(400, "Inventory ID (or productId + warehouseId) is required");
  }

  if (!inventoryRecord) {
    throw new ApiError(404, "Inventory record not found");
  }

  // Role-gate check: Warehouse Manager can ONLY adjust inventory in their own assigned warehouse
  if (req.user.role === USER_ROLES.WAREHOUSE_MANAGER) {
    const userWarehouseId = req.user.assignedWarehouse ? req.user.assignedWarehouse.toString() : null;
    const recordWarehouseId = inventoryRecord.warehouse?._id
      ? inventoryRecord.warehouse._id.toString()
      : inventoryRecord.warehouse.toString();

    if (!userWarehouseId || userWarehouseId !== recordWarehouseId) {
      throw new ApiError(
        403,
        "Forbidden: Warehouse Managers are only authorized to adjust inventory in their assigned warehouse"
      );
    }
  }

  // Request validation
  const validAdjustmentTypes = ["INCREASE", "DECREASE", "DAMAGE", "RESTOCK"];
  if (!adjustmentType || !validAdjustmentTypes.includes(adjustmentType.toUpperCase())) {
    throw new ApiError(
      400,
      `Invalid adjustmentType. Must be one of: ${validAdjustmentTypes.join(", ")}`
    );
  }

  const numQuantity = Number(quantity);
  if (!numQuantity || isNaN(numQuantity) || numQuantity <= 0) {
    throw new ApiError(400, "Quantity must be a positive number greater than zero");
  }

  if (!reason || !reason.trim()) {
    throw new ApiError(400, "Adjustment reason / audit note is required");
  }

  const updated = await adjustInventory({
    inventoryId: inventoryRecord._id,
    adjustmentType,
    quantity: numQuantity,
    reason: reason.trim(),
    changedBy: req.user._id,
  });

  return res.status(200).json(
    new ApiResponse(200, { inventory: updated, adjustmentType: adjustmentType.toUpperCase(), quantity: numQuantity, reason: reason.trim() }, "Stock adjusted successfully")
  );
});

/**
 * Reserve inventory for an order through the atomic inventory helper.
 */
export const reserveStock = asyncHandler(async (req, res) => {
  const { productId, warehouseId, quantity } = req.body;

  if (!productId || !warehouseId || !quantity || Number(quantity) <= 0) {
    throw new ApiError(400, "Valid productId, warehouseId, and positive quantity are required");
  }

  const inventory = await reserveStockHelper(productId, warehouseId, Number(quantity));

  return res.status(200).json(
    new ApiResponse(
      200,
      { inventory, productId, warehouseId, quantity: Number(quantity), status: "RESERVED" },
      "Stock reserved successfully"
    )
  );
});

/**
 * Release reserved inventory back to available stock through the atomic helper.
 */
export const releaseStock = asyncHandler(async (req, res) => {
  const { productId, warehouseId, quantity } = req.body;

  if (!productId || !warehouseId || !quantity || Number(quantity) <= 0) {
    throw new ApiError(400, "Valid productId, warehouseId, and positive quantity are required");
  }

  const inventory = await releaseStockHelper(productId, warehouseId, Number(quantity));

  return res.status(200).json(
    new ApiResponse(
      200,
      { inventory, productId, warehouseId, quantity: Number(quantity), status: "RELEASED" },
      "Stock released successfully"
    )
  );
});

/**
 * Transfer inventory from one warehouse/location to another
 */
export const transferStock = asyncHandler(async (req, res) => {
  const { productId, sourceWarehouseId, targetWarehouseId, quantity } = req.body;

  if (!productId || !sourceWarehouseId || !targetWarehouseId || !quantity || Number(quantity) <= 0) {
    throw new ApiError(400, "Source warehouse, target warehouse, product, and positive quantity are required");
  }

  const { sourceInventory, targetInventory } = await transferInventory({ productId, sourceWarehouseId, targetWarehouseId, quantity });

  return res.status(200).json(
    new ApiResponse(
      200,
      { sourceInventory, targetInventory, productId, sourceWarehouseId, targetWarehouseId, quantity: Number(quantity) },
      "Stock transferred successfully"
    )
  );
});
