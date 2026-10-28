import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Building2, CalendarDays, Clock3, RefreshCw, Zap } from "lucide-react";
import { fetchStudentEnergyReadings } from "../../api/energy";
import { fetchBuildings } from "../../api/buildings";
import {
  dateEndExclusiveUtc, dateStartUtc, energySummary, energyTrend, monitoringBuildingOptions,
  monitoringDateRange, monitoringView,
} from "./studentMonitoringData.js";
import "./StudentMonitoring.css";

const formatTimestamp = (date) => date ? date.toLocaleString() : "Timestamp unavailable";
const formatChartDate = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });

function Metric({ icon: Icon, label, value, detail, tone, compact = false }) {
  return <article className="student-monitor-metric">
    <span className={`student-monitor-metric-icon ${tone}`}><Icon size={19} aria-hidden="true"/></span>
    <p>{label}</p>
    <strong className={compact ? "compact" : ""}>{value}</strong>
    <small>{detail}</small>
  </article>;
}

function EmptyState({ title, children, onReset }) {
  return <div className="student-monitor-empty" role="status"><Zap size={22} aria-hidden="true"/><strong>{title}</strong><p>{children}</p>{onReset && <button className="student-monitor-reset" type="button" onClick={onReset}>Reset filters</button>}</div>;
}

function EnergyTooltip({ active, payload }) {
  const point = active && payload?.[0]?.payload;
  if (!point) return null;
  const isTrend = Number.isFinite(point.averageKwh);
  return <div className="student-monitor-tooltip">
    <strong>{isTrend ? `${point.date} (UTC)` : `${point.building_name} · ${point.building_code}`}</strong>
    <span>{isTrend ? `${point.averageKwh.toFixed(3)} kWh per sample` : `${Number(point.energy_kwh).toFixed(3)} kWh`}</span>
    <small>{isTrend ? `${point.samples} stored sample${point.samples === 1 ? "" : "s"}` : `Latest stored reading · ${point.recorded_at ? new Date(point.recorded_at).toLocaleString() : "timestamp unavailable"}`}</small>
  </div>;
}

