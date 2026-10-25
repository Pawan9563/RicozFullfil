import mongoose from "mongoose";
import { Order, PAYMENT_STATUS } from "../models/order.model.js";
import { Customer } from "../models/customer.model.js";
import { Warehouse } from "../models/warehouse.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ORDER_STATUS, canTransitionOrder, canRoleTransitionOrder, getAllowedTransitions } from "../utils/orderStateMachine.js";
import { reserveInventory, releaseReservedInventory } from "../utils/inventoryHelpers.js";
import { USER_ROLES } from "../models/user.model.js";
import { PickList, PICKLIST_STATUS } from "../models/pickList.model.js";
import { Package, PACKAGE_STATUS } from "../models/package.model.js";

/**
 * Create a new customer order
 * Rule: Orders embed items / orderItems and initialize statusHistory.
 * Inventory reservations and order creation commit or roll back together.
 */
export const createOrder = asyncHandler(async (req, res) => {
  const {
    customerId,
    customer: customerInputId,
    items,
    orderItems,
    deliveryAddress,
    shippingAddress,
    warehouseId,
    warehouse: warehouseInputId,
    paymentStatus,
    notes,
  } = req.body;

  // Resolve field aliases for flexibility
  const targetCustomerId = customerId || customerInputId;
  const rawItems = items || orderItems;
  const targetAddress = deliveryAddress || shippingAddress;
  const targetWarehouseId = warehouseId || warehouseInputId;

  // 1. Validate Customer
  if (!targetCustomerId) {
    throw new ApiError(400, "Customer ID is required");
  }

  if (!mongoose.Types.ObjectId.isValid(targetCustomerId)) {
    throw new ApiError(400, "Invalid customer ID format");
  }

  const customerExists = await Customer.findById(targetCustomerId);
  if (!customerExists) {
    throw new ApiError(404, "Customer not found");
  }

  // 2. Validate Items Array
  if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, "Order must contain at least one item");
  }

  for (const [index, item] of rawItems.entries()) {
    const prodId = item.product || item.productId;
    if (!prodId) {
      throw new ApiError(400, `Item at index ${index} must have a valid product reference`);
    }
    if (!mongoose.Types.ObjectId.isValid(prodId)) {
      throw new ApiError(400, `Item at index ${index} has an invalid product ID format`);
    }
    if (!item.quantity || Number(item.quantity) < 1) {
      throw new ApiError(400, `Item at index ${index} must have a quantity of at least 1`);
    }
    if (item.unitPrice === undefined || Number(item.unitPrice) < 0) {
      throw new ApiError(400, `Item at index ${index} must have a valid non-negative unitPrice`);
    }
  }

  // 3. Validate Delivery Address
  if (!targetAddress || !targetAddress.street || !targetAddress.city || !targetAddress.state || !targetAddress.postalCode) {
    throw new ApiError(400, "Delivery address with street, city, state, and postalCode is required");
  }

  // 4. Validate Warehouse if provided
  if (targetWarehouseId) {
    if (!mongoose.Types.ObjectId.isValid(targetWarehouseId)) {
      throw new ApiError(400, "Invalid warehouse ID format");
    }
    const warehouseExists = await Warehouse.findById(targetWarehouseId);
    if (!warehouseExists) {
      throw new ApiError(404, "Warehouse not found");
    }
  }
  if (!targetWarehouseId) throw new ApiError(400, "Warehouse ID is required so order inventory can be reserved");

  // Format line items and calculate totals
  const formattedItems = rawItems.map((item) => {
    const qty = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    return {
      product: item.product || item.productId,
      sku: (item.sku || "").toUpperCase() || "SKU-ITEM",
      name: item.name || "Order Item",
      quantity: qty,
      unitPrice,
      totalPrice: item.totalPrice !== undefined ? Number(item.totalPrice) : qty * unitPrice,
      isReserved: false,
    };
  });

  const totalAmount = formattedItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const orderNumber = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      if (targetWarehouseId) {
        for (const item of formattedItems) {
          await reserveInventory({ productId: item.product, warehouseId: targetWarehouseId, quantity: item.quantity, session });
          item.isReserved = true;
        }
      }
      [order] = await Order.create([{
        orderNumber,
        customer: targetCustomerId,
        warehouse: targetWarehouseId || undefined,
        items: formattedItems,
        totalAmount,
        paymentStatus: paymentStatus || PAYMENT_STATUS.PENDING,
        status: ORDER_STATUS.ORDER_CREATED,
        deliveryAddress: {
          street: targetAddress.street,
          city: targetAddress.city,
          state: targetAddress.state,
          postalCode: targetAddress.postalCode,
          country: targetAddress.country || "India",
        },
        statusHistory: [{
          status: ORDER_STATUS.ORDER_CREATED,
          timestamp: new Date(),
          changedBy: req.user?._id,
          note: notes || "Initial order placement",
        }],
      }], { session });
    });
  } finally {
    await session.endSession();
  }

  return res.status(201).json(
    new ApiResponse(
      201,
      order,
      "Order created and inventory reserved successfully"
    )
  );
});

/**
 * Get all orders with query filters (status, warehouse, date, customer) & pagination
 */
