import mongoose from "mongoose";
import { Order } from "../models/order.model.js";
import { PickList } from "../models/pickList.model.js";
import { Package } from "../models/package.model.js";
import { Shipment, SHIPMENT_STATUS } from "../models/shipment.model.js";
import { Return, RETURN_STATUS } from "../models/return.model.js";
import { Inventory } from "../models/inventory.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ORDER_STATUS } from "../utils/orderStateMachine.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const getAnalyticsDashboard = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfSeries = new Date(now.getTime() - 29 * DAY_MS);
  startOfSeries.setHours(0, 0, 0, 0);
  const awaitingPickingStatuses = [ORDER_STATUS.CONFIRMED, ORDER_STATUS.INVENTORY_CHECK, ORDER_STATUS.WAREHOUSE_ALLOCATION, ORDER_STATUS.PICK_LIST_CREATED, ORDER_STATUS.PICKING];
  const awaitingPackingStatuses = [ORDER_STATUS.PICKED, ORDER_STATUS.PACKING];
  const awaitingDispatchStatuses = [ORDER_STATUS.PACKED, ORDER_STATUS.SHIPMENT_CREATED, ORDER_STATUS.CARRIER_ASSIGNED];

  const [
    totalOrders, ordersToday, pendingOrders, deliveredCount, failedDeliveries,
    returnRequestsCount, completedReturns, ordersByStatus, dailyOrders,
    stationCounts, lowStockRecords, warehousePerformance, deliveryTimes,
    deliverySla, returnReasonsBreakdown, carrierPerformance, inventoryLevels,
  ] = await Promise.all([
    Order.countDocuments({}),
    Order.countDocuments({ createdAt: { $gte: startOfToday } }),
    Order.countDocuments({ status: { $nin: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURN_REFUNDED, ORDER_STATUS.RETURN_REPLACED] } }),
    Order.countDocuments({ status: ORDER_STATUS.DELIVERED }),
    Order.countDocuments({ status: ORDER_STATUS.FAILED_DELIVERY }),
    Return.countDocuments({ status: { $in: [RETURN_STATUS.REQUESTED, RETURN_STATUS.RETURN_REQUESTED, RETURN_STATUS.APPROVED, RETURN_STATUS.PICKUP_SCHEDULED, RETURN_STATUS.RETURN_IN_TRANSIT, RETURN_STATUS.RECEIVED, RETURN_STATUS.RETURN_RECEIVED] } }),
    Return.countDocuments({ status: { $in: [RETURN_STATUS.REFUNDED, RETURN_STATUS.REPLACED, RETURN_STATUS.RETURN_REFUNDED, RETURN_STATUS.RETURN_REPLACED] } }),
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } }, { $sort: { count: -1 } }, { $project: { _id: 0, status: "$_id", count: 1, revenue: 1 } }]),
    Order.aggregate([
      { $match: { createdAt: { $gte: startOfSeries } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", count: 1 } },
    ]),
    Order.aggregate([
      { $group: {
        _id: null,
        awaitingPicking: { $sum: { $cond: [{ $in: ["$status", awaitingPickingStatuses] }, 1, 0] } },
        awaitingPacking: { $sum: { $cond: [{ $in: ["$status", awaitingPackingStatuses] }, 1, 0] } },
        awaitingDispatch: { $sum: { $cond: [{ $in: ["$status", awaitingDispatchStatuses] }, 1, 0] } },
      } },
    ]),
    Inventory.find({ $expr: { $lte: ["$available", "$lowStockThreshold"] } })
      .populate("product", "name sku")
      .populate("warehouse", "name code")
      .sort({ available: 1 })
      .limit(25)
      .lean(),
    Order.aggregate([
      { $match: { warehouse: { $ne: null } } },
      { $group: { _id: "$warehouse", totalOrders: { $sum: 1 }, deliveredOrders: { $sum: { $cond: [{ $eq: ["$status", ORDER_STATUS.DELIVERED] }, 1, 0] } }, revenue: { $sum: "$totalAmount" } } },
      { $lookup: { from: "warehouses", localField: "_id", foreignField: "_id", as: "warehouse" } },
      { $unwind: "$warehouse" },
      { $project: { _id: 0, warehouseId: "$_id", name: "$warehouse.name", code: "$warehouse.code", totalOrders: 1, deliveredOrders: 1, revenue: 1 } },
      { $sort: { totalOrders: -1 } },
    ]),
    Order.aggregate([
      { $match: { status: ORDER_STATUS.DELIVERED } },
      { $project: {
        confirmedAt: { $arrayElemAt: [{ $map: { input: { $filter: { input: "$statusHistory", as: "event", cond: { $eq: ["$$event.status", ORDER_STATUS.CONFIRMED] } } }, as: "event", in: "$$event.timestamp" } }, 0] },
        deliveredAt: { $arrayElemAt: [{ $map: { input: { $filter: { input: "$statusHistory", as: "event", cond: { $eq: ["$$event.status", ORDER_STATUS.DELIVERED] } } }, as: "event", in: "$$event.timestamp" } }, 0] },
      } },
      { $match: { confirmedAt: { $ne: null }, deliveredAt: { $ne: null } } },
      { $project: { hours: { $divide: [{ $subtract: ["$deliveredAt", "$confirmedAt"] }, 3600000] } } },
      { $group: { _id: null, avgHoursConfirmedToDelivered: { $avg: "$hours" }, totalDeliveredSampled: { $sum: 1 } } },
    ]),
    Shipment.aggregate([
      { $match: { status: SHIPMENT_STATUS.DELIVERED, expectedDeliveryDate: { $ne: null }, deliveredAt: { $ne: null } } },
      { $group: { _id: null, sampled: { $sum: 1 }, onTime: { $sum: { $cond: [{ $lte: ["$deliveredAt", "$expectedDeliveryDate"] }, 1, 0] } } } },
    ]),
    Return.aggregate([{ $group: { _id: "$reason", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $project: { _id: 0, reason: "$_id", count: 1 } }]),
    Shipment.aggregate([
      { $match: { carrier: { $ne: null } } },
      { $group: { _id: "$carrier", totalShipments: { $sum: 1 }, delivered: { $sum: { $cond: [{ $eq: ["$status", SHIPMENT_STATUS.DELIVERED] }, 1, 0] } }, failed: { $sum: { $cond: [{ $eq: ["$status", SHIPMENT_STATUS.FAILED_DELIVERY] }, 1, 0] } } } },
      { $lookup: { from: "carriers", localField: "_id", foreignField: "_id", as: "carrier" } },
      { $unwind: "$carrier" },
      { $project: { _id: 0, carrierId: "$_id", name: "$carrier.name", code: "$carrier.code", totalShipments: 1, delivered: 1, failed: 1 } },
      { $sort: { totalShipments: -1 } },
    ]),
    Inventory.aggregate([
      { $group: { _id: "$warehouse", available: { $sum: "$available" }, reserved: { $sum: "$reserved" }, damaged: { $sum: "$damaged" }, returned: { $sum: "$returned" } } },
      { $lookup: { from: "warehouses", localField: "_id", foreignField: "_id", as: "warehouse" } },
      { $unwind: "$warehouse" },
      { $project: { _id: 0, warehouseId: "$_id", name: "$warehouse.name", code: "$warehouse.code", available: 1, reserved: 1, damaged: 1, returned: 1 } },
      { $sort: { name: 1 } },
    ]),
  ]);

  const filledSeries = new Map(dailyOrders.map((row) => [row.date, row.count]));
  const ordersOverTime = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(startOfSeries.getTime() + index * DAY_MS);
    const key = date.toISOString().slice(0, 10);
    return { date: key, count: filledSeries.get(key) || 0 };
  });
  const avgHours = deliveryTimes[0]?.avgHoursConfirmedToDelivered || 0;
  const sla = deliverySla[0];
  const dashboard = {
    overview: { totalOrders, ordersToday, pendingOrders, deliveredCount, failedDeliveries, returnRequestsCount, completedReturns },
    ordersAwaitingStation: stationCounts[0] || { awaitingPicking: 0, awaitingPacking: 0, awaitingDispatch: 0 },
    ordersByStatus,
    ordersOverTime,
    lowStockAlerts: lowStockRecords.map((record) => ({ inventoryId: record._id, name: record.product?.name || "Unknown product", sku: record.product?.sku || "—", available: record.available, lowStockThreshold: record.lowStockThreshold, warehouse: record.warehouse?.name || "—" })),
    inventoryLevels,
    warehousePerformance,
    deliveryPerformance: { avgHoursConfirmedToDelivered: avgHours, avgDaysConfirmedToDelivered: avgHours / 24, totalDeliveredSampled: deliveryTimes[0]?.totalDeliveredSampled || 0, onTimeDeliveryRatePercent: sla?.sampled ? (sla.onTime / sla.sampled) * 100 : 0, onTimeDeliverySampled: sla?.sampled || 0 },
    returnReasonsBreakdown,
    carrierPerformance,
  };
  return res.status(200).json(new ApiResponse(200, dashboard, "Analytics dashboard metrics retrieved"));
});

