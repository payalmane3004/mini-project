import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, AlertTriangle, ArrowRight, Bell, Building2, CalendarDays, ClipboardCheck,
  DoorOpen, Map, RefreshCw, Users, Wrench, Zap,
} from "lucide-react";
import { fetchAnalyticsSummary } from "../../api/analytics";
import { fetchAdminAlerts, fetchAdminBookings } from "../../api/admin";
import { useDemoMode } from "../../components/layout/useDemoMode";
import {
  aggregateHourlyOccupancy, recentCampusRecords,
  validateAdminAlertList, validateAdminBookingList,
} from "../../api/analyticsDashboardData";
import { countCurrentAlerts, countPendingBookings, getDashboardMetricValue } from "./dashboardData";
import "./Dashboard.css";

const numberFormat = new Intl.NumberFormat();
const metricDefinitions = [
  { label: "Buildings", key: "buildings_total", Icon: Building2, detail: "Database building records", href: "/buildings" },
  { label: "Verified rooms", key: "verified_rooms_total", Icon: DoorOpen, detail: "Database room records", href: "/rooms" },
  { label: "Pending bookings", key: "pending_bookings", Icon: CalendarDays, detail: "Requests awaiting review", href: "/booking" },
  { label: "Occupancy readings", key: "occupancy_readings_total", Icon: Users, detail: "Stored readings in period", href: "/occupancy" },
  { label: "Energy readings", key: "energy_readings_total", Icon: Zap, detail: "Stored readings in period", href: "/energy" },
  { label: "Open maintenance", key: "maintenance_open_total", Icon: Wrench, detail: "Open stored requests", href: "/maintenance" },
  { label: "Active alerts", key: "active_alerts", Icon: Bell, detail: "Enabled and unexpired", href: "/emergency" },
];

function displaySource(source) {
  if (!source) return "Source unavailable";
  const normalized = source.toUpperCase();
  if (normalized.includes("SIMULAT")) return "Simulated data";
  if (normalized.includes("RECORDED_VIDEO")) return "Recorded video";
  return source;
}

function formatTime(timestamp, options = {}) {
  if (!timestamp) return "Time unavailable";
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString([], options);
}

function MetricCard({ metric, value }) {
  const { Icon, label, key, detail, href } = metric;
  const emptyText = {
    buildings_total: "No building records available",
    verified_rooms_total: "No room records available",
    pending_bookings: "No pending requests",
    occupancy_readings_total: "No readings available yet",
    energy_readings_total: "No readings available yet",
    maintenance_open_total: "No open requests",
    active_alerts: "No active alerts",
  }[key];
  const content = <>
    <span className="dashboard-metric-icon" aria-hidden="true"><Icon size={18} strokeWidth={1.9}/></span>
    <span className="dashboard-metric-label">{label}</span>
    <strong>{value.available ? numberFormat.format(value.value) : "—"}</strong>
    <small>{value.available ? (value.value === 0 ? emptyText : detail) : "Unavailable"}</small>
  </>;
  return href && value.available
    ? <Link className="dashboard-metric-card dashboard-metric-link" to={href} aria-label={`${label}: ${numberFormat.format(value.value)}. ${value.value === 0 ? emptyText : detail}. Open ${label.toLowerCase()}`}>
      {content}<span className="dashboard-metric-arrow" aria-hidden="true"><ArrowRight size={15}/></span>
    </Link>
    : <article className="dashboard-metric-card">{content}</article>;
}

function Panel({ title, description, action, children, className = "" }) {
  return <section className={`dashboard-panel ${className}`}>
    <header className="dashboard-panel-heading"><div><h2>{title}</h2><p>{description}</p></div>{action}</header>
    {children}
  </section>;
}

function DataState({ loading, error, empty, children, retry }) {
  if (loading) return <p className="dashboard-inline-state" role="status">Loading stored records…</p>;
  if (error) return <div className="dashboard-inline-error" role="alert"><span>{error}</span>{retry && <button type="button" onClick={retry}><RefreshCw size={14}/> Retry</button>}</div>;
  if (empty) return <p className="dashboard-empty-state" role="status">{empty}</p>;
  return children;
}

