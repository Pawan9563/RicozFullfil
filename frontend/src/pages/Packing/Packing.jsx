import React, { useEffect, useState } from "react";
import { packageAPI } from "../../services/api";
import Select from "../../components/forms/Select";
import Input from "../../components/forms/Input";
import Button from "../../components/forms/Button";
import StatusBadge from "../../components/ui/StatusBadge";

const INITIAL_FORM = { orderId: "", boxSize: "Standard Box", weight: "", length: "", width: "", height: "" };

export const Packing = () => {
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [createdPackage, setCreatedPackage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await packageAPI.getPackableOrders();
      setOrders(Array.isArray(response?.data) ? response.data : []);
      setError("");
    } catch (err) { setError(err?.message || "Unable to load orders ready for packing."); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadOrders(); }, []);
  const order = orders.find((row) => row._id === form.orderId);

  const sealPackage = async (event) => {
    event.preventDefault();
    setSaving(true); setError(""); setCreatedPackage(null);
    try {
      const response = await packageAPI.create({
        orderId: form.orderId,
        boxSize: form.boxSize,
        weight: Number(form.weight),
        dimensions: { length: Number(form.length), width: Number(form.width), height: Number(form.height), unit: "cm" },
      });
      setCreatedPackage(response?.data || null);
      setForm(INITIAL_FORM);
      await loadOrders();
    } catch (err) { setError(err?.message || "Unable to create package."); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">Packing Bench</h1><p className="page-subtitle">Verify picked items and register sealed packages</p></div></div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {createdPackage && <div className="success-banner" role="status">Package {createdPackage.packageNumber} created and order marked packed.</div>}
      <div className="detail-grid">
        <section className="card"><h2 className="section-title">Package specifications</h2>{loading ? <p role="status">Loading packable orders…</p> : orders.length ? <form onSubmit={sealPackage}>
          <Select id="pack-order" label="Order ready to pack" required value={form.orderId} onChange={(event) => { setCreatedPackage(null); setForm({ ...form, orderId: event.target.value }); }} options={[{ value: "", label: "Select an order" }, ...orders.map((row) => ({ value: row._id, label: `${row.orderNumber} · ${row.customer?.name || "Customer"}` }))]} />
          <Select id="pack-box" label="Box type" value={form.boxSize} onChange={(event) => setForm({ ...form, boxSize: event.target.value })} options={[{ value: "Small Box", label: "Small box" }, { value: "Standard Box", label: "Standard box" }, { value: "Large Carton", label: "Large carton" }, { value: "Poly Flyer", label: "Poly flyer" }]} />
          <div className="form-grid"><Input id="pack-length" label="Length (cm)" type="number" min="0.1" step="0.1" required value={form.length} onChange={(event) => setForm({ ...form, length: event.target.value })} /><Input id="pack-width" label="Width (cm)" type="number" min="0.1" step="0.1" required value={form.width} onChange={(event) => setForm({ ...form, width: event.target.value })} /><Input id="pack-height" label="Height (cm)" type="number" min="0.1" step="0.1" required value={form.height} onChange={(event) => setForm({ ...form, height: event.target.value })} /></div>
          <Input id="pack-weight" label="Scale weight (kg)" type="number" min="0.01" step="0.01" required value={form.weight} onChange={(event) => setForm({ ...form, weight: event.target.value })} />
          <Button type="submit" variant="primary" disabled={saving || !form.orderId}>{saving ? "Saving package…" : "Seal package"}</Button>
        </form> : <p className="empty-state">No orders are currently ready for packing.</p>}</section>
        <section className="card"><div className="section-heading"><h2 className="section-title">Order checklist</h2>{order && <StatusBadge status={order.status} />}</div>{order ? <><p className="muted-copy">{order.orderNumber} · {order.customer?.name || "Customer"}</p><div className="checklist">{(order.items || order.orderItems || []).map((item) => <div className="checklist-row" key={item._id || item.sku}><span className="checkmark" aria-hidden="true">✓</span><span>{item.name || item.product?.name || item.sku}</span><strong>{item.quantity} units</strong></div>)}</div></> : <p className="empty-state">Choose an order to verify its contents.</p>}</section>
      </div>
    </div>
  );
};

export default Packing;