export const getFulfillmentOverview = asyncHandler(async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [totalOrders, pendingFulfillment, dispatchedToday, deliveredToday, totalReturns, deliveredOrders] = await Promise.all([
    Return.countDocuments({}),
    Order.countDocuments({ status: { $nin: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED] } }),
    Order.countDocuments({ status: { $in: [ORDER_STATUS.DISPATCHED, ORDER_STATUS.IN_TRANSIT, ORDER_STATUS.OUT_FOR_DELIVERY] }, updatedAt: { $gte: startOfDay } }),
    Order.countDocuments({ status: ORDER_STATUS.DELIVERED, updatedAt: { $gte: startOfDay } }),
    Order.countDocuments({}),
    Order.countDocuments({ status: ORDER_STATUS.DELIVERED }),
  ]);
  return res.status(200).json(new ApiResponse(200, { totalOrders, pendingFulfillment, dispatchedToday, deliveredToday, returnRatePercent: totalOrders ? (totalReturns / totalOrders) * 100 : 0, deliveredOrders }, "Fulfillment overview fetched"));
});

export const getWarehouseThroughput = asyncHandler(async (req, res) => {
  const { warehouseId } = req.query;
  // Look-back window: last 24 hours (wider than 1h so seeded data within the last day is captured)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (warehouseId && !mongoose.Types.ObjectId.isValid(warehouseId)) throw new ApiError(400, "Invalid warehouseId");
  const warehouseFilter = warehouseId ? { warehouse: new mongoose.Types.ObjectId(warehouseId) } : {};
  const [picked, packed, activePickLists] = await Promise.all([
    PickList.aggregate([
      // Match pick lists updated within the window — covers seeded completed pick lists
      { $match: { updatedAt: { $gte: since }, ...warehouseFilter } },
      { $unwind: "$items" },
      { $group: { _id: null, pickedUnits: { $sum: "$items.pickedQuantity" }, totalUnits: { $sum: "$items.quantity" } } },
    ]),
    // Fall back to updatedAt when packedAt is not set (e.g. seeded packages that skipped the field)
    Package.countDocuments({
      $or: [
        { packedAt: { $gte: since }, ...warehouseFilter },
        { packedAt: { $exists: false }, updatedAt: { $gte: since }, ...warehouseFilter },
      ],
    }),
    PickList.countDocuments({ status: { $in: ["ASSIGNED", "PICKING"] }, ...warehouseFilter }),
  ]);
  const pickData = picked[0] || { pickedUnits: 0, totalUnits: 0 };
  return res.status(200).json(new ApiResponse(200, {
    warehouseId: warehouseId || "ALL",
    picksPerHour: pickData.pickedUnits,
    packsPerHour: packed,
    pickCompletionPercent: pickData.totalUnits ? Number(((pickData.pickedUnits / pickData.totalUnits) * 100).toFixed(1)) : 0,
    activePickLists,
  }, "Warehouse throughput metrics fetched"));
});

