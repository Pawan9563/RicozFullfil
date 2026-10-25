import mongoose from "mongoose";
import {
  Return,
  RETURN_STATUS,
  ITEM_CONDITION,
  ITEM_DISPOSITION,
} from "../models/return.model.js";
import { Order, PAYMENT_STATUS } from "../models/order.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ORDER_STATUS, canTransitionOrder } from "../utils/orderStateMachine.js";
import { restockInventory, markDamaged } from "../utils/inventoryHelpers.js";

/**
 * Initiate a return request for a delivered order
 * POST /returns
 * Creates a return only for a delivered order and records the order transition.
 */
export const initiateReturn = asyncHandler(async (req, res) => {
  const { orderId, returnItems, items, reason, notes } = req.body;

  const rawItems = returnItems || items;

  if (!orderId) {
    throw new ApiError(400, "Order ID is required to initiate a return");
  }

  if (!reason || !reason.trim()) {
    throw new ApiError(400, "A valid return reason is required");
  }

  if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, "At least one item must be specified for return");
  }

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid order ID format");
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (order.status !== ORDER_STATUS.DELIVERED || !canTransitionOrder(order.status, ORDER_STATUS.RETURN_REQUESTED)) throw new ApiError(409, "Only delivered orders can be returned");
  const formattedItems = rawItems.map((item) => {
    const productId = item.productId || item.product;
    const orderedItem = order.items.find((line) => line.product.toString() === productId?.toString());
    const quantity = Number(item.quantity);
    if (!orderedItem || !Number.isInteger(quantity) || quantity < 1 || quantity > orderedItem.quantity) throw new ApiError(400, "Return item must match an order product and have a valid quantity");
    return { product: productId, sku: (item.sku || orderedItem.sku).toUpperCase(), quantity, condition: item.condition || ITEM_CONDITION.UNOPENED, disposition: ITEM_DISPOSITION.PENDING_INSPECTION, reason: item.reason || reason.trim() };
  });
  const session = await mongoose.startSession();
  let returnDoc;
  try {
    await session.withTransaction(async () => {
      const currentOrder = await Order.findById(order._id).session(session);
      if (!currentOrder || currentOrder.status !== ORDER_STATUS.DELIVERED) throw new ApiError(409, "Order is no longer eligible for a return");
      const returnNumber = `RET-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      [returnDoc] = await Return.create([{
        returnNumber, order: currentOrder._id, customer: currentOrder.customer, warehouse: currentOrder.warehouse,
        reason: reason.trim(), returnItems: formattedItems, status: RETURN_STATUS.REQUESTED, notes: notes?.trim(),
      }], { session });
      currentOrder.status = ORDER_STATUS.RETURN_REQUESTED;
      currentOrder.statusHistory.push({ status: ORDER_STATUS.RETURN_REQUESTED, timestamp: new Date(), changedBy: req.user?._id, note: `Return requested: ${reason.trim()}` });
      await currentOrder.save({ session });
    });
  } finally { await session.endSession(); }
  return res.status(201).json(new ApiResponse(201, returnDoc, "Return request initiated"));
});

/**
 * Approve or reject return request
 * PATCH /returns/:id/approve
 * Role-gate: Operations Manager, Admin, Super Admin (Fully implemented)
 * Validates and synchronizes the return and linked order state.
 */
export const approveReturn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approved, rejectionReason, note } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid return ID format");
  }

  const returnDoc = await Return.findById(id).populate("order");
  if (!returnDoc) {
    throw new ApiError(404, "Return record not found");
  }

  const isApproved = approved !== false;
  if (returnDoc.status !== RETURN_STATUS.REQUESTED) throw new ApiError(409, "Only requested returns can be approved or rejected");
  const nextOrderStatus = isApproved ? ORDER_STATUS.RETURN_APPROVED : ORDER_STATUS.DELIVERED;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const currentReturn = await Return.findById(id).session(session);
      const order = await Order.findById(currentReturn?.order).session(session);
      if (!currentReturn || !order || currentReturn.status !== RETURN_STATUS.REQUESTED) throw new ApiError(409, "Return is no longer awaiting review");
      if (!canTransitionOrder(order.status, nextOrderStatus)) throw new ApiError(400, `Illegal transition from '${order.status}' to '${nextOrderStatus}'`);
      currentReturn.status = isApproved ? RETURN_STATUS.APPROVED : RETURN_STATUS.REJECTED;
      if (!isApproved) currentReturn.notes = rejectionReason || note || "Return rejected";
      await currentReturn.save({ session });
      order.status = nextOrderStatus;
      order.statusHistory.push({ status: nextOrderStatus, timestamp: new Date(), changedBy: req.user?._id, note: isApproved ? "Return approved" : `Return rejected: ${rejectionReason || note || "No reason provided"}` });
      await order.save({ session });
    });
  } finally { await session.endSession(); }
  return res.status(200).json(new ApiResponse(200, { returnId: id, status: isApproved ? RETURN_STATUS.APPROVED : RETURN_STATUS.REJECTED }, "Return review saved"));
});

/**
 * Schedule return pickup or mark return in transit
 * PATCH /returns/:id/pickup
 * Advances return pickup through scheduled and in-transit states.
 */
export const scheduleOrUpdatePickup = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { inTransit, trackingNumber, pickupDate } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid return ID format");
  }

  const targetReturnStatus = inTransit ? RETURN_STATUS.RETURN_IN_TRANSIT : RETURN_STATUS.PICKUP_SCHEDULED;
  const targetOrderStatus = inTransit ? ORDER_STATUS.RETURN_IN_TRANSIT : ORDER_STATUS.PICKUP_SCHEDULED;
  const expectedReturnStatus = inTransit ? RETURN_STATUS.PICKUP_SCHEDULED : RETURN_STATUS.APPROVED;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const returnDoc = await Return.findById(id).session(session);
      if (!returnDoc) throw new ApiError(404, "Return record not found");
      if (returnDoc.status !== expectedReturnStatus) throw new ApiError(409, `Return must be ${expectedReturnStatus} before this action`);
      const order = await Order.findById(returnDoc.order).session(session);
      if (!order || !canTransitionOrder(order.status, targetOrderStatus)) throw new ApiError(400, `Order cannot transition to '${targetOrderStatus}'`);
      returnDoc.status = targetReturnStatus;
      if (trackingNumber) returnDoc.trackingNumber = trackingNumber.trim();
      if (pickupDate) returnDoc.pickupDate = new Date(pickupDate);
      await returnDoc.save({ session });
      order.status = targetOrderStatus;
      order.statusHistory.push({ status: targetOrderStatus, timestamp: new Date(), changedBy: req.user?._id, note: inTransit ? `Return in transit${trackingNumber ? ` (${trackingNumber})` : ""}` : "Return pickup scheduled" });
      await order.save({ session });
    });
  } finally { await session.endSession(); }
  return res.status(200).json(new ApiResponse(200, { returnId: id, status: targetReturnStatus }, "Return pickup updated"));
});

/**
 * Confirm dock receipt of returned merchandise
 * PATCH /returns/:id/receive
 * Records the dock receipt and synchronizes order history.
 */
export const receiveReturn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { receivingWarehouseId, notes } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid return ID format");
  }

  if (receivingWarehouseId && !mongoose.Types.ObjectId.isValid(receivingWarehouseId)) throw new ApiError(400, "Invalid receiving warehouse ID");
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const returnDoc = await Return.findById(id).session(session);
      if (!returnDoc) throw new ApiError(404, "Return record not found");
      if (returnDoc.status !== RETURN_STATUS.RETURN_IN_TRANSIT) throw new ApiError(409, "Only in-transit returns can be received");
      const targetWarehouse = receivingWarehouseId || returnDoc.warehouse;
      if (!targetWarehouse) throw new ApiError(400, "Receiving warehouse is required");
      if (req.user.role === "WAREHOUSE_MANAGER" && req.user.assignedWarehouse?.toString() !== targetWarehouse.toString()) throw new ApiError(403, "You may receive returns only at your assigned warehouse");
      const order = await Order.findById(returnDoc.order).session(session);
      if (!order || !canTransitionOrder(order.status, ORDER_STATUS.RETURN_RECEIVED)) throw new ApiError(400, "Order cannot transition to RETURN_RECEIVED");
      returnDoc.status = RETURN_STATUS.RECEIVED;
      returnDoc.warehouse = targetWarehouse;
      if (notes) returnDoc.notes = notes.trim();
      await returnDoc.save({ session });
      order.status = ORDER_STATUS.RETURN_RECEIVED;
      order.statusHistory.push({ status: ORDER_STATUS.RETURN_RECEIVED, timestamp: new Date(), changedBy: req.user?._id, note: "Returned goods received at warehouse" });
      await order.save({ session });
    });
  } finally { await session.endSession(); }
  return res.status(200).json(new ApiResponse(200, { returnId: id, status: RETURN_STATUS.RECEIVED }, "Return received successfully"));
});

/**
 * Inspect returned items and execute inventory disposition updates
 * PATCH /returns/:id/inspect
 * Role-gate: Warehouse Manager, Admin, Super Admin (Fully implemented)
 * Applies every item disposition through atomic inventory helpers in the same transaction.
 */
export const inspectReturn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { itemDispositions, warehouseId, notes } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid return ID format");
  }

  if (!itemDispositions || !Array.isArray(itemDispositions) || itemDispositions.length === 0) {
    throw new ApiError(400, "Item dispositions array is required for technical inspection");
  }

  if (warehouseId && !mongoose.Types.ObjectId.isValid(warehouseId)) throw new ApiError(400, "Invalid warehouse ID");
  const session = await mongoose.startSession();
  let inspectedCount = 0;
  try {
    await session.withTransaction(async () => {
      const returnDoc = await Return.findById(id).session(session);
      if (!returnDoc) throw new ApiError(404, "Return record not found");
      if (returnDoc.status !== RETURN_STATUS.RECEIVED) throw new ApiError(409, "Only received returns can be inspected");
      const targetWarehouse = warehouseId || returnDoc.warehouse;
      if (!targetWarehouse) throw new ApiError(400, "Warehouse is required to inspect returned goods");
      if (req.user.role === "WAREHOUSE_MANAGER" && req.user.assignedWarehouse?.toString() !== targetWarehouse.toString()) throw new ApiError(403, "You may inspect returns only at your assigned warehouse");
      const order = await Order.findById(returnDoc.order).session(session);
      if (!order || !canTransitionOrder(order.status, ORDER_STATUS.RETURN_INSPECTED)) throw new ApiError(400, "Order cannot transition to RETURN_INSPECTED");
      const seen = new Set();
      for (const disposition of itemDispositions) {
        if (!disposition.itemId || seen.has(disposition.itemId)) throw new ApiError(400, "Each return item must have exactly one inspection disposition");
        seen.add(disposition.itemId);
        const item = returnDoc.returnItems.id(disposition.itemId);
        if (!item) throw new ApiError(400, "Inspection references an item not in this return");
        if (!Object.values(ITEM_CONDITION).includes(disposition.condition || item.condition)) throw new ApiError(400, "Invalid item condition");
        if (!Object.values(ITEM_DISPOSITION).includes(disposition.disposition) || disposition.disposition === ITEM_DISPOSITION.PENDING_INSPECTION) throw new ApiError(400, "Invalid final item disposition");
        item.condition = disposition.condition || item.condition;
        item.disposition = disposition.disposition;
        if (disposition.disposition === ITEM_DISPOSITION.RESTOCK) {
          await restockInventory({ productId: item.product, warehouseId: targetWarehouse, quantity: item.quantity, session });
        } else {
          await markDamaged({ productId: item.product, warehouseId: targetWarehouse, quantity: item.quantity, session });
        }
        inspectedCount += 1;
      }
      if (seen.size !== returnDoc.returnItems.length) throw new ApiError(400, "Every returned item must be inspected");
      returnDoc.status = RETURN_STATUS.INSPECTED;
      returnDoc.warehouse = targetWarehouse;
      returnDoc.inspectedBy = req.user?._id;
      returnDoc.inspectedAt = new Date();
      if (notes) returnDoc.notes = notes.trim();
      await returnDoc.save({ session });
      order.status = ORDER_STATUS.RETURN_INSPECTED;
      order.statusHistory.push({ status: ORDER_STATUS.RETURN_INSPECTED, timestamp: new Date(), changedBy: req.user?._id, note: "Return merchandise inspection completed" });
      await order.save({ session });
    });
  } finally { await session.endSession(); }
  return res.status(200).json(new ApiResponse(200, { returnId: id, status: RETURN_STATUS.INSPECTED, itemsInspected: inspectedCount }, "Return inspection completed"));
});

/**
 * Resolve return with refund or replacement order
 * PATCH /returns/:id/resolve
 * Role-gate: Operations Manager, Admin, Super Admin (Fully implemented)
 * Finalizes refund or replacement after successful inspection.
 */
export const resolveReturn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { resolutionType, action, refundAmount, replacementOrderId, notes } = req.body;

  const targetAction = (resolutionType || action || "").toUpperCase();

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid return ID format");
  }

  if (!["REFUND", "REPLACE", "REPLACEMENT"].includes(targetAction)) {
    throw new ApiError(400, "Resolution action must be 'REFUND' or 'REPLACE'");
  }

  if (targetAction !== "REFUND" && !mongoose.Types.ObjectId.isValid(replacementOrderId)) throw new ApiError(400, "A valid replacementOrderId is required for replacement");
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const returnDoc = await Return.findById(id).session(session);
      if (!returnDoc) throw new ApiError(404, "Return record not found");
      if (returnDoc.status !== RETURN_STATUS.INSPECTED) throw new ApiError(409, "Only inspected returns can be resolved");
      const order = await Order.findById(returnDoc.order).session(session);
      const isRefund = targetAction === "REFUND";
      const targetReturnStatus = isRefund ? RETURN_STATUS.REFUNDED : RETURN_STATUS.REPLACED;
      const targetOrderStatus = isRefund ? ORDER_STATUS.RETURN_REFUNDED : ORDER_STATUS.RETURN_REPLACED;
      if (!order || !canTransitionOrder(order.status, targetOrderStatus)) throw new ApiError(400, `Order cannot transition to '${targetOrderStatus}'`);
      if (isRefund) {
        const amount = refundAmount === undefined ? order.totalAmount : Number(refundAmount);
        if (!Number.isFinite(amount) || amount < 0 || amount > order.totalAmount) throw new ApiError(400, "Refund amount must be between zero and the order total");
        returnDoc.refundAmount = amount;
        order.paymentStatus = PAYMENT_STATUS.REFUNDED;
      } else {
        const replacement = await Order.findById(replacementOrderId).session(session);
        if (!replacement) throw new ApiError(404, "Replacement order not found");
        returnDoc.replacementOrderId = replacement._id;
      }
      returnDoc.status = targetReturnStatus;
      if (notes) returnDoc.notes = notes.trim();
      await returnDoc.save({ session });
      order.status = targetOrderStatus;
      order.statusHistory.push({ status: targetOrderStatus, timestamp: new Date(), changedBy: req.user?._id, note: isRefund ? `Refund finalized: ${returnDoc.refundAmount}` : `Replacement order linked: ${replacementOrderId}` });
      await order.save({ session });
      result = { returnId: id, status: targetReturnStatus, resolutionType: targetAction, refundAmount: returnDoc.refundAmount };
    });
  } finally { await session.endSession(); }
  return res.status(200).json(new ApiResponse(200, result, "Return resolved successfully"));
});

/**
 * Get all return requests with status filtering & pagination
 */
export const getAllReturns = asyncHandler(async (req, res) => {
  const { status, orderId, page = 1, limit = 10 } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (orderId) filter.order = orderId;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNum - 1) * limitNum;

  const [returns, totalCount] = await Promise.all([
    Return.find(filter)
      .populate("order", "orderNumber totalAmount paymentStatus status")
      .populate("customer", "name email phone")
      .populate("returnItems.product", "name sku unitPrice")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Return.countDocuments(filter),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        returns,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum),
        },
        page: pageNum,
        limit: limitNum,
        totalCount,
      },
      "Return records fetched successfully"
    )
  );
});

/**
 * Get single return record with embedded items and inspection details
 */
export const getReturnById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid return ID format");
  }

  const returnDoc = await Return.findById(id)
    .populate("order")
    .populate("customer")
    .populate("warehouse", "name code location")
    .populate("returnItems.product", "name sku barcode category unitPrice")
    .populate("inspectedBy", "name email role");

  if (!returnDoc) {
    throw new ApiError(404, "Return record not found");
  }

  return res.status(200).json(
    new ApiResponse(200, returnDoc, "Return record retrieved successfully")
  );
});
