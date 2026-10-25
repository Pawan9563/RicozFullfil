import mongoose from "mongoose";
import { Warehouse, WAREHOUSE_STATUS } from "../models/warehouse.model.js";
import { WarehouseLocation } from "../models/warehouseLocation.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Register a new warehouse facility
 * Role-gate: Admin / Super Admin only
 */
export const createWarehouse = asyncHandler(async (req, res) => {
  const { name, code, location, address, manager, capacity, totalCapacity, status } = req.body;

  // Basic validation
  if (!name || !name.trim()) {
    throw new ApiError(400, "Warehouse name is required");
  }

  if (!code || !code.trim()) {
    throw new ApiError(400, "Warehouse code is required");
  }

  if (!address || !address.street || !address.city || !address.state || !address.postalCode) {
    throw new ApiError(400, "Full address with street, city, state, and postalCode is required");
  }

  // Check unique code
  const formattedCode = code.trim().toUpperCase();
  const existingWarehouse = await Warehouse.findOne({ code: formattedCode });
  if (existingWarehouse) {
    throw new ApiError(409, `Warehouse with code '${formattedCode}' already exists`);
  }

  // Verify manager exists if provided
  if (manager) {
    if (!mongoose.Types.ObjectId.isValid(manager)) {
      throw new ApiError(400, "Invalid manager user ID format");
    }
    const managerUser = await User.findById(manager);
    if (!managerUser) {
      throw new ApiError(404, "Designated manager user not found");
    }
  }

  const warehouse = await Warehouse.create({
    name: name.trim(),
    code: formattedCode,
    location: (location || `${address.city}, ${address.state}`).trim(),
    address: {
      street: address.street.trim(),
      city: address.city.trim(),
      state: address.state.trim(),
      postalCode: address.postalCode.trim(),
      country: (address.country || "India").trim(),
    },
    manager: manager || undefined,
    capacity: capacity !== undefined ? Math.max(0, Number(capacity)) : (totalCapacity !== undefined ? Math.max(0, Number(totalCapacity)) : 10000),
    status: status || WAREHOUSE_STATUS.ACTIVE,
  });

  return res.status(201).json(
    new ApiResponse(201, warehouse, "Warehouse facility created successfully")
  );
});

/**
 * Get all warehouses
 */
export const getAllWarehouses = asyncHandler(async (req, res) => {
  const { status, search } = req.query;

  const filter = {};
  if (status) {
    filter.status = status;
  }

  if (search && search.trim()) {
    const query = search.trim();
    filter.$or = [
      { name: { $regex: query, $options: "i" } },
      { code: { $regex: query, $options: "i" } },
      { "address.city": { $regex: query, $options: "i" } },
      { location: { $regex: query, $options: "i" } },
    ];
  }

  const warehouses = await Warehouse.find(filter)
    .populate("manager", "name email phone role")
    .sort({ name: 1 });

  return res.status(200).json(
    new ApiResponse(200, warehouses, "Warehouses retrieved successfully")
  );
});

/**
 * Get single warehouse by ID
 */
export const getWarehouseById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid warehouse ID format");
  }

  const warehouse = await Warehouse.findById(id).populate("manager", "name email phone role");
  if (!warehouse) {
    throw new ApiError(404, "Warehouse not found");
  }

  return res.status(200).json(
    new ApiResponse(200, warehouse, "Warehouse retrieved successfully")
  );
});

/**
 * Update warehouse details
 * Role-gate: Admin / Super Admin only
 */
