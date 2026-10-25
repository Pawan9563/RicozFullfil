import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { shipmentAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/forms/Button";

export const ShipmentTracking = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [shipment, setShipment] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canSimulate = ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"].includes(user?.role);

  const loadTracking = async () => {
    setLoading(true);
    try {
      const response = await shipmentAPI.getTracking(id);
      setShipment(response?.data?.shipment || null);
      setEvents(response?.data?.events || []);
      setError("");
    } catch (err) { setError(err?.message || "Unable to load tracking details."); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadTracking(); }, [id]);

  const advanceTracking = async () => {
    setSaving(true); setError(""); setNotice("");
    try {
      await shipmentAPI.simulateNextEvent(id);
      setNotice("Next shipment milestone recorded.");
      await loadTracking();
    } catch (err) { setError(err?.message || "Unable to advance shipment."); }
    finally { setSaving(false); }
  };
  if (loading) return <p role="status" className="loading-state">Loading tracking events…</p>;
  if (!shipment) return <div className="error-banner" role="alert">{error || "Shipment not found."}</div>;
  const trackingNumber = shipment.trackingId || shipment.trackingNumber || "Not assigned";

  return <div>
    <div className="page-header"><div><div className="title-with-status"><h1 className="page-title">{trackingNumber}</h1><StatusBadge status={shipment.status} /></div><p className="page-subtitle">{shipment.shipmentNumber} · {shipment.carrier?.name || "Carrier unassigned"} · Order {shipment.order?.orderNumber || "—"}</p></div>{canSimulate && <Button variant="primary" disabled={saving || ["DELIVERED", "CANCELLED"].includes(shipment.status)} onClick={advanceTracking}>{saving ? "Updating…" : "Simulate next milestone"}</Button>}</div>
    {error && <div className="error-banner" role="alert">{error}</div>}{notice && <div className="success-banner" role="status">{notice}</div>}
    <section className="card tracking-summary"><div><span className="metric-title">Current status</span><strong>{shipment.status.replaceAll("_", " ")}</strong></div><div><span className="metric-title">Expected delivery</span><strong>{shipment.expectedDeliveryDate ? new Date(shipment.expectedDeliveryDate).toLocaleDateString() : "Not available"}</strong></div><div><span className="metric-title">Destination</span><strong>{shipment.destination?.city || shipment.order?.deliveryAddress?.city || "—"}</strong></div></section>
    <section className="card timeline-panel"><h2 className="section-title">Tracking timeline</h2>{events.length ? <ol className="event-timeline">{events.map((event, index) => <li className="timeline-event" key={event._id || `${event.eventType}-${event.timestamp}-${index}`}><span className="timeline-marker" /><div><div className="timeline-heading"><StatusBadge status={event.eventType || event.eventStatus} /><time>{new Date(event.timestamp || event.eventTimestamp).toLocaleString()}</time></div><p>{event.description || "Carrier milestone recorded"}</p><small>{event.location || "Location unavailable"}</small></div></li>)}</ol> : <p className="empty-state">No tracking events have been recorded yet.</p>}</section>
  </div>;
};

export default ShipmentTracking;
