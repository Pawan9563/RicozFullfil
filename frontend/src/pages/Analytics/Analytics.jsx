import React, { useEffect, useState } from "react";
import { analyticsAPI } from "../../services/api";
import SimpleChart from "../../components/ui/SimpleChart";

export const Analytics = () => {
  const [dashboard, setDashboard] = useState(null);
  const [throughput, setThroughput] = useState(null);
  const [times, setTimes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([analyticsAPI.getDashboard(), analyticsAPI.getThroughput(), analyticsAPI.getFulfillmentTimes()])
      .then(([dashboardResponse, throughputResponse, timeResponse]) => {
        if (!active) return;
        setDashboard(dashboardResponse?.data || null);
        setThroughput(throughputResponse?.data || null);
        setTimes(timeResponse?.data || null);
      })
      .catch((err) => active && setError(err?.message || "Unable to load analytics."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  if (loading) return <p role="status" className="loading-state">Loading analytics…</p>;
  if (error) return <div className="error-banner" role="alert">{error}</div>;
  const durationData = [
    { stage: "Picking (min)", value: times?.avgTimeToPickMinutes || 0 },
    { stage: "Packing (min)", value: times?.avgTimeToPackMinutes || 0 },
    { stage: "Dispatch (hr)", value: times?.avgTimeToDispatchHours || 0 },
    { stage: "Delivery (days)", value: times?.avgTimeToDeliverDays || 0 },
  ];

  return <div>
    <div className="page-header"><div><h1 className="page-title">Fulfillment Analytics</h1><p className="page-subtitle">Operational volume, service levels, stock risk, and carrier outcomes</p></div></div>
    <div className="metrics-grid">
      {[
        ["Orders", dashboard?.overview?.totalOrders],
        ["Pending pipeline", dashboard?.overview?.pendingOrders],
        ["Orders today", dashboard?.overview?.ordersToday],
        ["On-time delivery", `${Number(dashboard?.deliveryPerformance?.onTimeDeliveryRatePercent || 0).toFixed(1)}%`],
        ["Picks / hour", Number(throughput?.picksPerHour || 0).toFixed(0)],
        ["Packs / hour", Number(throughput?.packsPerHour || 0).toFixed(0)],
        ["Pick accuracy", `${Number(throughput?.pickCompletionPercent || 0).toFixed(1)}%`],
        ["Avg. delivery days", times?.avgTimeToDeliverDays != null ? Number(times.avgTimeToDeliverDays).toFixed(1) : "—"],
      ].map(([label, value]) => <div className="metric-card" key={label}><div className="metric-title">{label}</div><div className="metric-value">{value ?? "—"}</div></div>)}
    </div>
    <div className="charts-grid">
      <SimpleChart title="Order volume by status" data={dashboard?.ordersByStatus} labelKey="status" valueKey="count" />
      <SimpleChart title="Orders over time" data={dashboard?.ordersOverTime} labelKey="date" valueKey="count" type="line" />
      <SimpleChart title="Warehouse throughput" data={dashboard?.warehousePerformance} labelKey="name" valueKey="totalOrders" />
      <SimpleChart title="Delivery by warehouse" data={dashboard?.warehousePerformance} labelKey="name" valueKey="deliveredOrders" />
      <SimpleChart title="Returns by reason" data={dashboard?.returnReasonsBreakdown} labelKey="reason" valueKey="count" />
      <SimpleChart title="Carrier shipment volume" data={dashboard?.carrierPerformance} labelKey="name" valueKey="totalShipments" />
      <SimpleChart title="Fulfillment durations" data={durationData} labelKey="stage" valueKey="value" />
      <SimpleChart title="Available inventory by warehouse" data={dashboard?.inventoryLevels} labelKey="name" valueKey="available" />
    </div>
  </div>;
};

export default Analytics;