export const updateWarehouse = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid warehouse ID format");
  }

  const warehouse = await Warehouse.findById(id);
  if (!warehouse) {
    throw new ApiError(404, "Warehouse not found");
  }

  const { name, code, location, address, manager, capacity, totalCapacity, status } = req.body;

  // Code update uniqueness check
  if (code && code.trim().toUpperCase() !== warehouse.code) {
    const formattedCode = code.trim().toUpperCase();
    const existing = await Warehouse.findOne({ code: formattedCode });
    if (existing && existing._id.toString() !== id) {
      throw new ApiError(409, `Warehouse with code '${formattedCode}' already exists`);
    }
    warehouse.code = formattedCode;
  }

  // Manager update verification
  if (manager !== undefined) {
    if (manager) {
      if (!mongoose.Types.ObjectId.isValid(manager)) {
        throw new ApiError(400, "Invalid manager user ID format");
      }
      const managerUser = await User.findById(manager);
      if (!managerUser) {
        throw new ApiError(404, "Designated manager user not found");
      }
      warehouse.manager = manager;
    } else {
      warehouse.manager = undefined;
    }
  }

  if (name !== undefined) warehouse.name = name.trim();
  if (location !== undefined) warehouse.location = location.trim();
  if (address) {
    warehouse.address = {
      ...warehouse.address.toObject(),
      ...address,
    };
  }

  const targetCapacity = capacity !== undefined ? capacity : totalCapacity;
  if (targetCapacity !== undefined) {
    warehouse.capacity = Math.max(0, Number(targetCapacity));
  }

  if (status !== undefined) warehouse.status = status;

  await warehouse.save();

  return res.status(200).json(
    new ApiResponse(200, warehouse, "Warehouse updated successfully")
  );
});

/**
 * Deactivate or delete warehouse
 * Role-gate: Admin / Super Admin only
 */
export const deleteWarehouse = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid warehouse ID format");
  }

  const warehouse = await Warehouse.findById(id);
  if (!warehouse) {
    throw new ApiError(404, "Warehouse not found");
  }

  warehouse.status = WAREHOUSE_STATUS.INACTIVE;
  await warehouse.save();

  return res.status(200).json(
    new ApiResponse(200, { _id: id, status: warehouse.status }, "Warehouse deactivated successfully")
  );
});

/**
 * Create a bin/shelf/aisle location within a warehouse
 */
export const createWarehouseLocation = asyncHandler(async (req, res) => {
  const { warehouseId } = req.params;
  const { aisle, rack, bin, zone, shelf, code, barcode, locationType } = req.body;

  if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
    throw new ApiError(400, "Invalid warehouse ID format");
  }

  const warehouseExists = await Warehouse.findById(warehouseId);
  if (!warehouseExists) {
    throw new ApiError(404, "Warehouse not found");
  }
  if (req.user.role === "WAREHOUSE_MANAGER" && req.user.assignedWarehouse?.toString() !== warehouseId) {
    throw new ApiError(403, "You may create locations only in your assigned warehouse");
  }

  if (!aisle || !rack || !bin) {
    throw new ApiError(400, "Aisle, rack, and bin are required to define a warehouse location");
  }

  const formattedAisle = aisle.trim().toUpperCase();
  const formattedRack = rack.trim().toUpperCase();
  const formattedBin = bin.trim().toUpperCase();
  const locationCode = (code || `${formattedAisle}-${formattedRack}-${formattedBin}`).trim().toUpperCase();

  const existingLocation = await WarehouseLocation.findOne({
    warehouse: warehouseId,
    $or: [{ code: locationCode }, { aisle: formattedAisle, rack: formattedRack, bin: formattedBin }],
  });

  if (existingLocation) {
    throw new ApiError(409, `Location '${locationCode}' already exists in this warehouse`);
  }

  const location = await WarehouseLocation.create({
    warehouse: warehouseId,
    aisle: formattedAisle,
    rack: formattedRack,
    bin: formattedBin,
    zone: (zone || "DEFAULT").trim().toUpperCase(),
    shelf: (shelf || "01").trim().toUpperCase(),
    code: locationCode,
    barcode: barcode || locationCode,
    locationType: locationType || "PICKING",
  });

  return res.status(201).json(
    new ApiResponse(201, location, "Warehouse location created successfully")
  );
});

/**
 * Get all locations for a specific warehouse
 */
export const getWarehouseLocations = asyncHandler(async (req, res) => {
  const { warehouseId } = req.params;
  const { locationType } = req.query;

  if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
    throw new ApiError(400, "Invalid warehouse ID format");
  }

  const filter = { warehouse: warehouseId, isActive: true };
  if (locationType) {
    filter.locationType = locationType;
  }

  const locations = await WarehouseLocation.find(filter).sort({ aisle: 1, rack: 1, bin: 1 });

  return res.status(200).json(
    new ApiResponse(200, locations, "Warehouse locations fetched successfully")
  );
});
