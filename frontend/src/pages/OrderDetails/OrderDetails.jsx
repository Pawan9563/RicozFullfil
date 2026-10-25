import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { orderAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import StatusBadge from "../../components/ui/StatusBadge";
import DataTable from "../../components/ui/DataTable";
import Button from "../../components/forms/Button";

const ROLE_TARGETS = {
  WAREHOUSE_MANAGER: ["INVENTORY_CHECK", "WAREHOUSE_ALLOCATION", "PICK_LIST_CREATED", "PICKING", "PICKED", "PACKING", "PACKED", "SHIPMENT_CREATED", "CARRIER_ASSIGNED", "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "RETURN_RECEIVED", "RETURN_INSPECTED"],
  PICKER: ["PICKING", "PICKED"],
  PACKER: ["PACKING", "PACKED"],
};
const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

export const OrderDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [transitions, setTransitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadOrder = async () => {
    setLoading(true);
    try {
      const response = await orderAPI.getById(id);
      setOrder(response?.data?.order || null);
      setTransitions(response?.data?.allowedNextTransitions || []);
      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load order details.");
    } finally { setLoading(false); }
  };
  useEffect(() => { loadOrder(); }, [id]);

  const allowedByRole = ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"].includes(user?.role)
    ? transitions
    : transitions.filter((status) => (ROLE_TARGETS[user?.role] || []).includes(status));

  const transition = async (nextStatus) => {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await orderAPI.updateStatus(id, { nextStatus, note: `Updated by ${user?.name || user?.role}` });
      setOrder(response?.data?.order || order);
      setTransitions(response?.data?.allowedTransitions || []);
      setNotice(`Order moved to ${nextStatus.replaceAll("_", " ")}.`);
      await loadOrder();
    } catch (err) { setError(err?.message || "Unable to update order status."); }
    finally { setSaving(false); }
  };

  const items = order?.items || order?.orderItems || [];
  const history = [...(order?.statusHistory || [])].sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp));
  const itemColumns = [
    { header: "SKU", accessor: "sku" },
    { header: "Product", accessor: "name" },
    { header: "Quantity", accessor: "quantity" },
    { header: "Unit price", accessor: "unitPrice", render: (row) => formatMoney(row.unitPrice) },
    { header: "Total", accessor: "totalPrice", render: (row) => formatMoney(row.totalPrice) },
  ];

  if (loading) return <p role="status" className="loading-state">Loading order…</p>;
  if (!order) return <div className="error-banner" role="alert">{error || "Order not found."}</div>;

  return (
    <div>
      <div className="page-header">
        <div><div className="title-with-status"><h1 className="page-title">{order.orderNumber}</h1><StatusBadge status={order.status} /></div><p className="page-subtitle">{order.customer?.name || "Customer"} · {order.customer?.email || ""}</p></div>
        <div className="action-row">{allowedByRole.map((status) => <Button key={status} variant={status === "CANCELLED" ? "danger" : "outline"} disabled={saving} onClick={() => transition(status)}>{status === "CANCELLED" ? "Cancel order" : `Move to ${status.replaceAll("_", " ")}`}</Button>)}</div>
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}{notice && <div className="success-banner" role="status">{notice}</div>}
      <div className="detail-grid">
        <section className="card"><h2 className="section-title">Order items</h2><DataTable columns={itemColumns} data={items} /><div className="order-total">Total <strong>{formatMoney(order.totalAmount)}</strong></div></section>
        <section className="card"><h2 className="section-title">Delivery</h2><address className="address-block">{order.deliveryAddress?.street || order.shippingAddress?.street}<br />{order.deliveryAddress?.city || order.shippingAddress?.city}, {order.deliveryAddress?.state || order.shippingAddress?.state} {order.deliveryAddress?.postalCode || order.shippingAddress?.postalCode}<br />{order.deliveryAddress?.country || order.shippingAddress?.country}</address><p className="muted-copy">Phone: {order.customer?.phone || "Not provided"}</p><p className="muted-copy">Warehouse: {order.warehouse?.name || "Unassigned"}</p></section>
      </div>
      <section className="card timeline-panel"><h2 className="section-title">Status history</h2>{history.length ? <ol className="event-timeline">{history.map((event, index) => <li className="timeline-event" key={`${event.status}-${event.timestamp}-${index}`}><span className="timeline-marker" /><div><div className="timeline-heading"><StatusBadge status={event.status} /><time>{event.timestamp ? new Date(event.timestamp).toLocaleString() : "Time unavailable"}</time></div><p>{event.note || "Status updated"}</p><small>{event.changedBy?.name || "System"}</small></div></li>)}</ol> : <p className="empty-state">No status events recorded.</p>}</section>
    </div>
  );
};

export default OrderDetails;
