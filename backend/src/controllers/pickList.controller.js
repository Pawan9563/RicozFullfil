import mongoose from "mongoose";
import { PickList, PICKLIST_STATUS, PICK_ITEM_STATUS } from "../models/pickList.model.js";
import { Order } from "../models/order.model.js";
import { WarehouseLocation } from "../models/warehouseLocation.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { USER_ROLES } from "../models/user.model.js";
import { User } from "../models/user.model.js";
import { Inventory } from "../models/inventory.model.js";
import { ORDER_STATUS, canTransitionOrder } from "../utils/orderStateMachine.js";

/**
 * Generate a new pick list for an order
 * POST /pick-lists
 * Role-gate: Admin, Super Admin, Operations Manager, Warehouse Manager
 * Generates item lines from the order and associates available pick locations.
 */
export const createPickList = asyncHandler(async (req, res) => {
  const { orderId, orderIds, warehouseId, assignedPicker } = req.body;

  const targetOrderId = orderId || (Array.isArray(orderIds) && orderIds.length > 0 ? orderIds[0] : null);

  if (!targetOrderId) {
    throw new ApiError(400, "Order ID is required to generate a pick list");
  }

  if (!warehouseId) {
    throw new ApiError(400, "Warehouse ID is required");
  }

  if (!mongoose.Types.ObjectId.isValid(targetOrderId)) {
    throw new ApiError(400, "Invalid order ID format");
  }

  if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
    throw new ApiError(400, "Invalid warehouse ID format");
  }

  const order = await Order.findById(targetOrderId);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (req.user.role === USER_ROLES.WAREHOUSE_MANAGER && req.user.assignedWarehouse?.toString() !== warehouseId) {
    throw new ApiError(403, "Warehouse Managers may create lists only for their assigned warehouse");
  }
  if (order.warehouse && order.warehouse.toString() !== warehouseId) throw new ApiError(409, "Pick-list warehouse must match the order warehouse");
  if (order.status !== ORDER_STATUS.WAREHOUSE_ALLOCATION || order.pickList) throw new ApiError(409, "Order must be awaiting warehouse allocation and have no existing pick list");
  if (!canTransitionOrder(order.status, ORDER_STATUS.PICK_LIST_CREATED)) throw new ApiError(400, "Order cannot transition to PICK_LIST_CREATED");
  const pickerFilter = { role: USER_ROLES.PICKER, isActive: true, assignedWarehouse: warehouseId };
  const picker = assignedPicker
    ? await User.findOne({ _id: assignedPicker, ...pickerFilter }).select("role assignedWarehouse")
    : await User.findOne(pickerFilter).sort({ name: 1 }).select("role assignedWarehouse");
  if (!picker) throw new ApiError(400, "Select an active picker assigned to this warehouse");
  const pickerId = picker._id;

  const session = await mongoose.startSession();
  let pickList;
  try {
    await session.withTransaction(async () => {
      const currentOrder = await Order.findById(targetOrderId).session(session);
      if (!currentOrder || currentOrder.status !== ORDER_STATUS.WAREHOUSE_ALLOCATION || currentOrder.pickList) throw new ApiError(409, "Order is no longer available for pick-list generation");
      const items = await Promise.all(currentOrder.items.map(async (line) => {
        const inventory = await Inventory.findOne({ product: line.product, warehouse: warehouseId }).select("location").session(session);
        const location = inventory?.location || (await WarehouseLocation.findOne({ warehouse: warehouseId, locationType: "PICKING", isActive: true }).select("_id").session(session))?._id;
        return { product: line.product, sku: line.sku, quantity: line.quantity, location, pickedQuantity: 0, status: PICK_ITEM_STATUS.PENDING };
      }));
      const pickListNumber = `PKL-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      [pickList] = await PickList.create([{
        pickListNumber, order: currentOrder._id, warehouse: warehouseId, assignedPicker: pickerId,
        items, status: PICKLIST_STATUS.ASSIGNED,
      }], { session });
      currentOrder.status = ORDER_STATUS.PICK_LIST_CREATED;
      currentOrder.pickList = pickList._id;
      currentOrder.statusHistory.push({ status: ORDER_STATUS.PICK_LIST_CREATED, timestamp: new Date(), changedBy: req.user._id, note: `Pick list ${pickListNumber} generated` });
      await currentOrder.save({ session });
    });
  } finally { await session.endSession(); }
  return res.status(201).json(new ApiResponse(201, pickList, "Pick list created successfully"));
});

export const getEligibleOrders = asyncHandler(async (req, res) => {
  const filter = { status: ORDER_STATUS.WAREHOUSE_ALLOCATION };
  if (req.user.role === USER_ROLES.WAREHOUSE_MANAGER) {
    if (!req.user.assignedWarehouse) throw new ApiError(403, "Warehouse Manager has no assigned warehouse");
    filter.warehouse = req.user.assignedWarehouse;
  }
  const orders = await Order.find(filter)
    .populate("customer", "name")
    .populate("warehouse", "name code")
    .sort({ createdAt: 1 });
  return res.status(200).json(new ApiResponse(200, orders, "Orders awaiting pick-list creation retrieved"));
});

export const getEligiblePickers = asyncHandler(async (req, res) => {
  const { warehouseId } = req.query;
  if (!warehouseId || !mongoose.Types.ObjectId.isValid(warehouseId)) throw new ApiError(400, "Valid warehouseId is required");
  if (req.user.role === USER_ROLES.WAREHOUSE_MANAGER && req.user.assignedWarehouse?.toString() !== warehouseId) {
    throw new ApiError(403, "You may assign pickers only in your assigned warehouse");
  }
  const pickers = await User.find({ role: USER_ROLES.PICKER, isActive: true, assignedWarehouse: warehouseId })
    .select("name")
    .sort({ name: 1 })
    .lean();
  return res.status(200).json(new ApiResponse(200, pickers, "Eligible pickers retrieved"));
});

/**
 * Get all pick lists
 * Role-gate: Picker can ONLY see pick lists assigned to them (fully implemented).
 */
export const getAllPickLists = asyncHandler(async (req, res) => {
  const { warehouseId, status, pickerId } = req.query;

  const filter = {};

  // Non-negotiable role-gating: Picker can ONLY see pick lists assigned to them
  if (req.user.role === USER_ROLES.PICKER) {
    filter.assignedPicker = req.user._id;
  } else if (pickerId) {
    filter.assignedPicker = pickerId;
  }

  if (warehouseId) filter.warehouse = warehouseId;
  if (status) filter.status = status;

  const pickLists = await PickList.find(filter)
    .populate("warehouse", "name code location")
    .populate("assignedPicker", "name email role")
    .populate("order", "orderNumber status totalAmount")
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, pickLists, "Pick lists fetched successfully")
  );
});

/**
 * Get single pick list by ID
 * Role-gate: Picker can ONLY view pick list if assigned to them.
 */
export const getPickListById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid pick list ID format");
  }

  const pickList = await PickList.findById(id)
    .populate("warehouse", "name code location")
    .populate("assignedPicker", "name email phone")
    .populate("order", "orderNumber status deliveryAddress")
    .populate("items.product", "name sku barcode")
    .populate("items.location", "code zone aisle rack shelf bin");

  if (!pickList) {
    throw new ApiError(404, "Pick list not found");
  }

  // Non-negotiable role-gating: Picker can only access pick list if assigned to them
  if (req.user.role === USER_ROLES.PICKER) {
    const assignedPickerId = pickList.assignedPicker?._id
      ? pickList.assignedPicker._id.toString()
      : pickList.assignedPicker?.toString();

    if (!assignedPickerId || assignedPickerId !== req.user._id.toString()) {
      throw new ApiError(403, "Access denied: You can only view pick lists assigned to you");
    }
  }

  return res.status(200).json(
    new ApiResponse(200, pickList, "Pick list retrieved successfully")
  );
});

/**
 * Pick an individual item on a pick list
 * PATCH /pick-lists/:id/items/:itemId/pick
 * Role-gate: Picker (must be assigned), Warehouse Manager, Admin
 * Records item increments transactionally and syncs order lifecycle history.
 */
export const pickItem = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { quantity, quantityPicked } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid pick list ID format");
  }

  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    throw new ApiError(400, "Invalid pick item ID format");
  }

  const qtyToPick = Number(quantity ?? quantityPicked ?? 1);
  if (!Number.isInteger(qtyToPick) || qtyToPick <= 0) throw new ApiError(400, "Picked quantity must be a positive whole number");
  const session = await mongoose.startSession();
  let pickList;
  try {
    await session.withTransaction(async () => {
      pickList = await PickList.findById(id).session(session);
      if (!pickList) throw new ApiError(404, "Pick list not found");
      if (req.user.role === USER_ROLES.PICKER && pickList.assignedPicker?.toString() !== req.user._id.toString()) throw new ApiError(403, "You can pick only from lists assigned to you");
      if (req.user.role === USER_ROLES.WAREHOUSE_MANAGER && req.user.assignedWarehouse?.toString() !== pickList.warehouse.toString()) throw new ApiError(403, "You may pick only in your assigned warehouse");
      if ([PICKLIST_STATUS.PICKED, PICKLIST_STATUS.COMPLETED, PICKLIST_STATUS.CANCELLED].includes(pickList.status)) throw new ApiError(409, "Pick list is not active");
      const item = pickList.items.id(itemId);
      if (!item) throw new ApiError(404, "Item not found on this pick list");
      if (item.pickedQuantity + qtyToPick > item.quantity) throw new ApiError(409, `Cannot over-pick ${item.sku}; ${item.quantity - item.pickedQuantity} remain`);
      item.pickedQuantity += qtyToPick;
      item.status = item.pickedQuantity === item.quantity ? PICK_ITEM_STATUS.PICKED : PICK_ITEM_STATUS.PICKING;
      const complete = pickList.items.every((line) => line.pickedQuantity >= line.quantity);
      pickList.status = complete ? PICKLIST_STATUS.PICKED : PICKLIST_STATUS.PICKING;
      if (complete) pickList.completedAt = new Date();
      await pickList.save({ session });

      if (pickList.order) {
        const order = await Order.findById(pickList.order).session(session);
        if (order) {
          if (order.status === ORDER_STATUS.PICK_LIST_CREATED && canTransitionOrder(order.status, ORDER_STATUS.PICKING)) {
            order.status = ORDER_STATUS.PICKING;
            order.statusHistory.push({ status: ORDER_STATUS.PICKING, timestamp: new Date(), changedBy: req.user._id, note: `Picking started on ${pickList.pickListNumber}` });
          }
          if (complete && order.status === ORDER_STATUS.PICKING && canTransitionOrder(order.status, ORDER_STATUS.PICKED)) {
            order.status = ORDER_STATUS.PICKED;
            order.statusHistory.push({ status: ORDER_STATUS.PICKED, timestamp: new Date(), changedBy: req.user._id, note: `All items picked on ${pickList.pickListNumber}` });
          }
          await order.save({ session });
        }
      }
    });
  } finally { await session.endSession(); }
  return res.status(200).json(new ApiResponse(200, pickList, "Picked quantity recorded successfully"));
});

/**
 * Assign picker to a pick list
 */
export const assignPicker = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { pickerId } = req.body;

  if (!pickerId || !mongoose.Types.ObjectId.isValid(pickerId)) {
    throw new ApiError(400, "Valid picker ID is required");
  }

  const pickList = await PickList.findByIdAndUpdate(
    id,
    { assignedPicker: pickerId, status: PICKLIST_STATUS.ASSIGNED },
    { new: true }
  );

  if (!pickList) {
    throw new ApiError(404, "Pick list not found");
  }

  return res.status(200).json(
    new ApiResponse(200, pickList, "Picker assigned successfully")
  );
});
