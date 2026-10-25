import mongoose from "mongoose";
import { Shipment, SHIPMENT_STATUS } from "../models/shipment.model.js";
import { TrackingEvent } from "../models/trackingEvent.model.js";
import { Order } from "../models/order.model.js";
import { Package } from "../models/package.model.js";
import { Carrier } from "../models/carrier.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ORDER_STATUS, canTransitionOrder } from "../utils/orderStateMachine.js";

const SHIPMENT_ORDER_STATUS = {
  CREATED: ORDER_STATUS.SHIPMENT_CREATED,
  CARRIER_ASSIGNED: ORDER_STATUS.CARRIER_ASSIGNED,
  DISPATCHED: ORDER_STATUS.DISPATCHED,
  IN_TRANSIT: ORDER_STATUS.IN_TRANSIT,
  OUT_FOR_DELIVERY: ORDER_STATUS.OUT_FOR_DELIVERY,
  DELIVERED: ORDER_STATUS.DELIVERED,
  FAILED_DELIVERY: ORDER_STATUS.FAILED_DELIVERY,
  CANCELLED: ORDER_STATUS.CANCELLED,
};
const SHIPMENT_NEXT = {
  CREATED: [SHIPMENT_STATUS.CARRIER_ASSIGNED],
  CARRIER_ASSIGNED: [SHIPMENT_STATUS.DISPATCHED],
  DISPATCHED: [SHIPMENT_STATUS.IN_TRANSIT],
  IN_TRANSIT: [SHIPMENT_STATUS.OUT_FOR_DELIVERY, SHIPMENT_STATUS.FAILED_DELIVERY],
  OUT_FOR_DELIVERY: [SHIPMENT_STATUS.DELIVERED, SHIPMENT_STATUS.FAILED_DELIVERY],
  FAILED_DELIVERY: [SHIPMENT_STATUS.OUT_FOR_DELIVERY, SHIPMENT_STATUS.CANCELLED],
  DELIVERED: [],
  CANCELLED: [],
};

const transitionShipment = async ({ id, targetStatus, req, location, description, rawCarrierPayload, carrierId, trackingNumber, labelUrl, expectedDeliveryDate }) => {
  if (!Object.values(SHIPMENT_STATUS).includes(targetStatus)) throw new ApiError(400, "Unknown shipment status");
  const session = await mongoose.startSession();
  let shipment;
  try {
    await session.withTransaction(async () => {
      shipment = await Shipment.findById(id).session(session);
      if (!shipment) throw new ApiError(404, "Shipment not found");
      if (!SHIPMENT_NEXT[shipment.status]?.includes(targetStatus)) throw new ApiError(400, `Illegal shipment transition from '${shipment.status}' to '${targetStatus}'`);
      if (carrierId) {
        if (shipment.status !== SHIPMENT_STATUS.CREATED || !trackingNumber?.trim()) throw new ApiError(400, "A tracking number is required to assign a carrier to a new shipment");
        const carrier = await Carrier.findOne({ _id: carrierId, status: "ACTIVE" }).session(session);
        if (!carrier) throw new ApiError(404, "Active carrier not found");
        shipment.carrier = carrier._id;
        shipment.trackingId = trackingNumber.trim();
        if (labelUrl) shipment.labelUrl = labelUrl;
        if (expectedDeliveryDate) shipment.expectedDeliveryDate = expectedDeliveryDate;
      }
      const order = await Order.findById(shipment.order).session(session);
      const targetOrderStatus = SHIPMENT_ORDER_STATUS[targetStatus];
      if (!order || !canTransitionOrder(order.status, targetOrderStatus)) throw new ApiError(400, `Order cannot transition from '${order?.status}' to '${targetOrderStatus}'`);
      shipment.status = targetStatus;
      if (targetStatus === SHIPMENT_STATUS.DISPATCHED) shipment.dispatchedAt = new Date();
      if (targetStatus === SHIPMENT_STATUS.DELIVERED) shipment.deliveredAt = new Date();
      await shipment.save({ session });
      order.status = targetOrderStatus;
      order.statusHistory.push({ status: targetOrderStatus, timestamp: new Date(), changedBy: req.user?._id, note: description || `Shipment reached ${targetStatus}` });
      await order.save({ session });
      await TrackingEvent.create([{
        shipment: shipment._id, eventType: targetStatus, timestamp: new Date(),
        location: location || "Carrier network", description: description || `Shipment reached ${targetStatus.replaceAll("_", " ")}`,
        rawCarrierPayload,
      }], { session });
    });
  } finally { await session.endSession(); }
  return shipment;
};

