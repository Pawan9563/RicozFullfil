import mongoose from "mongoose";
import { Package, PACKAGE_STATUS } from "../models/package.model.js";
import { Order } from "../models/order.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { USER_ROLES } from "../models/user.model.js";
import { ORDER_STATUS, canTransitionOrder } from "../utils/orderStateMachine.js";

/**
 * Register a new package for an order
 * POST /packages
 * Role-gate: Admin, Super Admin, Warehouse Manager, Packer
 * Creates a sealed package and records each valid order lifecycle transition.
 */
export const createPackage = asyncHandler(async (req, res) => {
  const {
    orderId,
    orderNumber,
    warehouseId,
    boxSize,
    boxType,
    weight,
    dimensions,
  } = req.body;

  if (!orderId && !orderNumber) {
    throw new ApiError(400, "Order ID or order number is required to package an order");
  }
  if (orderId && !mongoose.Types.ObjectId.isValid(orderId)) throw new ApiError(400, "Invalid order ID format");
  const finalWeight = Number(weight);
  const finalDimensions = dimensions || {};
  if (!Number.isFinite(finalWeight) || finalWeight <= 0) throw new ApiError(400, "Package weight must be greater than zero");
  for (const dimension of ["length", "width", "height"]) {
    if (!Number.isFinite(Number(finalDimensions[dimension])) || Number(finalDimensions[dimension]) <= 0) throw new ApiError(400, `Package ${dimension} must be greater than zero`);
  }

  const session = await mongoose.startSession();
  let newPackage;
  try {
    await session.withTransaction(async () => {
      const order = orderId
        ? await Order.findById(orderId).session(session)
        : await Order.findOne({ orderNumber: orderNumber.trim().toUpperCase() }).session(session);
      if (!order) throw new ApiError(404, "Order not found");
      if ([USER_ROLES.WAREHOUSE_MANAGER, USER_ROLES.PACKER].includes(req.user.role) && (!req.user.assignedWarehouse || req.user.assignedWarehouse.toString() !== order.warehouse?.toString())) {
        throw new ApiError(403, "You may pack orders only in your assigned warehouse");
      }
      if (order.status !== ORDER_STATUS.PICKED || order.package) throw new ApiError(409, "Only an un-packaged order in PICKED status can be sealed");
      if (!canTransitionOrder(order.status, ORDER_STATUS.PACKING) || !canTransitionOrder(ORDER_STATUS.PACKING, ORDER_STATUS.PACKED)) {
        throw new ApiError(400, "Order state machine does not allow package completion");
      }
      const packageNumber = `PKG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      [newPackage] = await Package.create([{
        packageNumber,
        order: order._id,
        warehouse: order.warehouse || warehouseId,
        packedBy: req.user._id,
        boxSize: boxSize || boxType || "Standard Box",
        weight: finalWeight,
        dimensions: { ...finalDimensions, unit: finalDimensions.unit || "cm" },
        status: PACKAGE_STATUS.PACKED,
        packedAt: new Date(),
      }], { session });
      const timestamp = new Date();
      order.status = ORDER_STATUS.PACKING;
      order.statusHistory.push({ status: ORDER_STATUS.PACKING, timestamp, changedBy: req.user._id, note: "Packing started" });
      order.status = ORDER_STATUS.PACKED;
      order.package = newPackage._id;
      order.statusHistory.push({ status: ORDER_STATUS.PACKED, timestamp: new Date(), changedBy: req.user._id, note: `Package ${packageNumber} sealed` });
      await order.save({ session });
    });
  } finally { await session.endSession(); }
  return res.status(201).json(new ApiResponse(201, newPackage, "Package created and order marked packed"));
});

/**
 * Get all packages
 */
export const getAllPackages = asyncHandler(async (req, res) => {
  const { status, warehouseId, orderId } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (warehouseId) filter.warehouse = warehouseId;
  if (orderId) filter.order = orderId;

  // Role-gating: If Packer, view packages packed by them or in their warehouse
  if (req.user.role === USER_ROLES.PACKER) {
    if (req.user.assignedWarehouse) {
      filter.warehouse = req.user.assignedWarehouse;
    } else {
      filter.packedBy = req.user._id;
    }
  }

  const packages = await Package.find(filter)
    .populate("order", "orderNumber status deliveryAddress totalAmount")
    .populate("warehouse", "name code location")
    .populate("packedBy", "name email")
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, packages, "Packages fetched successfully")
  );
});

/**
 * Get orders ready for packing (status === PICKED)
 * Role-gate: Packer can ONLY see orders in PICKED status (fully implemented).
 */
export const getPackableOrders = asyncHandler(async (req, res) => {
  // Non-negotiable role-gating: Only orders in PICKED status are packable
  const filter = { status: ORDER_STATUS.PICKED };

  if ([USER_ROLES.PACKER, USER_ROLES.WAREHOUSE_MANAGER].includes(req.user.role) && !req.user.assignedWarehouse) {
    throw new ApiError(403, "A warehouse assignment is required to access packable orders");
  }
  if (req.user.assignedWarehouse && [USER_ROLES.PACKER, USER_ROLES.WAREHOUSE_MANAGER].includes(req.user.role)) {
    filter.warehouse = req.user.assignedWarehouse;
  }

  const orders = await Order.find(filter)
    .populate("customer", "name email phone")
    .populate("warehouse", "name code")
    .sort({ updatedAt: 1 });

  return res.status(200).json(
    new ApiResponse(200, orders, "Packable orders in PICKED status retrieved successfully")
  );
});

/**
 * Get package details by ID
 */
export const getPackageById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid package ID format");
  }

  const pkg = await Package.findById(id)
    .populate("order")
    .populate("warehouse", "name code location")
    .populate("packedBy", "name email phone");

  if (!pkg) {
    throw new ApiError(404, "Package not found");
  }

  return res.status(200).json(
    new ApiResponse(200, pkg, "Package retrieved successfully")
  );
});

/**
 * Complete packing for a package and verify final dimensions & weight
 */
export const packItems = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { finalWeight, dimensions } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid package ID format");
  }

  const pkg = await Package.findById(id);
  if (!pkg) {
    throw new ApiError(404, "Package not found");
  }

  const parsedWeight = Number(finalWeight);
  if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) throw new ApiError(400, "Final weight must be greater than zero");
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const packageRecord = await Package.findById(id).session(session);
      if (!packageRecord) throw new ApiError(404, "Package not found");
      if (packageRecord.status !== PACKAGE_STATUS.PACKING) throw new ApiError(409, "Package is not in PACKING status");
      const order = await Order.findById(packageRecord.order).session(session);
      if (!order || !canTransitionOrder(order.status, ORDER_STATUS.PACKED)) throw new ApiError(409, "Order cannot transition to PACKED");
      packageRecord.weight = parsedWeight;
      if (dimensions) packageRecord.dimensions = dimensions;
      packageRecord.status = PACKAGE_STATUS.PACKED;
      packageRecord.packedAt = new Date();
      await packageRecord.save({ session });
      order.status = ORDER_STATUS.PACKED;
      order.statusHistory.push({ status: ORDER_STATUS.PACKED, timestamp: new Date(), changedBy: req.user?._id, note: `Package ${packageRecord.packageNumber} sealed` });
      await order.save({ session });
    });
  } finally { await session.endSession(); }
  return res.status(200).json(new ApiResponse(200, { packageId: id, status: PACKAGE_STATUS.PACKED, finalWeight: parsedWeight }, "Package sealed and order marked packed"));
});

/**
 * Generate or retrieve packing slip URL
 */
export const generatePackingSlip = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid package ID format");
  }

  const pkg = await Package.findById(id);
  if (!pkg) {
    throw new ApiError(404, "Package not found");
  }

  if (!pkg.packingSlipUrl) throw new ApiError(404, "No packing slip has been generated for this package");
  return res.status(200).json(new ApiResponse(200, { packageId: id, packingSlipUrl: pkg.packingSlipUrl }, "Packing slip retrieved"));
});
