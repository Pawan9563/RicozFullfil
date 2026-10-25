import React from "react";

const getBadgeClass = (status) => {
  if (!status) return "badge-default";

  switch (status.toUpperCase()) {
    case "DELIVERED":
    case "COMPLETED":
    case "PICKED":
    case "PACKED":
    case "RETURN_REFUNDED":
    case "RETURN_REPLACED":
      return "badge-success";

    case "CONFIRMED":
    case "PICKING":
    case "PACKING":
    case "DISPATCHED":
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
    case "RETURN_IN_TRANSIT":
      return "badge-info";

    case "ORDER_CREATED":
    case "INVENTORY_CHECK":
    case "WAREHOUSE_ALLOCATION":
    case "PICK_LIST_CREATED":
    case "SHIPMENT_CREATED":
    case "CARRIER_ASSIGNED":
    case "RETURN_REQUESTED":
    case "RETURN_APPROVED":
    case "PICKUP_SCHEDULED":
      return "badge-warning";

    case "CANCELLED":
    case "FAILED_DELIVERY":
    case "RETURN_REJECTED":
    case "DAMAGED":
    case "SCRAP":
      return "badge-danger";

    default:
      return "badge-default";
  }
};

export const StatusBadge = ({ status }) => {
  const badgeClass = getBadgeClass(status);
  const formattedStatus = status ? status.replace(/_/g, " ") : "UNKNOWN";

  return (
    <span className={`badge ${badgeClass}`}>
      {formattedStatus}
    </span>
  );
};

export default StatusBadge;