export const getActiveCarriers = asyncHandler(async (req, res) => {
  const carriers = await Carrier.find({ status: "ACTIVE" }).select("name code serviceTypes").sort({ name: 1 });
  return res.status(200).json(new ApiResponse(200, carriers, "Active carriers retrieved"));
});

/**
 * Initialize shipment for a packed order
 * POST /shipments
 * Creates a shipment for a sealed package and records the order transition.
 */
export const createShipment = asyncHandler(async (req, res) => {
  const {
    orderId,
    packageId,
    carrierId,
    shippingMethod,
    trackingId,
    trackingNumber,
    origin,
    destination,
    expectedDeliveryDate,
  } = req.body;

  if (!orderId || !packageId) {
    throw new ApiError(400, "Order ID and package ID are required to initialize a shipment");
  }

  if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(packageId)) {
    throw new ApiError(400, "Invalid orderId or packageId format");
  }
  if (carrierId && !(trackingId || trackingNumber)?.trim()) throw new ApiError(400, "Tracking number is required when creating with a carrier");

  const session = await mongoose.startSession();
  let shipment;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      const pkg = await Package.findById(packageId).session(session);
      if (!order) throw new ApiError(404, "Order not found");
      if (!pkg) throw new ApiError(404, "Package not found");
      if (order.status !== ORDER_STATUS.PACKED || order.package?.toString() !== pkg._id.toString() || pkg.order.toString() !== order._id.toString() || pkg.status !== "PACKED") {
        throw new ApiError(409, "Shipment requires the order's sealed package and PACKED status");
      }
      if (req.user.role === "WAREHOUSE_MANAGER" && req.user.assignedWarehouse?.toString() !== order.warehouse?.toString()) throw new ApiError(403, "You may ship orders only from your assigned warehouse");
      if (!canTransitionOrder(order.status, ORDER_STATUS.SHIPMENT_CREATED)) throw new ApiError(400, "Order cannot transition to SHIPMENT_CREATED");
      let carrier;
      if (carrierId) {
        carrier = await Carrier.findOne({ _id: carrierId, status: "ACTIVE" }).session(session);
        if (!carrier) throw new ApiError(404, "Carrier not found");
      }
      const shipmentNumber = `SHP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      const awb = trackingId || trackingNumber;
      const initialStatus = carrierId ? SHIPMENT_STATUS.CARRIER_ASSIGNED : SHIPMENT_STATUS.CREATED;
      [shipment] = await Shipment.create([{
        shipmentNumber, order: order._id, package: pkg._id, carrier: carrierId || undefined,
        trackingId: awb, shippingMethod: shippingMethod || "Standard Ground",
        origin, destination: destination || order.deliveryAddress, status: initialStatus,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
      }], { session });
      order.status = ORDER_STATUS.SHIPMENT_CREATED;
      order.shipment = shipment._id;
      order.statusHistory.push({ status: ORDER_STATUS.SHIPMENT_CREATED, timestamp: new Date(), changedBy: req.user?._id, note: `Shipment ${shipmentNumber} created` });
      if (carrierId) {
        if (!canTransitionOrder(order.status, ORDER_STATUS.CARRIER_ASSIGNED)) throw new ApiError(400, "Order cannot transition to CARRIER_ASSIGNED");
        order.status = ORDER_STATUS.CARRIER_ASSIGNED;
        order.statusHistory.push({ status: ORDER_STATUS.CARRIER_ASSIGNED, timestamp: new Date(), changedBy: req.user?._id, note: `Carrier ${carrier.name} assigned` });
      }
      pkg.status = "SHIPPED";
      await pkg.save({ session });
      await order.save({ session });
      await TrackingEvent.create([{
        shipment: shipment._id, eventType: initialStatus, timestamp: new Date(),
        location: origin?.city || "Warehouse", description: `Shipment ${initialStatus.toLowerCase().replaceAll("_", " ")}`,
      }], { session });
    });
  } finally { await session.endSession(); }
  return res.status(201).json(new ApiResponse(201, shipment, "Shipment created successfully"));
});

/**
 * Transition shipment lifecycle status
 * PATCH /shipments/:id/status
 * Validates the order state, synchronizes its audit history, and records a tracking event.
 */
export const updateShipmentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    status,
    nextStatus,
    location,
    description,
    rawCarrierPayload,
  } = req.body;

  const targetStatus = status || nextStatus;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid shipment ID format");
  }

  if (!targetStatus) {
    throw new ApiError(400, "Target shipment status is required");
  }

  const updatedShipment = await transitionShipment({ id, targetStatus, req, location, description, rawCarrierPayload });
  return res.status(200).json(new ApiResponse(200, updatedShipment, "Shipment status updated and tracking event recorded"));

});

/**
 * Get tracking events timeline for a shipment
 * GET /shipments/:id/tracking
 * Fully implemented (Read operation sorted by timestamp)
 */
export const getShipmentTracking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid shipment ID format");
  }

  const shipment = await Shipment.findById(id)
    .populate("carrier", "name code trackingUrlTemplate contactInfo")
    .populate("order", "orderNumber status deliveryAddress")
    .populate("package", "packageNumber weight boxSize");

  if (!shipment) {
    throw new ApiError(404, "Shipment not found");
  }

  // Simple read query sorted by timestamp ascending
  const events = await TrackingEvent.find({ shipment: id }).sort({ timestamp: 1 });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        shipment,
        events,
      },
      "Tracking events timeline retrieved successfully"
    )
  );
});

/**
 * Simulate the next operational milestone event in the carrier lifecycle
 * POST /shipments/:id/simulate-next-event
 * Advances to the next valid shipment milestone and records the associated order history.
 */
export const simulateNextEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid shipment ID format");
  }

  const currentShipment = await Shipment.findById(id);
  if (!currentShipment) throw new ApiError(404, "Shipment not found");
  if (currentShipment.status === SHIPMENT_STATUS.CREATED && !currentShipment.carrier) throw new ApiError(409, "Assign a carrier before advancing the shipment");
  const nextStatus = SHIPMENT_NEXT[currentShipment.status]?.[0];
  if (!nextStatus) throw new ApiError(409, `Shipment in '${currentShipment.status}' has no next milestone`);
  const simulatedShipment = await transitionShipment({ id, targetStatus: nextStatus, req, description: `Simulated ${nextStatus.replaceAll("_", " ")} milestone` });
  return res.status(200).json(new ApiResponse(200, simulatedShipment, "Next shipment milestone recorded"));

});

/**
 * Get all shipments with status and carrier filtering & pagination
 */
export const getAllShipments = asyncHandler(async (req, res) => {
  const { status, carrierId, orderId, page = 1, limit = 10 } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (carrierId) filter.carrier = carrierId;
  if (orderId) filter.order = orderId;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNum - 1) * limitNum;

  const [shipments, totalCount] = await Promise.all([
    Shipment.find(filter)
      .populate("carrier", "name code")
      .populate("order", "orderNumber status deliveryAddress")
      .populate("package", "packageNumber weight")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Shipment.countDocuments(filter),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        shipments,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum),
        },
        page: pageNum,
        limit: limitNum,
        total: totalCount,
      },
      "Shipments fetched successfully"
    )
  );
});

/**
 * Get single shipment details by ID
 */
export const getShipmentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid shipment ID format");
  }

  const shipment = await Shipment.findById(id)
    .populate("order")
    .populate("package")
    .populate("carrier");

  if (!shipment) {
    throw new ApiError(404, "Shipment not found");
  }

  return res.status(200).json(
    new ApiResponse(200, shipment, "Shipment retrieved successfully")
  );
});

/**
 * Assign carrier and tracking number
 */
export const assignCarrier = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { carrierId, trackingNumber, trackingId, labelUrl, estimatedDeliveryDate, expectedDeliveryDate } = req.body;

  const awb = trackingId || trackingNumber;

  if (!carrierId || !awb) {
    throw new ApiError(400, "Carrier ID and tracking number are required");
  }

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(carrierId)) throw new ApiError(400, "Invalid shipment or carrier ID");
  const updated = await transitionShipment({
    id, targetStatus: SHIPMENT_STATUS.CARRIER_ASSIGNED, req, carrierId, trackingNumber: awb, labelUrl,
    expectedDeliveryDate: expectedDeliveryDate || estimatedDeliveryDate,
    description: `Carrier assigned with tracking number ${awb}`,
  });
  return res.status(200).json(new ApiResponse(200, updated, "Carrier assigned and tracking event recorded"));
});