function EnergyScatterChart({ data }) {
  return <ResponsiveContainer width="100%" height="100%">
    <ScatterChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
      <CartesianGrid stroke="#263441" strokeDasharray="3 4" vertical={false}/>
      <XAxis type="number" dataKey="timestamp" domain={["dataMin", "dataMax"]} tickFormatter={(value) => formatTime(value, { month: "short", day: "numeric" })} tick={{ fill: "#91a3b6", fontSize: 10 }} axisLine={false} tickLine={false}/>
      <YAxis tick={{ fill: "#91a3b6", fontSize: 10 }} axisLine={false} tickLine={false}/>
      <Tooltip contentStyle={{ background: "#17212b", border: "1px solid #344552", borderRadius: 7, color: "#e4edf4" }} formatter={(value) => [`${value} kWh`, "Individual reading"]} labelFormatter={(timestamp, items) => `${formatTime(timestamp)}${items[0]?.payload?.building ? ` · ${items[0].payload.building}` : ""}${items[0]?.payload?.source ? ` · ${items[0].payload.source}` : ""}`}/>
      <Scatter dataKey="energy" fill="#54b6c7" shape="circle"/>
    </ScatterChart>
  </ResponsiveContainer>;
}

export default function Dashboard() {
  const demoMode = useDemoMode();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [summaryState, setSummaryState] = useState({ data: null, error: "", loading: true });
  const [bookingState, setBookingState] = useState({ data: null, error: "", loading: true });
  const [alertState, setAlertState] = useState({ data: null, error: "", loading: true });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchAnalyticsSummary({ start: startDate ? `${startDate}T00:00:00.000Z` : undefined,
      end: endDate ? new Date(new Date(`${endDate}T00:00:00.000Z`).getTime() + 86400000).toISOString() : undefined,
      signal: controller.signal })
      .then((data) => setSummaryState({ data, error: "", loading: false }))
      .catch((error) => {
        if (error.name !== "AbortError") setSummaryState({ data: null, error: "Could not load stored analytics records.", loading: false });
      });
    return () => controller.abort();
  }, [startDate, endDate, retryKey]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(fetchAdminBookings).then(validateAdminBookingList)
      .then((data) => { if (active) setBookingState({ data, error: "", loading: false }); })
      .catch(() => { if (active) setBookingState({ data: null, error: "Could not load booking records.", loading: false }); });
    Promise.resolve().then(fetchAdminAlerts).then(validateAdminAlertList)
      .then((data) => { if (active) setAlertState({ data, error: "", loading: false }); })
      .catch(() => { if (active) setAlertState({ data: null, error: "Could not load alert records.", loading: false }); });
    return () => { active = false; };
  }, [retryKey]);

  const activeAlerts = alertState.data ? countCurrentAlerts(alertState.data) : undefined;
  const pendingBookings = bookingState.data ? countPendingBookings(bookingState.data) : undefined;
  const summaryAvailable = Boolean(summaryState.data) && !summaryState.loading;
  const metrics = useMemo(() => {
    const summary = summaryState.data;
    return metricDefinitions.map((metric) => {
      if (metric.key === "active_alerts") return [metric, getDashboardMetricValue(activeAlerts, !alertState.loading && !alertState.error)];
      if (metric.key === "pending_bookings") return [metric, getDashboardMetricValue(pendingBookings, !bookingState.loading && !bookingState.error)];
      return [metric, getDashboardMetricValue(summary?.[metric.key], summaryAvailable)];
    });
  }, [activeAlerts, alertState.error, alertState.loading, bookingState.error, bookingState.loading, pendingBookings, summaryAvailable, summaryState.data]);

  const occupancyChartData = useMemo(() => aggregateHourlyOccupancy(summaryState.data?.occupancy_readings || []).slice(-24).map((bucket) => ({
    ...bucket,
    time: formatTime(bucket.timestamp, { month: "short", day: "numeric", hour: "numeric" }),
  })), [summaryState.data]);
  const energyChartData = useMemo(() => (summaryState.data?.energy_readings || []).filter((reading) => reading.recorded_at && !Number.isNaN(new Date(reading.recorded_at).getTime())).map((reading) => ({
    timestamp: new Date(reading.recorded_at).getTime(),
    energy: Number(reading.energy_kwh),
    building: reading.building_name,
    source: displaySource(reading.source),
  })), [summaryState.data]);
  const recentActivity = useMemo(() => recentCampusRecords(bookingState.data || [], alertState.data || [], 5), [bookingState.data, alertState.data]);

  function chooseRange(days) {
    setSummaryState((state) => ({ ...state, loading: true, error: "" }));
    if (!days) { setStartDate(""); setEndDate(""); return; }
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  }

  function refresh() {
    setSummaryState((state) => ({ ...state, loading: true }));
    setBookingState((state) => ({ ...state, loading: true }));
    setAlertState((state) => ({ ...state, loading: true }));
    setRetryKey((key) => key + 1);
  }

  const summary = summaryState.data;
  const latestOccupancy = summary?.occupancy_readings?.filter((reading) => reading.recorded_at).at(-1);
  const latestEnergy = summary?.energy_readings?.filter((reading) => reading.recorded_at).at(-1);

  return <div className="admin-live-dashboard">
    <header className="dashboard-page-heading">
      <div><span className="dashboard-eyebrow"><Activity size={14} aria-hidden="true"/> CAMPUS OPERATIONS</span><h1>Campus Operations</h1><p>Stored campus records and actions that may need review.</p></div>
      <div className="dashboard-heading-actions"><span className="dashboard-data-badge"><span aria-hidden="true"/> Stored records · no live telemetry</span><Link to="/buildings" className="dashboard-primary-link"><Building2 size={15}/> Building directory</Link></div>
    </header>

    {demoMode && <aside className="dashboard-demo-notice" aria-label="Fictional local demo data notice">
      <strong>DEMO DATA</strong><span>All fixture records are fictional. Occupancy and energy are simulated historical readings, not live sensor data. This mode uses the separate local demo database; the normal team database is unchanged.</span>
    </aside>}

    <div className="dashboard-toolbar">
      <p>Buildings and rooms show current database totals. Reading and maintenance metrics follow the selected date range; bookings and alerts show current records.</p>
      <div className="dashboard-range-control" role="group" aria-label="Reading and maintenance date range">
        <button type="button" aria-pressed={!startDate && !endDate} onClick={() => chooseRange(0)}>All records</button>
        <button type="button" aria-pressed={Boolean(startDate && endDate && Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) === 6)} onClick={() => chooseRange(7)}>7 days</button>
        <button type="button" aria-pressed={Boolean(startDate && endDate && Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) === 29)} onClick={() => chooseRange(30)}>30 days</button>
      </div>
    </div>

    {(summaryState.error || bookingState.error || alertState.error) && <div className="dashboard-load-error" role="alert"><span>Some dashboard data could not be loaded. Available sections remain visible.</span><button type="button" onClick={refresh}><RefreshCw size={15}/> Retry failed data</button></div>}

    <div className="dashboard-metrics" aria-label="Campus summary">
      {metrics.map(([metric, value]) => <MetricCard metric={metric} value={value} key={metric.key}/>) }
    </div>

    <div className="dashboard-main-grid">
      <Panel title="Operations requiring review" description="Bookings and alerts are current; the maintenance count follows the selected date range." action={<Link to="/analytics">Campus intelligence <ArrowRight size={14}/></Link>} className="dashboard-actions-panel">
        <div className="dashboard-action-list">
          <ActionItem icon={CalendarDays} label="Pending room bookings" value={getDashboardMetricValue(pendingBookings, Boolean(bookingState.data))} loading={bookingState.loading} error={bookingState.error} href="/booking" empty="No bookings awaiting review"/>
          <ActionItem icon={AlertTriangle} label="Active emergency alerts" value={getDashboardMetricValue(activeAlerts, Boolean(alertState.data))} loading={alertState.loading} error={alertState.error} href="/emergency" empty="No active alerts"/>
          <ActionItem icon={Wrench} label="Open maintenance requests" value={getDashboardMetricValue(summary?.maintenance_open_total, summaryAvailable)} loading={summaryState.loading} error={summaryState.error} href="/maintenance" empty="No open requests in this range"/>
        </div>
      </Panel>

      <Panel title="Campus map" description="Explore the existing Digital Twin to inspect CAD footprints and verified building records." className="dashboard-map-panel">
        <div className="dashboard-map-link-card"><span aria-hidden="true"><Map size={21}/></span><div><strong>Digital Twin map</strong><small>CAD geometry is distinct from verified database inventory.</small></div><Link to="/digital-twin" aria-label="Open the Digital Twin map"><ArrowRight size={17}/></Link></div>
        <div className="dashboard-map-secondary"><Link to="/buildings">Browse verified buildings <ArrowRight size={13}/></Link></div>
      </Panel>

      <Panel title="Campus trends" description={`Stored readings${summary?.period?.start || summary?.period?.end ? " in the selected date range" : " across all available dates"}. Occupancy is an hourly average; energy points are individual kWh readings.`} action={<Link to="/analytics">Open Analytics <ArrowRight size={14}/></Link>} className="dashboard-trends-panel">
        <div className="dashboard-chart-grid">
          <div className="dashboard-chart"><h3>Observed occupancy buckets</h3><DataState loading={summaryState.loading} error={summaryState.error} empty={summary && occupancyChartData.length === 0 ? "No timestamped occupancy readings in this range." : ""} retry={refresh}><div className="dashboard-chart-frame"><ResponsiveContainer width="100%" height="100%"><BarChart data={occupancyChartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid stroke="#263441" strokeDasharray="3 4" vertical={false}/><XAxis dataKey="time" tick={{ fill: "#91a3b6", fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis allowDecimals tick={{ fill: "#91a3b6", fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ background: "#17212b", border: "1px solid #344552", borderRadius: 7, color: "#e4edf4" }} formatter={(value, name, item) => [`${Number(value).toFixed(1)} people · ${item.payload.readingCount} readings`, "Hourly average"]}/><Bar dataKey="averageOccupied" fill="#4cc7d8" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false}/></BarChart></ResponsiveContainer></div><p className="dashboard-chart-caption">Up to 24 observed UTC-hour buckets; missing hours are not filled.</p></DataState></div>
          <div className="dashboard-chart"><h3>Individual energy readings</h3><DataState loading={summaryState.loading} error={summaryState.error} empty={summary && energyChartData.length === 0 ? "No timestamped energy readings in this range." : ""} retry={refresh}><div className="dashboard-chart-frame"><EnergyScatterChart data={energyChartData}/></div></DataState></div>
        </div>
        {summary?.occupancy_truncated || summary?.energy_truncated ? <p className="dashboard-chart-note">The API response is capped; charts show only the returned sample. <Link to="/analytics">View analytics details</Link>.</p> : null}
      </Panel>

      <Panel title="Recent campus activity" description="Latest timestamped booking and alert records." action={<Link to="/booking">Review records <ArrowRight size={14}/></Link>} className="dashboard-activity-panel">
        <DataState loading={bookingState.loading || alertState.loading} error={bookingState.error || alertState.error} empty={bookingState.data && alertState.data && recentActivity.length === 0 ? "No timestamped booking or alert activity is available." : ""} retry={refresh}>
          <ul className="dashboard-activity-list">{recentActivity.map((record, index) => <li key={`${record.type}-${record.timestamp}-${index}`}><span className="dashboard-activity-icon" aria-hidden="true">{record.type === "booking" ? <ClipboardCheck size={16}/> : <Bell size={16}/>}</span><div><strong>{record.title}</strong><small>{record.type === "booking" ? "Booking record" : "Emergency alert"} · {record.label}</small></div><time dateTime={record.timestamp}>{formatTime(record.timestamp, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></li>)}</ul>
        </DataState>
      </Panel>

      <Panel title="Data coverage" description="Source and recency for stored measurements." className="dashboard-coverage-panel">
        <p className="dashboard-coverage-copy">Counts and measurements come from saved database records. Occupancy and energy values do not represent current sensor conditions. Reading sources are shown when supplied.</p>
        <div className="dashboard-latest-readings">
          <p><span>{summary?.occupancy_truncated ? "Latest occupancy timestamp in sample" : "Latest occupancy reading"}</span><strong>{summaryState.loading ? "Loading…" : summaryState.error ? "Unavailable" : latestOccupancy ? formatTime(latestOccupancy.recorded_at) : "No timestamped reading"}</strong></p>
          <p><span>{summary?.energy_truncated ? "Latest energy timestamp in sample" : "Latest energy reading"}</span><strong>{summaryState.loading ? "Loading…" : summaryState.error ? "Unavailable" : latestEnergy ? formatTime(latestEnergy.recorded_at) : "No timestamped reading"}</strong></p>
        </div>
        <nav className="dashboard-quick-links" aria-label="Campus operations pages">
          <Link to="/buildings"><Building2 size={15}/> Buildings</Link><Link to="/digital-twin"><Map size={15}/> Digital Twin</Link><Link to="/booking"><CalendarDays size={15}/> Bookings</Link><Link to="/analytics"><Activity size={15}/> Analytics</Link><Link to="/scenario-lab"><Users size={15}/> Scenario Lab</Link>
        </nav>
      </Panel>
    </div>
    <p className="dashboard-source-note">Maintenance and timestamped measurements follow the selected date range. Campus counts, bookings, and alerts are current API records. No live telemetry is connected on this dashboard.</p>
  </div>;
}

function ActionItem({ icon: Icon, label, value, loading, error, href, empty }) {
  const unavailable = !value.available;
  return <Link className="dashboard-action-item" to={href} aria-label={`${label}: ${loading ? "loading" : error || unavailable ? "unavailable" : numberFormat.format(value.value)}. Open details`}>
    <span className="dashboard-action-icon" aria-hidden="true"><Icon size={17}/></span><span className="dashboard-action-label">{label}<small>{loading ? "Loading records…" : error || unavailable ? "Could not load records" : value.value === 0 ? empty : "Stored records"}</small></span><strong>{loading ? "…" : unavailable ? "—" : numberFormat.format(value.value)}</strong><ArrowRight className="dashboard-action-arrow" size={15} aria-hidden="true"/>
  </Link>;
}
