import React, { useEffect, useState } from "react";
import { pickListAPI, warehouseAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import DataTable from "../../components/ui/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/forms/Button";
import Input from "../../components/forms/Input";
import Select from "../../components/forms/Select";

export const PickLists = () => {
  const { user } = useAuth();
  const canCreate = ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER"].includes(user?.role);
  const canPickItems = ["SUPER_ADMIN", "ADMIN", "WAREHOUSE_MANAGER", "PICKER"].includes(user?.role);
  const [pickLists, setPickLists] = useState([]);
  const [selected, setSelected] = useState(null);
  const [orders, setOrders] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [pickers, setPickers] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ orderId: "", warehouseId: "", assignedPicker: "" });
  const [pickQuantities, setPickQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadLists = async () => {
    setLoading(true);
    try {
      const response = await pickListAPI.getAll();
      setPickLists(Array.isArray(response?.data) ? response.data : []);
      setError("");
    } catch (err) { setError(err?.message || "Unable to load pick lists."); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadLists(); }, []);
  const loadCreateOptions = async () => {
    try {
      const [orderResponse, warehouseResponse] = await Promise.all([
        pickListAPI.getEligibleOrders(), warehouseAPI.getAll(),
      ]);
      setOrders(orderResponse?.data || []);
      setWarehouses(Array.isArray(warehouseResponse?.data) ? warehouseResponse.data : []);
    } catch (err) { setError(err?.message || "Unable to load pick-list form options."); }
  };
  const loadEligiblePickers = async (warehouseId) => {
    if (!warehouseId) { setPickers([]); return; }
    try {
      const response = await pickListAPI.getEligiblePickers({ warehouseId });
      setPickers(response?.data || []);
    } catch (err) { setPickers([]); setError(err?.message || "Unable to load eligible pickers."); }
  };
  const showDetails = async (row) => {
    try {
      const response = await pickListAPI.getById(row._id);
      setSelected(response?.data || row);
      setError("");
    } catch (err) { setError(err?.message || "Unable to load pick-list details."); }
  };
  const createList = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await pickListAPI.create(form);
      setCreateOpen(false); setForm({ orderId: "", warehouseId: "", assignedPicker: "" });
      await loadLists();
      if (response?.data?._id) await showDetails(response.data);
    } catch (err) { setError(err?.message || "Unable to create pick list."); }
    finally { setSaving(false); }
  };
  const pickItem = async (item) => {
    const amount = Number(pickQuantities[item._id] || 1);
    const alreadyPicked = Number(item.pickedQuantity || item.quantityPicked || 0);
    const required = Number(item.quantity || item.quantityRequired || 0);
    if (!Number.isInteger(amount) || amount < 1 || alreadyPicked + amount > required) {
      setError(`Pick quantity must be 1–${Math.max(0, required - alreadyPicked)} for ${item.sku}.`); return;
    }
    setSaving(true); setError("");
    try {
      await pickListAPI.pickItem(selected._id, item._id, { quantity: amount });
      await showDetails(selected);
      await loadLists();
    } catch (err) { setError(err?.message || "Unable to record picked quantity."); }
    finally { setSaving(false); }
  };

  const columns = [
    { header: "Pick list", accessor: "pickListNumber" },
    { header: "Order", accessor: "order", render: (row) => row.order?.orderNumber || "—" },
    { header: "Warehouse", accessor: "warehouse", render: (row) => row.warehouse?.name || "—" },
    { header: "Picker", accessor: "assignedPicker", render: (row) => row.assignedPicker?.name || "Unassigned" },
    { header: "Status", accessor: "status", render: (row) => <StatusBadge status={row.status} /> },
    { header: "Lines", accessor: "items", render: (row) => row.items?.length || 0 },
  ];

  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">Pick Lists</h1><p className="page-subtitle">Assigned lists and live item-picking progress</p></div>{canCreate && <Button variant="primary" onClick={() => { setCreateOpen(true); loadCreateOptions(); }}>Generate pick list</Button>}</div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      <section className="card">{loading ? <p role="status">Loading pick lists…</p> : <DataTable columns={columns} data={pickLists} onRowClick={showDetails} />}</section>
      {selected && <section className="card detail-section"><div className="section-heading"><div><h2 className="section-title">{selected.pickListNumber}</h2><p className="muted-copy">{selected.order?.orderNumber} · {selected.warehouse?.name} · {selected.assignedPicker?.name || "Unassigned"}</p></div><StatusBadge status={selected.status} /></div><div className="table-container"><table className="custom-table"><thead><tr><th>Product</th><th>Pick location</th><th>Required</th><th>Picked</th><th>Status</th><th>Action</th></tr></thead><tbody>{(selected.items || []).map((item) => { const picked = Number(item.pickedQuantity || item.quantityPicked || 0); const required = Number(item.quantity || item.quantityRequired || 0); const remaining = required - picked; return <tr key={item._id}><td><strong>{item.sku}</strong><small className="table-subtext">{item.product?.name || ""}</small></td><td>{item.location?.code || "No location assigned"}</td><td>{required}</td><td>{picked}</td><td><StatusBadge status={item.status || (remaining ? "PENDING" : "PICKED")} /></td><td>{remaining > 0 && canPickItems ? <div className="pick-action"><Input id={`pick-${item._id}`} aria-label={`Quantity to pick for ${item.sku}`} type="number" min="1" max={remaining} step="1" value={pickQuantities[item._id] || 1} onChange={(event) => setPickQuantities({ ...pickQuantities, [item._id]: event.target.value })} /><Button variant="primary" disabled={saving} onClick={() => pickItem(item)}>Mark picked</Button></div> : remaining > 0 ? "Awaiting picker" : "Complete"}</td></tr>; })}</tbody></table></div></section>}
      {createOpen && <div className="modal-backdrop"><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="create-pick-title"><div className="section-heading"><h2 className="section-title" id="create-pick-title">Generate pick list</h2><button className="icon-button" type="button" aria-label="Close" onClick={() => setCreateOpen(false)}>×</button></div><form onSubmit={createList}><Select id="pick-order" label="Order" required value={form.orderId} onChange={(event) => { const selectedOrder = orders.find((row) => row._id === event.target.value); const selectedWarehouse = selectedOrder?.warehouse?._id || selectedOrder?.warehouse || ""; setForm({ ...form, orderId: event.target.value, warehouseId: selectedWarehouse, assignedPicker: "" }); loadEligiblePickers(selectedWarehouse); }} options={[{ value: "", label: orders.length ? "Select an order" : "No orders awaiting picking" }, ...orders.map((order) => ({ value: order._id, label: `${order.orderNumber} · ${order.customer?.name || "Customer"}` }))]} /><Select id="pick-warehouse" label="Warehouse" required value={form.warehouseId} disabled={Boolean(orders.find((row) => row._id === form.orderId)?.warehouse)} onChange={(event) => { setForm({ ...form, warehouseId: event.target.value, assignedPicker: "" }); loadEligiblePickers(event.target.value); }} options={[{ value: "", label: "Select warehouse" }, ...warehouses.map((warehouse) => ({ value: warehouse._id, label: warehouse.name }))]} /><Select id="pick-picker" label="Assign picker" value={form.assignedPicker} onChange={(event) => setForm({ ...form, assignedPicker: event.target.value })} options={[{ value: "", label: pickers.length ? "Use first available picker" : "No eligible pickers" }, ...pickers.map((picker) => ({ value: picker._id, label: picker.name }))]} /><div className="action-row"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={saving || !orders.length}>{saving ? "Creating…" : "Create list"}</Button></div></form></section></div>}
    </div>
  );
};

export default PickLists;
