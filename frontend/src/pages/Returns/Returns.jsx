import React, { useEffect, useState } from "react";
import { orderAPI, returnAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import DataTable from "../../components/ui/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/forms/Button";
import Input from "../../components/forms/Input";
import Select from "../../components/forms/Select";
import Pagination from "../../components/ui/Pagination";
import { warehouseAPI } from "../../services/api";

const CONDITIONS = ["UNOPENED", "OPENED", "DAMAGED", "DEFECTIVE"];
const DISPOSITIONS = ["RESTOCK", "REPAIR", "REJECT", "SCRAP", "DAMAGED"];

export const Returns = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [resolutionType, setResolutionType] = useState("REFUND");
  const [refundAmount, setRefundAmount] = useState("");
  const [replacementOrderId, setReplacementOrderId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [inspection, setInspection] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const roles = user?.role;
  const canInitiate = ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER"].includes(roles);
  // Approve/resolve is ops-level only — backend /approve and /resolve routes enforce the same restriction
  const canApprove = ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"].includes(roles);
  const canPickup = ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER"].includes(roles);
  const canReceiveInspect = ["SUPER_ADMIN", "ADMIN", "WAREHOUSE_MANAGER"].includes(roles);
  const canResolve = ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"].includes(roles);
  const loadReturns = async () => {
    setLoading(true);
    try {
      const response = await returnAPI.getAll({ page, limit: 10 });
      setRows(response?.data?.returns || []); setTotalPages(response?.data?.pagination?.totalPages || 1); setError("");
    } catch (err) { setError(err?.message || "Unable to load returns."); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadReturns(); }, [page]);
  useEffect(() => {
    warehouseAPI.getAll().then((response) => setWarehouses(Array.isArray(response?.data) ? response.data : []))
      .catch((err) => setError(err?.message || "Unable to load warehouses."));
  }, []);

  const runAction = async (callback, message) => {
    setSaving(true); setError(""); setNotice("");
    try { await callback(); await loadReturns(); setNotice(message); if (selected?._id) await openDetails(selected); }
    catch (err) { setError(err?.message || "Unable to update return."); }
    finally { setSaving(false); }
  };
  const openDetails = async (row) => {
    try {
      const response = await returnAPI.getById(row._id);
      setSelected(response?.data || row);
      setWarehouseId(response?.data?.warehouse?._id || response?.data?.warehouse || "");
      setError("");
    } catch (err) { setError(err?.message || "Unable to load return details."); }
  };
  const openCreate = async () => {
    setCreateOpen(true); setError("");
    try { const response = await orderAPI.getAll({ status: "DELIVERED", limit: 100 }); setOrders(response?.data?.orders || []); }
    catch (err) { setError(err?.message || "Unable to load delivered orders."); }
  };
  const initiate = async (event) => {
    event.preventDefault();
    const order = orders.find((row) => row._id === orderId);
    if (!order) return;
    setSaving(true); setError("");
    try {
      await returnAPI.initiate({ orderId, reason, returnItems: (order.items || order.orderItems || []).map((item) => ({ productId: item.product?._id || item.product, sku: item.sku, quantity: item.quantity })) });
      setCreateOpen(false); setOrderId(""); setReason(""); await loadReturns();
    } catch (err) { setError(err?.message || "Unable to initiate return."); }
    finally { setSaving(false); }
  };
  const inspect = async (event) => {
    event.preventDefault();
    const itemDispositions = (selected?.returnItems || selected?.items || []).map((item) => ({ itemId: item._id, condition: inspection[item._id]?.condition || "UNOPENED", disposition: inspection[item._id]?.disposition || "RESTOCK" }));
    await runAction(() => returnAPI.inspect(selected._id, { itemDispositions, warehouseId, notes: "Inspection completed" }), "Return inspection saved.");
  };
  const resolve = async (event) => {
    event.preventDefault();
    await runAction(() => returnAPI.resolve(selected._id, { resolutionType, refundAmount: Number(refundAmount || selected?.order?.totalAmount || 0), replacementOrderId: replacementOrderId || undefined }), "Return resolution saved.");
    setResolutionOpen(false);
  };

  const columns = [
    { header: "Return", accessor: "returnNumber" }, { header: "Order", accessor: "order", render: (row) => row.order?.orderNumber || "—" },
    { header: "Customer", accessor: "customer", render: (row) => row.customer?.name || "—" },
    { header: "Reason", accessor: "reason" }, { header: "Items", accessor: "returnItems", render: (row) => row.returnItems?.length || row.items?.length || 0 },
    { header: "Status", accessor: "status", render: (row) => <StatusBadge status={row.status} /> },
    { header: "Action", accessor: "_id", render: (row) => <div className="action-row" onClick={(event) => event.stopPropagation()}>
      {canApprove && row.status === "REQUESTED" && <><Button variant="primary" disabled={saving} onClick={() => runAction(() => returnAPI.approve(row._id, { approved: true }), "Return approved.")}>Approve</Button><Button variant="outline" disabled={saving} onClick={() => runAction(() => returnAPI.approve(row._id, { approved: false, rejectionReason: "Return rejected" }), "Return rejected.")}>Reject</Button></>}
      {canPickup && row.status === "APPROVED" && <Button variant="outline" disabled={saving} onClick={() => runAction(() => returnAPI.pickup(row._id, { inTransit: false, pickupDate: new Date().toISOString() }), "Pickup scheduled.")}>Schedule pickup</Button>}
      {canPickup && row.status === "PICKUP_SCHEDULED" && <Button variant="outline" disabled={saving} onClick={() => runAction(() => returnAPI.pickup(row._id, { inTransit: true }), "Return marked in transit.")}>Mark in transit</Button>}
      {canReceiveInspect && row.status === "RETURN_IN_TRANSIT" && <Button variant="outline" disabled={saving} onClick={() => runAction(() => returnAPI.receive(row._id, {}), "Return received.")}>Receive</Button>}
      {canResolve && row.status === "INSPECTED" && <Button variant="primary" onClick={async () => { await openDetails(row); setReplacementOrderId(""); setResolutionOpen(true); }}>Resolve</Button>}
    </div> },
  ];
  const returnItems = selected?.returnItems || selected?.items || [];

  return <div>
    <div className="page-header"><div><h1 className="page-title">Returns & Reverse Logistics</h1><p className="page-subtitle">Review requests, inspect returned goods, and record resolutions</p></div>{canInitiate && <Button variant="primary" onClick={openCreate}>Initiate return</Button>}</div>
    {error && <div className="error-banner" role="alert">{error}</div>}{notice && <div className="success-banner" role="status">{notice}</div>}
    <section className="card">{loading ? <p role="status">Loading returns…</p> : <DataTable columns={columns} data={rows} onRowClick={openDetails} />}{!loading && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}</section>
    {selected && <section className="card detail-section"><div className="section-heading"><div><h2 className="section-title">{selected.returnNumber}</h2><p className="muted-copy">{selected.order?.orderNumber} · {selected.reason}</p></div><StatusBadge status={selected.status} /></div><div className="return-items">{returnItems.map((item) => <div className="return-item" key={item._id}><div><strong>{item.product?.name || item.sku}</strong><small className="table-subtext">{item.sku} · {item.quantity} unit(s)</small></div><StatusBadge status={item.disposition || "PENDING_INSPECTION"} /></div>)}</div>
      {canReceiveInspect && selected.status === "RECEIVED" && <form onSubmit={inspect} className="inspection-form"><h3 className="section-title">Inspect returned items</h3><Select id="return-warehouse" label="Receiving warehouse" required value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} options={[{ value: "", label: "Select warehouse" }, ...warehouses.map((warehouse) => ({ value: warehouse._id, label: `${warehouse.name} (${warehouse.code})` }))]} />{returnItems.map((item) => <div className="inspection-row" key={item._id}><strong>{item.sku} · {item.quantity}</strong><Select id={`condition-${item._id}`} label="Condition" value={inspection[item._id]?.condition || "UNOPENED"} onChange={(event) => setInspection({ ...inspection, [item._id]: { ...inspection[item._id], condition: event.target.value } })} options={CONDITIONS.map((value) => ({ value, label: value.replaceAll("_", " ") }))} /><Select id={`disposition-${item._id}`} label="Disposition" value={inspection[item._id]?.disposition || "RESTOCK"} onChange={(event) => setInspection({ ...inspection, [item._id]: { ...inspection[item._id], disposition: event.target.value } })} options={DISPOSITIONS.map((value) => ({ value, label: value }))} /></div>)}<Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save inspection"}</Button></form>}
    </section>}
    {createOpen && <div className="modal-backdrop"><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="initiate-return-title"><div className="section-heading"><h2 className="section-title" id="initiate-return-title">Initiate return</h2><button className="icon-button" type="button" aria-label="Close" onClick={() => setCreateOpen(false)}>×</button></div><form onSubmit={initiate}><Select id="return-order" label="Delivered order" required value={orderId} onChange={(event) => setOrderId(event.target.value)} options={[{ value: "", label: orders.length ? "Select order" : "No delivered orders found" }, ...orders.map((order) => ({ value: order._id, label: `${order.orderNumber} · ${order.customer?.name || "Customer"}` }))]} /><Input id="return-reason" label="Reason" required value={reason} onChange={(event) => setReason(event.target.value)} /><p className="muted-copy">All order lines will be included. Item quantities can be limited during inspection.</p><div className="action-row"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={saving || !orders.length}>{saving ? "Submitting…" : "Submit request"}</Button></div></form></section></div>}
    {resolutionOpen && selected && <div className="modal-backdrop"><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="resolve-return-title"><div className="section-heading"><h2 className="section-title" id="resolve-return-title">Resolve {selected.returnNumber}</h2><button className="icon-button" type="button" aria-label="Close" onClick={() => setResolutionOpen(false)}>×</button></div><form onSubmit={resolve}><Select id="resolution-type" label="Resolution" value={resolutionType} onChange={(event) => setResolutionType(event.target.value)} options={[{ value: "REFUND", label: "Refund" }, { value: "REPLACE", label: "Replacement" }]} />{resolutionType === "REFUND" ? <Input id="refund-amount" label="Refund amount" type="number" min="0" max={selected.order?.totalAmount} step="0.01" value={refundAmount || selected.order?.totalAmount || ""} onChange={(event) => setRefundAmount(event.target.value)} required /> : <Input id="replacement-order-id" label="Replacement order ID" required value={replacementOrderId} onChange={(event) => setReplacementOrderId(event.target.value)} />}<div className="action-row"><Button type="button" variant="outline" onClick={() => setResolutionOpen(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Confirm resolution"}</Button></div></form></section></div>}
  </div>;
};

export default Returns;
