import React, { useEffect, useState } from "react";
import { inventoryAPI, warehouseAPI } from "../../services/api";
import DataTable from "../../components/ui/DataTable";
import Button from "../../components/forms/Button";
import Pagination from "../../components/ui/Pagination";
import Input from "../../components/forms/Input";
import Select from "../../components/forms/Select";
import { useAuth } from "../../context/AuthContext";

const EMPTY_ADJUSTMENT = { adjustmentType: "INCREASE", quantity: "", reason: "" };

export const Inventory = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [adjustment, setAdjustment] = useState(EMPTY_ADJUSTMENT);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const [inventoryResponse, warehouseResponse] = await Promise.all([
        inventoryAPI.getLevels({ page, limit: 15, warehouseId: warehouseId || undefined, lowStock: lowStock || undefined }),
        warehouseAPI.getAll(),
      ]);
      setRecords(inventoryResponse?.data?.inventory || []);
      setTotalPages(inventoryResponse?.data?.pagination?.totalPages || 1);
      setWarehouses(Array.isArray(warehouseResponse?.data) ? warehouseResponse.data : []);
      setError("");
    } catch (err) { setError(err?.message || "Unable to load inventory."); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadInventory(); }, [page, warehouseId, lowStock]);

  const saveAdjustment = async (event) => {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      await inventoryAPI.adjustStock(selected._id, adjustment);
      setSelected(null); setAdjustment(EMPTY_ADJUSTMENT);
      await loadInventory();
    } catch (err) { setError(err?.message || "Unable to adjust stock."); }
    finally { setSaving(false); }
  };

  const columns = [
    { header: "Product / SKU", accessor: "product", render: (row) => <><strong>{row.product?.name || "Unknown product"}</strong><small className="table-subtext">{row.product?.sku || "—"}</small></> },
    { header: "Warehouse", accessor: "warehouse", render: (row) => row.warehouse?.name || "—" },
    { header: "Location", accessor: "location", render: (row) => row.location?.code || "—" },
    { header: "Available", accessor: "available" },
    { header: "Reserved", accessor: "reserved" },
    { header: "Damaged", accessor: "damaged" },
    { header: "Returned", accessor: "returned" },
    { header: "", accessor: "_id", render: (row) => {
      const warehouseId = row.warehouse?._id || row.warehouse;
      const canAdjust = ["SUPER_ADMIN", "ADMIN"].includes(user?.role) || (user?.role === "WAREHOUSE_MANAGER" && String(user.assignedWarehouse?._id || user.assignedWarehouse) === String(warehouseId));
      return canAdjust ? <Button variant="outline" onClick={() => { setSelected(row); setAdjustment(EMPTY_ADJUSTMENT); }}>Adjust</Button> : "—";
    } },
  ];

  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">Inventory Control</h1><p className="page-subtitle">Stock levels and auditable warehouse adjustments</p></div></div>
      <section className="card">
        <div className="filter-grid">
          <Select id="warehouse-filter" label="Warehouse" value={warehouseId} onChange={(event) => { setWarehouseId(event.target.value); setPage(1); }} options={[{ value: "", label: "All warehouses" }, ...warehouses.map((warehouse) => ({ value: warehouse._id, label: `${warehouse.name} (${warehouse.code})` }))]} />
          <label className="check-filter"><input type="checkbox" checked={lowStock} onChange={(event) => { setLowStock(event.target.checked); setPage(1); }} /> Low stock only</label>
        </div>
        {error && <div className="error-banner" role="alert">{error}</div>}
        {loading ? <p role="status" className="loading-state">Loading inventory…</p> : <DataTable columns={columns} data={records} />}
        {!loading && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
      </section>
      {selected && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="adjust-title"><div className="section-heading"><h2 className="section-title" id="adjust-title">Adjust {selected.product?.sku || "inventory"}</h2><button className="icon-button" type="button" aria-label="Close" onClick={() => setSelected(null)}>×</button></div><form onSubmit={saveAdjustment}><Select id="adjustment-type" label="Adjustment" value={adjustment.adjustmentType} onChange={(event) => setAdjustment({ ...adjustment, adjustmentType: event.target.value })} options={[{ value: "INCREASE", label: "Increase available" }, { value: "DECREASE", label: "Decrease available" }, { value: "DAMAGE", label: "Mark damaged" }, { value: "RESTOCK", label: "Restock" }]} /><Input id="adjust-quantity" label="Quantity" type="number" min="1" step="1" required value={adjustment.quantity} onChange={(event) => setAdjustment({ ...adjustment, quantity: event.target.value })} /><Input id="adjust-reason" label="Reason" required minLength="3" value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })} /><div className="action-row"><Button type="button" variant="outline" onClick={() => setSelected(null)}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Apply adjustment"}</Button></div></form></section></div>}
    </div>
  );
};

export default Inventory;