export default function StudentEnergy() {
  const [state, setState] = useState({ loading: true, error: "", readings: [], truncated: false });
  const [buildings, setBuildings] = useState([]);
  const [directoryError, setDirectoryError] = useState("");
  const [availableDateRange, setAvailableDateRange] = useState({ from: "", through: "" });
  const [building, setBuilding] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ start: undefined, end: undefined, buildingCode: undefined });
  const [filterError, setFilterError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchStudentEnergyReadings({ ...appliedFilters, signal: controller.signal })
      .then((result) => {
        setState({ loading: false, error: "", readings: result.readings, truncated: result.truncated });
        if (!appliedFilters.buildingCode && !appliedFilters.start && !appliedFilters.end) {
          setAvailableDateRange(monitoringDateRange(result.readings));
        }
      })
      .catch((error) => { if (error.name !== "AbortError") setState({ loading: false, error: error.message, readings: [], truncated: false }); });
    return () => controller.abort();
  }, [reload, appliedFilters]);

  useEffect(() => {
    let active = true;
    fetchBuildings().then((rows) => {
      if (active) { setBuildings(rows); setDirectoryError(""); }
    }).catch((error) => {
      if (active) setDirectoryError(error.message);
    });
    return () => { active = false; };
  }, [reload]);

  const summary = useMemo(() => energySummary(state.readings), [state.readings]);
  const buildingOptions = useMemo(() => monitoringBuildingOptions(buildings), [buildings]);
  const trend = useMemo(() => energyTrend(state.readings), [state.readings]);
  const view = monitoringView({ loading: state.loading, error: state.error, rows: state.readings });
  const appliedFrom = appliedFilters.start?.slice(0, 10) || "";
  const appliedThrough = appliedFilters.end ? new Date(Date.parse(appliedFilters.end) - 1).toISOString().slice(0, 10) : "";
  const periodLabel = appliedFrom || appliedThrough ? `${appliedFrom || "Earliest"} to ${appliedThrough || "Latest"}` : "All stored dates";

  function applyFilters(event) {
    event.preventDefault();
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setFilterError("The start date must be on or before the end date.");
      return;
    }
    setFilterError("");
    setState((current) => ({ ...current, loading: true, error: "" }));
    setAppliedFilters({
      start: dateStartUtc(dateFrom), end: dateEndExclusiveUtc(dateTo),
      buildingCode: building || undefined,
    });
  }

  function refresh() {
    setState((current) => ({ ...current, loading: true, error: "" }));
    setReload((value) => value + 1);
  }

  function resetFilters() {
    setBuilding("");
    setDateFrom("");
    setDateTo("");
    setFilterError("");
    setState((current) => ({ ...current, loading: true, error: "" }));
    setAppliedFilters({ start: undefined, end: undefined, buildingCode: undefined });
  }

  return <main className="student-monitoring module-page">
    <header className="student-monitor-header">
      <div><p className="page-label">STUDENT PORTAL · HISTORICAL MONITORING</p><h1>Energy Monitoring</h1><p>Explore stored simulated kWh readings by building and date.</p></div>
      <button className="student-monitor-refresh" type="button" onClick={refresh} disabled={state.loading}><RefreshCw size={15} className={state.loading ? "student-monitor-spin" : ""}/>Refresh</button>
    </header>

    <div className="student-monitor-banner energy"><strong>SIMULATED DEMO DATA — NOT LIVE METER READINGS</strong><span>Stored sample values only. No live meter feed or energy forecast is connected.</span></div>

    <form className="student-monitor-filters" onSubmit={applyFilters} aria-label="Filter simulated energy readings">
      <label htmlFor="energy-building"><span>Building</span><select id="energy-building" value={building} onChange={(event) => setBuilding(event.target.value)}><option value="">All available buildings</option>{buildingOptions.map(({ code, name }) => <option key={code} value={code}>{code} · {name}</option>)}</select></label>
      <label htmlFor="energy-from"><span>From</span><input id="energy-from" type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)}/></label>
      <label htmlFor="energy-through"><span>Through</span><input id="energy-through" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)}/></label>
      <button type="submit" className="student-monitor-apply"><CalendarDays size={15}/>Apply filters</button>
      <button type="button" className="student-monitor-reset" onClick={resetFilters}>Reset filters</button>
      <span className="student-monitor-period">{periodLabel}{availableDateRange.from ? ` · returned data: ${availableDateRange.from} through ${availableDateRange.through} (UTC)` : " · no timestamped readings returned"}</span>
    </form>
    {directoryError && <p className="student-monitor-note" role="status">Building filter options could not be loaded: {directoryError}</p>}
    {filterError && <p className="student-monitor-error" role="alert">{filterError}</p>}
    {state.truncated && <p className="student-monitor-note" role="status">The API limited this response. Narrow the date range for a more complete view.</p>}
    {view === "error" && <div className="student-monitor-error" role="alert"><span>{state.error}</span><button type="button" onClick={refresh}>Retry</button></div>}
    {view === "loading" && <p className="student-monitor-state" role="status">Loading simulated energy readings…</p>}

    {view === "populated" && <>
      <section className="student-monitor-metrics" aria-label="Energy summary" aria-busy={state.loading}>
        <Metric icon={Zap} label="READINGS IN PERIOD" value={summary.readingCount.toLocaleString()} detail={periodLabel} tone="cyan"/>
        <Metric icon={Zap} label="LATEST STORED SAMPLE" value={summary.latest ? `${Number(summary.latest.energy_kwh).toFixed(3)} kWh` : "Unavailable"} detail={summary.latest ? `${summary.latest.building_code} · individual reading` : "No valid reading timestamp is available"} tone="green"/>
        <Metric icon={Building2} label="BUILDINGS WITH READINGS" value={summary.buildingCount} detail="Distinct linked building records" tone="amber"/>
        <Metric icon={Clock3} label="LATEST READING" value={formatTimestamp(summary.latestTimestamp)} detail="Timestamp of newest selected sample" tone="purple" compact/>
      </section>

      <section className="student-monitor-panel">
        <header className="student-monitor-panel-heading"><div><h2>Energy trend by day</h2><p>Daily average of stored readings in kWh per sample; it is not a daily consumption total.</p></div><span>{trend.length} days</span></header>
        <div className="student-monitor-chart" role="img" aria-label={`Daily average energy per stored sample for ${trend.length} dates`}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={trend} margin={{ top: 12, right: 18, bottom: 22, left: 12 }}>
            <CartesianGrid stroke="#2b3745" strokeDasharray="3 3"/>
            <XAxis dataKey="date" tickFormatter={formatChartDate} minTickGap={20} stroke="#8292a6" tick={{ fontSize: 10 }}/>
            <YAxis unit=" kWh" width={66} stroke="#8292a6" tick={{ fontSize: 10 }}/>
            <Tooltip content={<EnergyTooltip/>}/>
            <Legend verticalAlign="top" height={28}/>
            <Bar dataKey="averageKwh" name="Average stored sample (kWh)" fill="#e6b45d" radius={[4, 4, 0, 0]}/>
          </BarChart></ResponsiveContainer>
        </div>
        <details className="student-monitor-chart-data"><summary>View chart data table</summary><div className="student-monitor-table-wrap"><table><caption>Daily average energy values and sample counts used in the chart</caption><thead><tr><th>Date (UTC)</th><th>Average reading (kWh/sample)</th><th>Readings</th></tr></thead><tbody>{trend.map((day) => <tr key={day.date}><td>{day.date}</td><td>{day.averageKwh.toFixed(3)}</td><td>{day.samples}</td></tr>)}</tbody></table></div></details>
      </section>

      <section className="student-monitor-panel">
        <header className="student-monitor-panel-heading"><div><h2>Latest reading by building</h2><p>One newest stored sample per building; compare values only as individual readings.</p></div><span>{summary.latestByBuilding.length} buildings</span></header>
        <div className="student-monitor-chart student-monitor-building-chart" role="img" aria-label="Latest stored energy sample by building">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={summary.latestByBuilding} layout="vertical" margin={{ top: 8, right: 22, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="#2b3745" strokeDasharray="3 3" horizontal={false}/>
            <XAxis type="number" dataKey="energy_kwh" unit=" kWh" stroke="#8292a6" tick={{ fontSize: 10 }}/>
            <YAxis type="category" dataKey="building_code" width={94} stroke="#8292a6" tick={{ fontSize: 10 }}/>
            <Tooltip content={<EnergyTooltip/>}/>
            <Legend verticalAlign="top" height={28}/>
            <Bar dataKey="energy_kwh" name="Latest stored sample" fill="#e6b45d" radius={[0, 4, 4, 0]}>
              {summary.latestByBuilding.map((row) => <Cell key={row.building_id} fill="#e6b45d"/>)}
            </Bar>
          </BarChart></ResponsiveContainer>
        </div>
        <div className="student-monitor-table-wrap"><table><caption>Latest simulated energy sample by building</caption><thead><tr><th>Building</th><th>Latest sample</th><th>Recorded at</th><th>Source</th></tr></thead><tbody>{summary.latestByBuilding.map((row) => <tr key={row.building_id}><td><strong>{row.building_name}</strong><small>{row.building_code}</small></td><td>{Number(row.energy_kwh).toFixed(3)} kWh</td><td>{formatTimestamp(row.recorded_at ? new Date(row.recorded_at) : null)}</td><td><span className="student-monitor-source">{row.reading_source || "Simulated source not specified"}</span></td></tr>)}</tbody></table></div>
      </section>

      <section className="student-monitor-panel">
        <header className="student-monitor-panel-heading"><div><h2>Reading history</h2><p>Individual stored records, ordered by the API within this filter.</p></div><span>{summary.readingCount.toLocaleString()} samples</span></header>
        <div className="student-monitor-table-wrap student-monitor-history"><table><caption>Simulated energy reading history in kWh</caption><thead><tr><th>Recorded at</th><th>Building</th><th>Reading</th><th>Source</th></tr></thead><tbody>{state.readings.map((row) => <tr key={row.id}><td>{formatTimestamp(row.recorded_at ? new Date(row.recorded_at) : null)}</td><td><strong>{row.building_name}</strong><small>{row.building_code}</small></td><td>{Number(row.energy_kwh).toFixed(3)} kWh</td><td>{row.reading_source || "Simulated source not specified"}</td></tr>)}</tbody></table></div>
      </section>
    </>}

    {view === "empty" && <EmptyState title="No simulated readings match these filters" onReset={resetFilters}>{availableDateRange.from
      ? `The returned readings range from ${availableDateRange.from} through ${availableDateRange.through} UTC. Clear the building and date filters to view all available history.`
      : "No simulated energy readings were returned. Refresh the page or check that the documented local demo API is running."}</EmptyState>}
  </main>;
}