export const getOrderFulfillmentTimes = asyncHandler(async (req, res) => {
  const [pickDurations, packDurations, deliveryDurations] = await Promise.all([
    Order.aggregate([
      { $project: {
        // Use timestamps from statusHistory so they are consistent with each other
        // (avoids negative values when createdAt is newer than statusHistory timestamps in seeded data)
        confirmedAt: { $arrayElemAt: [{ $map: { input: { $filter: { input: "$statusHistory", as: "event", cond: { $eq: ["$$event.status", ORDER_STATUS.CONFIRMED] } } }, as: "event", in: "$$event.timestamp" } }, 0] },
        pickingAt:   { $arrayElemAt: [{ $map: { input: { $filter: { input: "$statusHistory", as: "event", cond: { $eq: ["$$event.status", ORDER_STATUS.PICKED] } } }, as: "event", in: "$$event.timestamp" } }, 0] },
        packingAt:   { $arrayElemAt: [{ $map: { input: { $filter: { input: "$statusHistory", as: "event", cond: { $eq: ["$$event.status", ORDER_STATUS.PACKED] } } }, as: "event", in: "$$event.timestamp" } }, 0] },
        deliveredAt: { $arrayElemAt: [{ $map: { input: { $filter: { input: "$statusHistory", as: "event", cond: { $eq: ["$$event.status", ORDER_STATUS.DELIVERED] } } }, as: "event", in: "$$event.timestamp" } }, 0] },
      } },
      {
        $project: {
          // Time from CONFIRMED → PICKED (minutes)
          pickMinutes: { $cond: [{ $and: ["$pickingAt", "$confirmedAt"] }, { $divide: [{ $subtract: ["$pickingAt", "$confirmedAt"] }, 60000] }, null] },
          // Time from PICKED → PACKED (minutes)
          packMinutes: { $cond: [{ $and: ["$packingAt", "$pickingAt"] }, { $divide: [{ $subtract: ["$packingAt", "$pickingAt"] }, 60000] }, null] },
          // Time from CONFIRMED → DELIVERED (days)
          deliveryDays: { $cond: [{ $and: ["$deliveredAt", "$confirmedAt"] }, { $divide: [{ $subtract: ["$deliveredAt", "$confirmedAt"] }, DAY_MS] }, null] },
        },
      },
      { $match: { deliveryDays: { $gte: 0 } } },
      { $group: { _id: null, avgTimeToPickMinutes: { $avg: "$pickMinutes" }, avgTimeToPackMinutes: { $avg: "$packMinutes" }, avgTimeToDeliverDays: { $avg: "$deliveryDays" } } },
    ]),
    Shipment.aggregate([
      { $match: { dispatchedAt: { $ne: null }, createdAt: { $ne: null } } },
      { $project: { hours: { $divide: [{ $subtract: ["$dispatchedAt", "$createdAt"] }, 3600000] } } },
      { $group: { _id: null, avgTimeToDispatchHours: { $avg: "$hours" } } },
    ]),
    Order.countDocuments({ status: ORDER_STATUS.DELIVERED }),
  ]);
  const pickPack = pickDurations[0] || {};
  return res.status(200).json(new ApiResponse(200, {
    avgTimeToPickMinutes: pickPack.avgTimeToPickMinutes || 0,
    avgTimeToPackMinutes: pickPack.avgTimeToPackMinutes || 0,
    avgTimeToDispatchHours: packDurations[0]?.avgTimeToDispatchHours || 0,
    avgTimeToDeliverDays: pickPack.avgTimeToDeliverDays || 0,
    deliveredOrderCount: deliveryDurations,
  }, "Fulfillment turnaround time metrics fetched"));
});
