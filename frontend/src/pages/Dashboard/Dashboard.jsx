import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { analyticsAPI, orderAPI } from "../../services/api";
import DataTable from "../../components/ui/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import SimpleChart from "../../components/ui/SimpleChart";

const initialState = { dashboard: null, orders: [], loading: true, error: "" };
const currency = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

export const Dashboard = () => {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    let active = true;
    Promise.all([analyticsAPI.getDashboard(), orderAPI.getAll({ page: 1, limit: 6 })])
      .then(([dashboardResponse, ordersResponse]) => {
        if (!active) return;
        setState({
          dashboard: dashboardResponse?.data || null,
          orders: ordersResponse?.data?.orders || [],
          loading: false,
          error: "",
        });
      })
      .catch((error) => {
        if (active) setState({ ...initialState, loading: false, error: error?.message || "Unable to load dashboard data." });
      });
    return () => { active = false; };
  }, []);

  const { dashboard, orders, loading, error } = state;
  const overview = dashboard?.overview || {};
  const columns = [
    { header: "Order", accessor: "orderNumber" },
    { header: "Customer", accessor: "customer", render: (row) => row.customer?.name || "Direct Customer" },
    { header: "Warehouse", accessor: "warehouse", render: (row) => row.warehouse?.name || "Unassigned" },
    { header: "Total", accessor: "totalAmount", render: (row) => currency(row.totalAmount) },
    { header: "Status", accessor: "status", render: (row) => <StatusBadge status={row.status} /> },
  ];

  if (loading) return <div className="page-wrapper"><p role="status">Loading dashboard…</p></div>;
  if (error) return <div className="page-wrapper"><div className="error-banner" role="alert">{error}</div><button className="btn btn-outline" onClick={() => window.location.reload()}>Retry</button></div>;

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Fulfillment Command Center</h1><p className="page-subtitle">Order flow, warehouse throughput, and delivery performance</p></div>
        <Link className="btn btn-outline" to="/analytics">View analytics</Link>
      </div>
      <div className="metrics-grid">
        {[
          ["Total orders", overview.totalOrders],
          ["Open pipeline", overview.pendingOrders],
          ["Orders today", overview.ordersToday],
          ["Delivered", overview.deliveredCount],
          ["Awaiting pick", dashboard?.ordersAwaitingStation?.awaitingPicking],
          ["Awaiting pack", dashboard?.ordersAwaitingStation?.awaitingPacking],
          ["Failed deliveries", overview.failedDeliveries],
          ["Open returns", overview.returnRequestsCount],
        ].map(([label, value]) => <div className="metric-card" key={label}><div className="metric-title">{label}</div><div className="metric-value">{Number(value || 0).toLocaleString("en-IN")}</div></div>)}
      </div>
      <div className="charts-grid">
        <SimpleChart title="Orders by status" data={dashboard?.ordersByStatus} labelKey="status" valueKey="count" />
        <SimpleChart title="Orders over time" data={dashboard?.ordersOverTime} labelKey="date" valueKey="count" type="line" />
        <SimpleChart title="Warehouse performance · orders" data={dashboard?.warehousePerformance} labelKey="name" valueKey="totalOrders" />
        <SimpleChart title="Delivery performance · delivered orders" data={dashboard?.warehousePerformance} labelKey="name" valueKey="deliveredOrders" />
        <SimpleChart title="Return reasons" data={dashboard?.returnReasonsBreakdown} labelKey="reason" valueKey="count" />
        <SimpleChart title="Inventory available by warehouse" data={dashboard?.inventoryLevels} labelKey="name" valueKey="available" />
        <SimpleChart title="Carrier performance · shipments" data={dashboard?.carrierPerformance} labelKey="name" valueKey="totalShipments" />
        <section className="card performance-summary">
          <h2 className="section-title">Delivery service level</h2>
          <strong className="metric-value">{Number(dashboard?.deliveryPerformance?.onTimeDeliveryRatePercent || 0).toFixed(1)}%</strong>
          <p>On-time delivery rate</p>
          <p>Average confirmed-to-delivered: {Number(dashboard?.deliveryPerformance?.avgDaysConfirmedToDelivered || 0).toFixed(1)} days</p>
        </section>
      </div>
      <section className="card dashboard-orders">
        <div className="section-heading"><h2 className="section-title">Recent orders</h2><Link to="/orders">All orders</Link></div>
        <DataTable columns={columns} data={orders} onRowClick={(row) => { window.location.href = `/orders/${row._id}`; }} />
      </section>
    </div>
  );
};

export default Dashboard;
