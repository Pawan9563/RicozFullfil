import React, { useDeferredValue, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { orderAPI } from "../../services/api";
import DataTable from "../../components/ui/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import Select from "../../components/forms/Select";
import Pagination from "../../components/ui/Pagination";
import Input from "../../components/forms/Input";

const STATUSES = ["ORDER_CREATED", "CONFIRMED", "INVENTORY_CHECK", "WAREHOUSE_ALLOCATION", "PICK_LIST_CREATED", "PICKING", "PICKED", "PACKING", "PACKED", "SHIPMENT_CREATED", "CARRIER_ASSIGNED", "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "FAILED_DELIVERY"];
const currency = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

export const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim());
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    orderAPI.getAll({ page, limit: 10, status: status || undefined, date: date || undefined, search: query || undefined })
      .then((response) => {
        if (!active) return;
        setOrders(response?.data?.orders || []);
        setTotalPages(response?.data?.pagination?.totalPages || 1);
        setError("");
      })
      .catch((err) => active && setError(err?.message || "Unable to load orders."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [page, status, date, query]);

  const columns = [
    { header: "Order #", accessor: "orderNumber" },
    { header: "Customer", accessor: "customer", render: (row) => row.customer?.name || "Direct customer" },
    { header: "Warehouse", accessor: "warehouse", render: (row) => row.warehouse?.name || "Unassigned" },
    { header: "Amount", accessor: "totalAmount", render: (row) => currency(row.totalAmount) },
    { header: "Status", accessor: "status", render: (row) => <StatusBadge status={row.status} /> },
    { header: "Created", accessor: "createdAt", render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString() : "—" },
  ];

  const clearFilters = () => { setSearch(""); setStatus(""); setDate(""); setPage(1); };

  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">Order Management</h1><p className="page-subtitle">Search and track customer orders through fulfillment</p></div></div>
      <section className="card">
        <div className="filter-grid">
          <Input id="order-search" label="Search order" type="search" placeholder="Order number" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          <Select id="order-status" label="Status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} options={[{ value: "", label: "All statuses" }, ...STATUSES.map((value) => ({ value, label: value.replaceAll("_", " ") }))]} />
          <Input id="order-date" label="Created date" type="date" value={date} onChange={(event) => { setDate(event.target.value); setPage(1); }} />
          <button type="button" className="btn btn-outline filter-clear" onClick={clearFilters}>Clear filters</button>
        </div>
        {error && <div className="error-banner" role="alert">{error}</div>}
        {loading ? <p role="status" className="loading-state">Loading orders…</p> : <DataTable columns={columns} data={orders} onRowClick={(row) => navigate(`/orders/${row._id}`)} />}
        {!loading && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
      </section>
    </div>
  );
};

export default Orders;
