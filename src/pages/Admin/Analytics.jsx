import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, AlertTriangle, Building2, CalendarDays, ClipboardCheck, DoorOpen,
  Gauge, RefreshCw, Users, Wrench, Zap,
} from "lucide-react";
import { fetchAnalyticsSummary } from "../../api/analytics";
import { fetchAdminAlerts, fetchAdminBookings } from "../../api/admin";
import {
  aggregateHourlyOccupancy, isCurrentAlert, isValidAnalyticsDateRange, recentCampusRecords,
  summarizeBookings, toAnalyticsDateBounds, validateAdminAlertList, validateAdminBookingList,
  isDemoAlert,
} from "../../api/analyticsDashboardData";
import { isSimulatedSource } from "../../api/demoData.js";
import { useDemoMode } from "../../components/layout/useDemoMode";
import "./Analytics.css";

const numberFormat = new Intl.NumberFormat();
const bookingStatusLabels = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", CANCELLED: "Cancelled" };

function displaySource(source) {
  if (!source) return "Source unavailable";
  const normalized = source.toUpperCase();
  if (normalized.includes("SIMULAT")) return "Simulated";
  if (normalized.includes("RECORDED_VIDEO")) return "Recorded video";
  return source;
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "Time unavailable";
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
}

function AnalyticsMetric({ icon: Icon, title, value, detail, tone }) {
  return <article className="analytics-metric">
    <span className={`analytics-metric-icon ${tone}`} aria-hidden="true"><Icon size={19} strokeWidth={1.9}/></span>
    <span className="analytics-metric-title">{title}</span>
    <strong>{value}</strong>
    <small>{detail}</small>
  </article>;
}

function AnalyticsPanel({ title, description, children, className = "" }) {
  return <article className={`analytics-panel ${className}`}>
    <header className="analytics-panel-heading"><div><h2>{title}</h2><p>{description}</p></div></header>
    {children}
  </article>;
}

function EmptyChart({ children }) {
  return <div className="analytics-empty-state" role="status">{children}</div>;
}

function SourceMetric({ icon, title, detail, value, unavailable, tone }) {
  return <AnalyticsMetric icon={icon} title={title} value={unavailable ? "Unavailable" : numberFormat.format(value)} detail={unavailable ? "Could not load this API resource" : detail} tone={tone}/>;
}