export const getAllOrders = asyncHandler(async (req, res) => {
  const {
    status,
    warehouse,
    warehouseId,
    customer,
    customerId,
    date,
    startDate,
    endDate,
    search,
    page = 1,
    limit = 10,
  } = req.query;

  const filter = {};
  if (search?.trim()) filter.orderNumber = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

  // 1. Status Filter
  // Non-negotiable role-gating: Packer can ONLY see orders in PICKED status
  if (req.user?.role === USER_ROLES.PACKER) {
    filter.status = ORDER_STATUS.PICKED;
  } else if (status) {
    filter.status = status;
  }

  // 2. Warehouse Filter
  const targetWarehouse = warehouse || warehouseId;
  if (targetWarehouse) {
    if (mongoose.Types.ObjectId.isValid(targetWarehouse)) {
      filter.warehouse = targetWarehouse;
    }
  }

  // 3. Customer Filter
  const targetCustomer = customer || customerId;
  if (targetCustomer) {
    if (mongoose.Types.ObjectId.isValid(targetCustomer)) {
      filter.customer = targetCustomer;
    }
  }

  // 4. Date Filter
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    filter.createdAt = { $gte: start, $lte: end };
  } else if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      filter.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNum - 1) * limitNum;

  const [orders, totalOrders] = await Promise.all([
    Order.find(filter)
      .populate("customer", "name email phone")
      .populate("warehouse", "name code")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Order.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalOrders / limitNum);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        orders,
        pagination: {
          total: totalOrders,
          page: pageNum,
          limit: limitNum,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
        page: pageNum,
        limit: limitNum,
        totalOrders,
      },
      "Orders fetched successfully"
    )
  );
});

/**
 * Get single order details including embedded items and statusHistory audit trail
 */
export const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid order ID format");
  }

  const order = await Order.findById(id)
    .populate("customer", "name email phone shippingAddresses billingAddress")
    .populate("warehouse", "name code address manager")
    .populate("items.product", "name sku barcode category unitPrice")
    .populate("statusHistory.changedBy", "name email role")
    .populate("pickList", "pickListNumber status assignedPicker")
    .populate("package", "packageNumber boxType status weight")
    .populate("shipment", "shipmentNumber trackingNumber carrier status");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Non-negotiable role-gating: Packer can only view orders in PICKED, PACKING, or PACKED status
  if (
    req.user?.role === USER_ROLES.PACKER &&
    order.status !== ORDER_STATUS.PICKED &&
    order.status !== ORDER_STATUS.PACKING &&
    order.status !== ORDER_STATUS.PACKED
  ) {
    throw new ApiError(
      403,
      "Access denied: Packers are only authorized to view orders ready for packaging (PICKED)"
    );
  }

  const allowedNextTransitions = getAllowedTransitions(order.status);

  return res.status(200).json(
    new ApiResponse(
      200,
      { order, allowedNextTransitions },
      "Order details retrieved successfully"
    )
  );
});

/**
 * Transition order status
 * Rule: Validate against orderStateMachine. Never allow arbitrary status jumps.
 * Rule: Append to statusHistory array.
 * Transitions are role-checked, state-machine validated, and committed atomically.
 */
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nextStatus, note } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid order ID format");
  }

  if (!nextStatus) {
    throw new ApiError(400, "nextStatus is required");
  }

  if (!Object.values(ORDER_STATUS).includes(nextStatus)) throw new ApiError(400, "Unknown order status");
  if (!canRoleTransitionOrder(req.user.role, nextStatus)) throw new ApiError(403, "Your role cannot perform this order transition");

  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await Order.findById(id).session(session);
      if (!order) throw new ApiError(404, "Order not found");
      if (!canTransitionOrder(order.status, nextStatus)) {
        throw new ApiError(400, `Illegal status transition from '${order.status}' to '${nextStatus}'. Allowed: ${getAllowedTransitions(order.status).join(", ")}`);
      }
      if (nextStatus === ORDER_STATUS.PICKED) {
        const pickList = order.pickList ? await PickList.findById(order.pickList).session(session) : null;
        if (!pickList || ![PICKLIST_STATUS.PICKED, PICKLIST_STATUS.COMPLETED].includes(pickList.status)) {
          throw new ApiError(409, "All pick-list items must be picked before advancing the order");
        }
      }
      if (nextStatus === ORDER_STATUS.PACKED) {
        const pkg = order.package ? await Package.findById(order.package).session(session) : null;
        if (!pkg || pkg.status !== PACKAGE_STATUS.PACKED) throw new ApiError(409, "A sealed package is required before advancing the order");
      }
      if (nextStatus === ORDER_STATUS.CANCELLED) {
        for (const item of order.items.filter((line) => line.isReserved)) {
          await releaseReservedInventory({ productId: item.product, warehouseId: order.warehouse, quantity: item.quantity, session });
          item.isReserved = false;
        }
      }
      order.status = nextStatus;
      order.statusHistory.push({ status: nextStatus, timestamp: new Date(), changedBy: req.user?._id, note: note || `Transitioned to ${nextStatus}` });
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        order,
        orderId: order._id,
        currentStatus: order.status,
        targetStatus: nextStatus,
        note,
        allowedTransitions: getAllowedTransitions(order.status),
      },
      `Order transitioned to '${nextStatus}' successfully`
    )
  );
});

/**
 * Cancel order and release reserved stock
 * Cancellation releases previously reserved stock in the same transaction.
 */
export const cancelOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid order ID format");
  }

  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await Order.findById(id).session(session);
      if (!order) throw new ApiError(404, "Order not found");
      if (!canTransitionOrder(order.status, ORDER_STATUS.CANCELLED)) throw new ApiError(400, `Cannot cancel order in status '${order.status}'`);
      for (const item of order.items.filter((line) => line.isReserved)) {
        await releaseReservedInventory({ productId: item.product, warehouseId: order.warehouse, quantity: item.quantity, session });
        item.isReserved = false;
      }
      order.status = ORDER_STATUS.CANCELLED;
      order.cancellationReason = reason || "Cancelled by user";
      order.statusHistory.push({ status: ORDER_STATUS.CANCELLED, timestamp: new Date(), changedBy: req.user?._id, note: order.cancellationReason });
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { order, status: ORDER_STATUS.CANCELLED, reason },
      "Order cancelled and reserved inventory released"
    )
  );
});
