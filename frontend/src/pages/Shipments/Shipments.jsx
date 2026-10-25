import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { packageAPI, shipmentAPI } from "../../services/api";
import DataTable from "../../components/ui/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/forms/Button";
import Select from "../../components/forms/Select";
import Input from "../../components/forms/Input";
import Pagination from "../../components/ui/Pagination";

const SHIPMENT_STATUSES = ["CREATED", "CARRIER_ASSIGNED", "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED_DELIVERY", "CANCELLED"];

export const Shipments = () => {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState([]);
  const [packages, setPackages] = useState([]);
  const [carriers, setCarriers] = useState([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [packageId, setPackageId] = useState("");
  const [carrierId, setCarrierId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadShipments = async () => {
    setLoading(true);
    try {
      const response = await shipmentAPI.getAll({ page, limit: 10, status: status || undefined });
      setShipments(response?.data?.shipments || []);
      setTotalPages(response?.data?.pagination?.totalPages || 1);
      setError("");
    } catch (err) { setError(err?.message || "Unable to load shipments."); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadShipments(); }, [page, status]);
  const openCreate = async () => {
    setCreateOpen(true); setError("");
    try {
      const [packagesResponse, carriersResponse] = await Promise.all([packageAPI.getAll({ status: "PACKED" }), shipmentAPI.getCarriers()]);
      setPackages((packagesResponse?.data || []).filter((pkg) => pkg.status === "PACKED" && pkg.order));
      setCarriers(carriersResponse?.data || []);
    } catch (err) { setError(err?.message || "Unable to load packed packages."); }
  };
  const createShipment = async (event) => {
    event.preventDefault();
    const pkg = packages.find((item) => item._id === packageId);
    if (!pkg) return;
    setSaving(true); setError("");
    try {
      await shipmentAPI.create({ orderId: pkg.order._id || pkg.order, packageId: pkg._id, carrierId: carrierId || undefined, trackingNumber: trackingNumber || undefined });
      setCreateOpen(false); setPackageId(""); setCarrierId(""); setTrackingNumber(""); await loadShipments();
    } catch (err) { setError(err?.message || "Unable to create shipment."); }
    finally { setSaving(false); }
  };

  const columns = [
    { header: "Shipment", accessor: "shipmentNumber" },
    { header: "Order", accessor: "order", render: (row) => row.order?.orderNumber || "—" },
    { header: "Carrier", accessor: "carrier", render: (row) => row.carrier?.name || "Unassigned" },
    { header: "Tracking number", accessor: "trackingId", render: (row) => row.trackingId || row.trackingNumber || "—" },
    { header: "Status", accessor: "status", render: (row) => <StatusBadge status={row.status} /> },
    { header: "Dispatched", accessor: "dispatchedAt", render: (row) => row.dispatchedAt ? new Date(row.dispatchedAt).toLocaleDateString() : "—" },
  ];

  return <div>
    <div className="page-header"><div><h1 className="page-title">Outbound Shipments</h1><p className="page-subtitle">Shipment manifests, carrier handoff, and delivery progress</p></div><Button variant="primary" onClick={openCreate}>Create shipment</Button></div>
    <section className="card"><div className="filter-grid compact-filter"><Select id="shipment-status" label="Status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} options={[{ value: "", label: "All statuses" }, ...SHIPMENT_STATUSES.map((value) => ({ value, label: value.replaceAll("_", " ") }))]} /></div>{error && <div className="error-banner" role="alert">{error}</div>}{loading ? <p role="status">Loading shipments…</p> : <DataTable columns={columns} data={shipments} onRowClick={(row) => navigate(`/shipments/${row._id}/tracking`)} />}{!loading && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}</section>
    {createOpen && <div className="modal-backdrop"><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="create-shipment-title"><div className="section-heading"><h2 className="section-title" id="create-shipment-title">Create shipment</h2><button className="icon-button" type="button" aria-label="Close" onClick={() => setCreateOpen(false)}>×</button></div><form onSubmit={createShipment}><Select id="shipment-package" label="Sealed package" required value={packageId} onChange={(event) => setPackageId(event.target.value)} options={[{ value: "", label: packages.length ? "Select a package" : "No packed packages available" }, ...packages.map((pkg) => ({ value: pkg._id, label: `${pkg.order?.orderNumber || "Order"} · ${pkg.packageNumber}` }))]} /><Select id="shipment-carrier" label="Carrier (optional)" value={carrierId} onChange={(event) => setCarrierId(event.target.value)} options={[{ value: "", label: "Assign later" }, ...carriers.map((carrier) => ({ value: carrier._id, label: `${carrier.name}${carrier.code ? ` (${carrier.code})` : ""}` }))]} />{carrierId && <Input id="shipment-tracking" label="Tracking number" required value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} />}<div className="action-row"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={saving || !packages.length}>{saving ? "Creating…" : "Create shipment"}</Button></div></form></section></div>}
  </div>;
};

export default Shipments;
