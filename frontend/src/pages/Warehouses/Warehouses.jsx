import React, { useEffect, useState } from "react";
import { userAPI, warehouseAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import DataTable from "../../components/ui/DataTable";
import Button from "../../components/forms/Button";
import Input from "../../components/forms/Input";
import Select from "../../components/forms/Select";

const EMPTY_WAREHOUSE = { name: "", code: "", street: "", city: "", state: "", postalCode: "", country: "India", manager: "", capacity: "" };
const EMPTY_LOCATION = { aisle: "", rack: "", bin: "", zone: "", shelf: "", locationType: "PICKING" };

export const Warehouses = () => {
  const { user } = useAuth();
  const canManageWarehouses = ["SUPER_ADMIN", "ADMIN"].includes(user?.role);
  const canAddLocations = canManageWarehouses || user?.role === "WAREHOUSE_MANAGER";
  const [warehouses, setWarehouses] = useState([]);
  const [managers, setManagers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [locations, setLocations] = useState([]);
  const [warehouseForm, setWarehouseForm] = useState(EMPTY_WAREHOUSE);
  const [locationForm, setLocationForm] = useState(EMPTY_LOCATION);
  const [warehouseDialog, setWarehouseDialog] = useState(false);
  const [locationDialog, setLocationDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadWarehouses = async () => {
    setLoading(true);
    try {
      const [warehouseResponse, managerResponse] = await Promise.all([
        warehouseAPI.getAll(),
        canManageWarehouses ? userAPI.getAll({ role: "WAREHOUSE_MANAGER", limit: 100 }) : Promise.resolve({ data: { users: [] } }),
      ]);
      setWarehouses(Array.isArray(warehouseResponse?.data) ? warehouseResponse.data : []);
      setManagers(managerResponse?.data?.users || []);
      setError("");
    } catch (err) { setError(err?.message || "Unable to load warehouse records."); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadWarehouses(); }, []);

  const selectWarehouse = async (warehouse) => {
    setSelected(warehouse);
    try {
      const response = await warehouseAPI.getLocations(warehouse._id);
      setLocations(Array.isArray(response?.data) ? response.data : []);
      setError("");
    } catch (err) { setLocations([]); setError(err?.message || "Unable to load warehouse locations."); }
  };

  const openCreate = () => { setEditingId(null); setWarehouseForm(EMPTY_WAREHOUSE); setWarehouseDialog(true); };
  const openEdit = (warehouse) => {
    setWarehouseForm({ name: warehouse.name || "", code: warehouse.code || "", street: warehouse.address?.street || "", city: warehouse.address?.city || "", state: warehouse.address?.state || "", postalCode: warehouse.address?.postalCode || "", country: warehouse.address?.country || "India", manager: warehouse.manager?._id || warehouse.manager || "", capacity: warehouse.capacity ?? "" });
    setSelected(warehouse); setEditingId(warehouse._id); setWarehouseDialog(true);
  };
  const saveWarehouse = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    const { street, city, state, postalCode, country, ...fields } = warehouseForm;
    const payload = { ...fields, capacity: Number(fields.capacity), manager: fields.manager || null, address: { street, city, state, postalCode, country } };
    try {
      if (editingId) await warehouseAPI.update(editingId, payload);
      else await warehouseAPI.create(payload);
      setWarehouseDialog(false); setSelected(null); await loadWarehouses();
    } catch (err) { setError(err?.message || "Unable to save warehouse."); }
    finally { setSaving(false); }
  };
  const deactivate = async (warehouse) => {
    if (!window.confirm(`Deactivate ${warehouse.name}?`)) return;
    try { await warehouseAPI.delete(warehouse._id); await loadWarehouses(); if (selected?._id === warehouse._id) setSelected(null); }
    catch (err) { setError(err?.message || "Unable to deactivate warehouse."); }
  };
  const saveLocation = async (event) => {
    event.preventDefault(); if (!selected) return;
    setSaving(true); setError("");
    try {
      await warehouseAPI.createLocation(selected._id, locationForm);
      const response = await warehouseAPI.getLocations(selected._id);
      setLocations(response?.data || []); setLocationDialog(false); setLocationForm(EMPTY_LOCATION);
    } catch (err) { setError(err?.message || "Unable to create warehouse location."); }
    finally { setSaving(false); }
  };

  const warehouseColumns = [
    { header: "Code", accessor: "code" }, { header: "Warehouse", accessor: "name" },
    { header: "Location", accessor: "address", render: (row) => `${row.address?.city || ""}, ${row.address?.state || ""}` },
    { header: "Manager", accessor: "manager", render: (row) => row.manager?.name || "Unassigned" },
    { header: "Capacity", accessor: "capacity", render: (row) => Number(row.capacity || 0).toLocaleString() },
    { header: "Status", accessor: "status" },
    { header: "Actions", accessor: "_id", render: (row) => canManageWarehouses ? <div className="action-row"><Button variant="outline" onClick={() => openEdit(row)}>Edit</Button><Button variant="danger" onClick={() => deactivate(row)}>Deactivate</Button></div> : "—" },
  ];
  const locationColumns = [
    { header: "Code", accessor: "code" }, { header: "Zone", accessor: "zone" }, { header: "Aisle", accessor: "aisle" },
    { header: "Rack", accessor: "rack" }, { header: "Shelf", accessor: "shelf" }, { header: "Bin", accessor: "bin" }, { header: "Type", accessor: "locationType" },
  ];

  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">Warehouse Management</h1><p className="page-subtitle">Facilities, assigned managers, and bin locations</p></div>{canManageWarehouses && <Button variant="primary" onClick={openCreate}>Add warehouse</Button>}</div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      <section className="card"><h2 className="section-title">Facilities</h2>{loading ? <p role="status">Loading warehouses…</p> : <DataTable columns={warehouseColumns} data={warehouses} onRowClick={selectWarehouse} />}</section>
      <section className="card location-section"><div className="section-heading"><div><h2 className="section-title">Locations</h2><p className="muted-copy">{selected?.name || "Select a warehouse to view its locations"}</p></div>{selected && canAddLocations && <Button variant="outline" onClick={() => { setLocationForm(EMPTY_LOCATION); setLocationDialog(true); }}>Add location</Button>}</div>{selected && <DataTable columns={locationColumns} data={locations} />}</section>
      {warehouseDialog && <div className="modal-backdrop"><section className="modal-panel modal-wide" role="dialog" aria-modal="true" aria-labelledby="warehouse-form-title"><div className="section-heading"><h2 className="section-title" id="warehouse-form-title">{selected ? "Edit warehouse" : "Add warehouse"}</h2><button className="icon-button" type="button" aria-label="Close" onClick={() => setWarehouseDialog(false)}>×</button></div><form onSubmit={saveWarehouse}><div className="form-grid"><Input id="wh-name" label="Name" required value={warehouseForm.name} onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })} /><Input id="wh-code" label="Code" required value={warehouseForm.code} onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value })} /><Input id="wh-street" label="Street" required value={warehouseForm.street} onChange={(e) => setWarehouseForm({ ...warehouseForm, street: e.target.value })} /><Input id="wh-city" label="City" required value={warehouseForm.city} onChange={(e) => setWarehouseForm({ ...warehouseForm, city: e.target.value })} /><Input id="wh-state" label="State" required value={warehouseForm.state} onChange={(e) => setWarehouseForm({ ...warehouseForm, state: e.target.value })} /><Input id="wh-postal" label="Postal code" required value={warehouseForm.postalCode} onChange={(e) => setWarehouseForm({ ...warehouseForm, postalCode: e.target.value })} /><Input id="wh-country" label="Country" required value={warehouseForm.country} onChange={(e) => setWarehouseForm({ ...warehouseForm, country: e.target.value })} /><Input id="wh-capacity" label="Capacity" type="number" min="0" required value={warehouseForm.capacity} onChange={(e) => setWarehouseForm({ ...warehouseForm, capacity: e.target.value })} /><Select id="wh-manager" label="Manager" value={warehouseForm.manager} onChange={(e) => setWarehouseForm({ ...warehouseForm, manager: e.target.value })} options={[{ value: "", label: "Unassigned" }, ...managers.map((manager) => ({ value: manager._id, label: manager.name }))]} /></div><div className="action-row"><Button type="button" variant="outline" onClick={() => setWarehouseDialog(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save warehouse"}</Button></div></form></section></div>}
      {locationDialog && <div className="modal-backdrop"><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="location-form-title"><div className="section-heading"><h2 className="section-title" id="location-form-title">Add location</h2><button className="icon-button" type="button" aria-label="Close" onClick={() => setLocationDialog(false)}>×</button></div><form onSubmit={saveLocation}><Input id="loc-aisle" label="Aisle" required value={locationForm.aisle} onChange={(e) => setLocationForm({ ...locationForm, aisle: e.target.value })} /><Input id="loc-rack" label="Rack" required value={locationForm.rack} onChange={(e) => setLocationForm({ ...locationForm, rack: e.target.value })} /><Input id="loc-bin" label="Bin" required value={locationForm.bin} onChange={(e) => setLocationForm({ ...locationForm, bin: e.target.value })} /><Input id="loc-zone" label="Zone" value={locationForm.zone} onChange={(e) => setLocationForm({ ...locationForm, zone: e.target.value })} /><Input id="loc-shelf" label="Shelf" value={locationForm.shelf} onChange={(e) => setLocationForm({ ...locationForm, shelf: e.target.value })} /><Select id="loc-type" label="Location type" value={locationForm.locationType} onChange={(e) => setLocationForm({ ...locationForm, locationType: e.target.value })} options={[{ value: "PICKING", label: "Picking" }, { value: "RECEIVING", label: "Receiving" }, { value: "STORAGE", label: "Storage" }, { value: "SHIPPING", label: "Shipping" }]} /><div className="action-row"><Button type="button" variant="outline" onClick={() => setLocationDialog(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Create location"}</Button></div></form></section></div>}
    </div>
  );
};

export default Warehouses;