export default function Analytics() {
  const demoMode = useDemoMode();
  const [includeDemoPreview, setIncludeDemoPreview] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [bookingState, setBookingState] = useState({ data: null, error: "", loading: true });
  const [alertState, setAlertState] = useState({ data: null, error: "", loading: true });
  const rangeValid = isValidAnalyticsDateRange(startDate, endDate);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => fetchAdminBookings()).then(validateAdminBookingList)
      .then((data) => { if (active) setBookingState({ data, error: "", loading: false }); })
      .catch(() => { if (active) setBookingState({ data: null, error: "Could not load booking records.", loading: false }); });
    Promise.resolve().then(() => fetchAdminAlerts()).then(validateAdminAlertList)
      .then((data) => { if (active) setAlertState({ data, error: "", loading: false }); })
      .catch(() => { if (active) setAlertState({ data: null, error: "Could not load alert records.", loading: false }); });
    return () => { active = false; };
  }, [retryKey]);

  useEffect(() => {
    if (!rangeValid) return undefined;
    const controller = new AbortController();
    const bounds = toAnalyticsDateBounds(startDate, endDate);
    fetchAnalyticsSummary({ ...bounds, includeDemo: includeDemoPreview, signal: controller.signal }).then((result) => {
      setSummary(result);
      setError("");
      setLoading(false);
    }).catch((loadError) => {
      if (loadError.name !== "AbortError") {
        setSummary(null);
        setError("Could not load stored analytics. Please retry.");
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, [startDate, endDate, includeDemoPreview, retryKey, rangeValid]);

  const occupancyChartData = useMemo(() => aggregateHourlyOccupancy(summary?.occupancy_readings || []).map((bucket) => ({
    ...bucket,
    time: new Date(bucket.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "numeric" }),
    sources: bucket.sources.map(displaySource).join(", ") || "Source unavailable",
  })), [summary]);
  const energyChartData = (summary?.energy_readings || []).map((reading) => ({
    time: reading.recorded_at ? new Date(reading.recorded_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric" }) : "Time unavailable",
    energy: Number(reading.energy_kwh),
    building: reading.building_name,
    source: displaySource(reading.source),
    is_demo: reading.is_demo === true || isSimulatedSource(reading.source),
    recordedAt: reading.recorded_at,
  }));
  const latestOccupancy = summary?.occupancy_readings?.at(-1);
  const latestEnergy = summary?.energy_readings?.at(-1);
  const bookingCounts = bookingState.data ? summarizeBookings(bookingState.data, demoMode && includeDemoPreview) : null;
  const bookingChartData = bookingCounts ? Object.entries(bookingCounts).map(([status, count]) => ({ status: bookingStatusLabels[status], count })) : [];
  const activeAlerts = alertState.data?.filter((alert) => isCurrentAlert(alert)
    && (demoMode && includeDemoPreview || !isDemoAlert(alert))).length ?? null;
  const recentRecords = useMemo(
    () => recentCampusRecords(bookingState.data || [], alertState.data || [], 6, demoMode && includeDemoPreview),
    [bookingState.data, alertState.data, demoMode, includeDemoPreview],
  );
  const energyBuildingChartData = (summary?.energy_by_building || []).map((item) => ({
    ...item,
    building_label: `${item.building_code} · ${displaySource(item.source)}`,
  }));

  function chooseRange(days) {
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    setLoading(true);
    setError("");
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  }

  function refreshData() {
    setLoading(true);
    setError("");
    setBookingState((current) => ({ ...current, loading: true }));
    setAlertState((current) => ({ ...current, loading: true }));
    setRetryKey((key) => key + 1);
  }

  function updateDate(setter, value) {
    setLoading(true);
    setError("");
    setter(value);
  }

  const visibleError = rangeValid ? error : "The end date must be the same as or later than the start date.";

  function metricDetail(value, message, normal) {
    return value === 0 ? message : normal;
  }

  return <div className="analytics-page">
    <header className="analytics-page-heading">
      <div><span className="analytics-eyebrow"><Activity size={14}/> CAMPUS INTELLIGENCE</span><h1>Campus Intelligence</h1><p>Operational summaries derived from available CampusSphere records.</p></div>
      <div className="analytics-heading-actions"><span className="analytics-source-status"><span aria-hidden="true"/> Stored database records · no live telemetry</span>{demoMode && <button type="button" aria-pressed={includeDemoPreview} onClick={() => { setLoading(true); setError(""); setIncludeDemoPreview((value) => !value); }}>{includeDemoPreview ? "Hide demo preview" : "Show demo preview"}</button>}<button type="button" onClick={refreshData} disabled={loading || bookingState.loading || alertState.loading} aria-label="Refresh analytics and current booking and alert records"><RefreshCw size={15}/> Refresh</button></div>
    </header>

    {demoMode && <p className="analytics-demo-note">{includeDemoPreview ? "DEMO PREVIEW: chart data includes fictional demo rooms, simulated occupancy/energy readings, demo bookings, alerts, and maintenance. Operational totals remain separate below." : "Demo records are excluded from operational counts. Occupancy and energy demo readings are simulated, historical, and not live."}</p>}
    <section className="analytics-filter-bar" aria-label="Analytics date filters">
      <div className="analytics-date-fields">
        <label htmlFor="analytics-start-date">From <input id="analytics-start-date" type="date" value={startDate} max={endDate || undefined} onChange={(event) => updateDate(setStartDate, event.target.value)}/></label>
        <label htmlFor="analytics-end-date">To <input id="analytics-end-date" type="date" value={endDate} min={startDate || undefined} onChange={(event) => updateDate(setEndDate, event.target.value)}/></label>
      </div>
      <div className="analytics-filter-actions" role="group" aria-label="Quick date ranges">
        <button type="button" onClick={() => chooseRange(7)}><CalendarDays size={14}/> 7 days</button>
        <button type="button" onClick={() => chooseRange(30)}><CalendarDays size={14}/> 30 days</button>
        <button type="button" onClick={() => { setLoading(true); setError(""); setStartDate(""); setEndDate(""); }} disabled={!startDate && !endDate}>Clear</button>
      </div>
      <p className="analytics-filter-scope">Date range filters occupancy readings, energy readings, and maintenance requests by creation date. Building/room totals, bookings, and active alerts show current records and are not date-filtered.</p>
    </section>

    {visibleError && <div className="analytics-error" role="alert"><span>{visibleError}</span>{!rangeValid ? <button type="button" onClick={() => { setLoading(true); setStartDate(""); setEndDate(""); }}>Clear range</button> : <button type="button" onClick={refreshData}><RefreshCw size={15}/> Retry</button>}</div>}
    {loading && rangeValid && <div className="analytics-state" role="status">{summary ? "Updating filtered analytics…" : "Loading stored analytics records…"}</div>}

    {rangeValid && summary && !loading && <>
      <section className="analytics-metrics" aria-label="Campus operations summary">
        <AnalyticsMetric icon={Building2} title="DATABASE BUILDINGS" value={numberFormat.format(summary.buildings_total)} detail={metricDetail(summary.buildings_total, "No database building records available", "Verified building records")} tone="cyan"/>
        <AnalyticsMetric icon={DoorOpen} title="VERIFIED ROOMS" value={numberFormat.format(summary.verified_rooms_total)} detail={metricDetail(summary.verified_rooms_total, "No verified room records available", "CAD annotations excluded")} tone="blue"/>
        <SourceMetric icon={ClipboardCheck} title="PENDING BOOKINGS" value={bookingCounts?.PENDING ?? 0} unavailable={!bookingCounts} detail="Current database booking status" tone="amber"/>
        <SourceMetric icon={ClipboardCheck} title="APPROVED BOOKINGS" value={bookingCounts?.APPROVED ?? 0} unavailable={!bookingCounts} detail="Current database booking status" tone="green"/>
        <SourceMetric icon={AlertTriangle} title="ACTIVE ALERTS" value={activeAlerts ?? 0} unavailable={activeAlerts === null} detail="Active records from the admin alerts API" tone="amber"/>
        <AnalyticsMetric icon={Gauge} title="OCCUPANCY READINGS" value={numberFormat.format(summary.occupancy_readings_total)} detail={metricDetail(summary.occupancy_readings_total, "No readings available for this period", "Stored readings in selected period")} tone="cyan"/>
        <AnalyticsMetric icon={Zap} title="ENERGY READINGS" value={numberFormat.format(summary.energy_readings_total)} detail={metricDetail(summary.energy_readings_total, "No readings available for this period", "Individual stored kWh readings · source retained")} tone="blue"/>
        <AnalyticsMetric icon={ClipboardCheck} title="OPEN MAINTENANCE" value={numberFormat.format(summary.maintenance_open_total)} detail={metricDetail(summary.maintenance_open_total, "No open requests in selected period", "Stored requests created in selected period")} tone="amber"/>
      </section>
      {demoMode && includeDemoPreview && <section className="analytics-metrics" aria-label="Fictional demo preview counts">
        <AnalyticsMetric icon={Building2} title="DEMO BUILDINGS" value={numberFormat.format(summary.demo_buildings_total)} detail="Fictional local preview buildings" tone="cyan"/>
        <AnalyticsMetric icon={DoorOpen} title="DEMO ROOMS" value={numberFormat.format(summary.demo_rooms_total)} detail="Not verified or operational inventory" tone="blue"/>
        <AnalyticsMetric icon={Users} title="SIMULATED OCCUPANCY" value={numberFormat.format(summary.demo_occupancy_readings_total)} detail="Historical fictional readings" tone="cyan"/>
        <AnalyticsMetric icon={Zap} title="SIMULATED ENERGY" value={numberFormat.format(summary.demo_energy_readings_total)} detail="Individual fictional kWh readings" tone="blue"/>
        <AnalyticsMetric icon={Wrench} title="DEMO OPEN MAINTENANCE" value={numberFormat.format(summary.demo_maintenance_open_total)} detail="Fictional local workflow records" tone="amber"/>
      </section>}
      <p className="analytics-secondary-summary">Resolved maintenance requests in selected period: <strong>{numberFormat.format(summary.maintenance_resolved_total)}</strong>. Values come from the existing read-only analytics summary.</p>

      <section className="analytics-chart-grid" aria-label="Stored campus readings">
        <AnalyticsPanel title="Occupancy Readings by Hour" description={latestOccupancy ? `Average occupied count per stored room reading · latest ${formatTimestamp(latestOccupancy.recorded_at)} · ${displaySource(latestOccupancy.source)}` : "Hourly average of timestamped room readings; this is not live occupancy."} className="analytics-trend-panel">
          {occupancyChartData.length ? <><div className="analytics-occupancy-chart" role="img" aria-label={`Hourly average occupancy chart with ${occupancyChartData.length} time intervals`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={occupancyChartData} margin={{ top: 8, right: 10, left: 4, bottom: 0 }}>
            <defs><linearGradient id="analyticsOccupancyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#20d2e9" stopOpacity={0.18}/><stop offset="100%" stopColor="#20d2e9" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid stroke="#2a3542" strokeDasharray="3 4" vertical={false}/>
            <XAxis dataKey="time" axisLine={false} tickLine={false} interval="preserveStartEnd" tick={{ fill: "#aab8c8", fontSize: 11 }}/>
            <YAxis domain={[0, "auto"]} axisLine={false} tickLine={false} width={48} tick={{ fill: "#aab8c8", fontSize: 12 }}/>
            <Tooltip contentStyle={{ background: "#1b2430", border: "1px solid #2c3948", borderRadius: 7, color: "#e2e8f0" }} formatter={(value, _name, item) => [`${Number(value).toFixed(1)} occupied count/reading · ${item.payload.readingCount} readings · ${item.payload.sources}`, "Hourly average"]}/>
            <Area type="monotone" dataKey="averageOccupied" stroke="#18d2eb" strokeWidth={2.5} fill="url(#analyticsOccupancyFill)" dot={false} activeDot={{ r: 5 }}/>
          </AreaChart></ResponsiveContainer></div><p className="analytics-chart-caption">Each point averages the stored occupied_count values from readings recorded in that UTC hour.</p></> : <EmptyChart>No timestamped occupancy readings are stored for this period.</EmptyChart>}
        </AnalyticsPanel>

        <AnalyticsPanel title="Individual Energy Readings" description={latestEnergy ? `Stored kWh readings · latest ${formatTimestamp(latestEnergy.recorded_at)} · ${displaySource(latestEnergy.source)}` : "Each bar is one stored meter reading; units remain kWh."} className="analytics-energy-panel">
          {energyChartData.length ? <div className="analytics-energy-chart" role="img" aria-label={`Individual stored energy readings chart with ${energyChartData.length} readings`}><ResponsiveContainer width="100%" height="100%"><BarChart data={energyChartData} margin={{ top: 8, right: 10, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="#2a3542" strokeDasharray="3 4" vertical={false}/>
            <XAxis dataKey="time" axisLine={false} tickLine={false} interval="preserveStartEnd" tick={{ fill: "#aab8c8", fontSize: 11 }}/>
            <YAxis domain={[0, "auto"]} axisLine={false} tickLine={false} width={48} tick={{ fill: "#aab8c8", fontSize: 12 }}/>
            <Tooltip contentStyle={{ background: "#1b2430", border: "1px solid #2c3948", borderRadius: 7, color: "#e2e8f0" }} formatter={(value, _name, item) => [`${value} kWh · ${item.payload.building} · ${item.payload.source} · ${formatTimestamp(item.payload.recordedAt)}`, "Reading"]}/>
            <Bar dataKey="energy" radius={[4, 4, 0, 0]} maxBarSize={58}>{energyChartData.map((reading, index) => <Cell key={`${reading.building}-${reading.recordedAt}-${index}`} fill={reading.is_demo ? "#d39b43" : "#20c8de"}/>)}</Bar>
          </BarChart></ResponsiveContainer></div> : <EmptyChart>No energy readings are stored for this period. No live meter feed is connected.</EmptyChart>}
        </AnalyticsPanel>

        <AnalyticsPanel title="Booking Status" description="Current booking records grouped by their stored status." className="analytics-booking-panel">
          {bookingState.loading ? <EmptyChart>Loading booking records…</EmptyChart> : bookingCounts ? bookingChartData.some(({ count }) => count > 0) ? <><div className="analytics-status-chart" role="img" aria-label="Booking counts by pending, approved, rejected, and cancelled status"><ResponsiveContainer width="100%" height="100%"><BarChart data={bookingChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#2a3542" strokeDasharray="3 4" vertical={false}/><XAxis dataKey="status" axisLine={false} tickLine={false} tick={{ fill: "#aab8c8", fontSize: 11 }}/><YAxis allowDecimals={false} domain={[0, "auto"]} axisLine={false} tickLine={false} width={35} tick={{ fill: "#aab8c8", fontSize: 11 }}/><Tooltip contentStyle={{ background: "#1b2430", border: "1px solid #2c3948", borderRadius: 7, color: "#e2e8f0" }}/><Bar dataKey="count" name="Bookings" fill="#20c8de" radius={[4, 4, 0, 0]} maxBarSize={45}/>
          </BarChart></ResponsiveContainer></div><p className="analytics-chart-caption">{bookingChartData.map(({ status, count }) => `${status}: ${numberFormat.format(count)}`).join(" · ")}</p></> : <EmptyChart>No booking records are available.</EmptyChart> : <EmptyChart>Booking summary unavailable: {bookingState.error}</EmptyChart>}
        </AnalyticsPanel>

        {energyBuildingChartData.length > 0 && <AnalyticsPanel title="Average Energy per Reading" description="Average stored kWh by building and source. This is not a period consumption total." className="analytics-comparison-panel">
          <div className="analytics-energy-chart" role="img" aria-label="Average stored kWh per reading by building and source"><ResponsiveContainer width="100%" height="100%"><BarChart data={energyBuildingChartData} margin={{ top: 8, right: 15, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="#2a3542" strokeDasharray="3 4" vertical={false}/><XAxis dataKey="building_label" axisLine={false} tickLine={false} interval="preserveStartEnd" tick={{ fill: "#aab8c8", fontSize: 11 }}/><YAxis domain={[0, "auto"]} axisLine={false} tickLine={false} width={48} tick={{ fill: "#aab8c8", fontSize: 12 }}/><Tooltip contentStyle={{ background: "#1b2430", border: "1px solid #2c3948", borderRadius: 7, color: "#e2e8f0" }} formatter={(value, _name, item) => [`${Number(value).toFixed(3)} kWh · ${item.payload.reading_count} readings · ${displaySource(item.payload.source)}`, item.payload.building_name]}/><Bar dataKey="average_kwh_per_reading" fill="#cc890c" radius={[4, 4, 0, 0]} maxBarSize={54}/>
          </BarChart></ResponsiveContainer></div>
        </AnalyticsPanel>}
      </section>

      <section className="analytics-lower-grid">
        <AnalyticsPanel title="Recent booking and alert records" description="Separate API resources sorted by their stored creation timestamps; not a unified campus event log." className="analytics-activity-panel">
          {bookingState.loading || alertState.loading ? <p className="analytics-lower-state" role="status">Loading current booking and alert records…</p> : recentRecords.length ? <ul className="analytics-activity-list">{recentRecords.map((record, index) => <li key={`${record.type}-${index}`}><div><span>{record.type === "alert" ? "Emergency alert" : "Room booking"}</span><strong title={record.title}>{record.title}</strong></div><div className="analytics-activity-meta"><span>{record.label}</span><time dateTime={record.timestamp}>{formatTimestamp(record.timestamp)}</time><Link to={record.href}>Open</Link></div></li>)}</ul> : <EmptyChart>{bookingState.error || alertState.error ? "Recent records could not be loaded from one or more APIs." : "No timestamped booking or alert records are available."}</EmptyChart>}
          {(bookingState.error || alertState.error) && <p className="analytics-source-error" role="status">{[bookingState.error && "Booking summary unavailable", alertState.error && "Alert summary unavailable"].filter(Boolean).join(" · ")}</p>}
        </AnalyticsPanel>
        <AnalyticsPanel title="Room utilization" description="Available only when the backend has capacity and latest stored occupancy for every verified room." className="analytics-utilization-result">
          {summary.room_utilization_percent === null ? <EmptyChart>Unavailable for the current room data. A missing reading is not treated as zero occupancy.</EmptyChart> : <div className="analytics-utilization-value">{summary.room_utilization_percent}%</div>}
        </AnalyticsPanel>
      </section>

      <section className="analytics-operations" aria-labelledby="analytics-operations-title">
        <div className="analytics-operations-heading"><div><h2 id="analytics-operations-title">Campus operations</h2><p>Open existing data views and management pages.</p></div></div>
        <nav aria-label="Campus operations links">
          <Link to="/digital-twin"><Building2 size={16}/> Digital Twin</Link><Link to="/buildings"><DoorOpen size={16}/> Buildings &amp; Rooms</Link><Link to="/booking"><ClipboardCheck size={16}/> Room Bookings</Link><Link to="/occupancy"><Gauge size={16}/> Occupancy</Link><Link to="/energy"><Zap size={16}/> Energy</Link><Link to="/notices"><Activity size={16}/> Notices</Link><Link to="/emergency"><AlertTriangle size={16}/> Emergency Alerts</Link><Link to="/scenario-lab"><Users size={16}/> Scenario Lab</Link>
        </nav>
      </section>

      <p className="analytics-data-note">Analytics are read from authenticated database endpoints. Simulated source labels are preserved as simulated; occupancy and energy are stored readings, not live telemetry or forecasts. Maintenance totals are aggregate records from the existing analytics endpoint; no maintenance workflow is provided here.</p>
      {summary.occupancy_truncated || summary.energy_truncated ? <p className="analytics-limit-note">The readings chart is limited to the first 2,000 rows per metric. Narrow the date range to inspect a smaller period.</p> : null}
    </>}

  </div>;
}
