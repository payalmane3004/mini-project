import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Activity, CalendarDays, Clock3, DoorOpen, RefreshCw, Users } from "lucide-react";
import { fetchStudentOccupancyHistory } from "../../api/occupancy";
import { fetchBuildings, fetchRooms } from "../../api/buildings";
import {
  filterReadingsByDates, monitoringBuildingOptions, monitoringDateRange, monitoringRoomOptions,
  monitoringView, occupancySummary, occupancyTrend,
} from "./studentMonitoringData.js";
import "./StudentMonitoring.css";

const formatTimestamp = (date) => date ? date.toLocaleString() : "Timestamp unavailable";
const formatChartTime = (timestamp) => new Date(timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "numeric" });

function Metric({ icon: Icon, label, value, detail, tone, compact = false }) {
  return <article className="student-monitor-metric">
    <span className={`student-monitor-metric-icon ${tone}`}><Icon size={19} aria-hidden="true"/></span>
    <p>{label}</p>
    <strong className={compact ? "compact" : ""}>{value}</strong>
    <small>{detail}</small>
  </article>;
}

function EmptyState({ title, children, onReset }) {
  return <div className="student-monitor-empty" role="status"><Activity size={22} aria-hidden="true"/><strong>{title}</strong><p>{children}</p>{onReset && <button className="student-monitor-reset" type="button" onClick={onReset}>Reset filters</button>}</div>;
}

function OccupancyTooltip({ active, payload }) {
  const point = active && payload?.[0]?.payload;
  if (!point) return null;
  return <div className="student-monitor-tooltip"><strong>{point.label}</strong><span>{point.average.toFixed(1)} people per reading</span><small>{point.count} room reading{point.count === 1 ? "" : "s"} at this time</small></div>;
}

export default function StudentOccupancy() {
  const [state, setState] = useState({ loading: true, error: "", readings: [] });
  const [directory, setDirectory] = useState({ buildings: [], rooms: [], error: "" });
  const [availableDateRange, setAvailableDateRange] = useState({ from: "", through: "" });
  const [building, setBuilding] = useState("");
  const [appliedBuilding, setAppliedBuilding] = useState("");
  const [room, setRoom] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedDates, setAppliedDates] = useState({ from: "", through: "" });
  const [filterError, setFilterError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchStudentOccupancyHistory({ buildingCode: appliedBuilding || undefined, signal: controller.signal })
      .then((result) => {
        setState({ loading: false, error: "", readings: result.readings });
        if (!appliedBuilding) {
          setAvailableDateRange(monitoringDateRange(result.readings));
        }
      })
      .catch((error) => { if (error.name !== "AbortError") setState({ loading: false, error: error.message, readings: [] }); });
    return () => controller.abort();
  }, [reload, appliedBuilding]);

  useEffect(() => {
    let active = true;
    Promise.all([fetchBuildings(), fetchRooms()]).then(([buildings, rooms]) => {
      if (active) setDirectory({ buildings, rooms, error: "" });
    }).catch((error) => {
      if (active) setDirectory((current) => ({ ...current, error: error.message }));
    });
    return () => { active = false; };
  }, [reload]);

  const datedReadings = useMemo(() => filterReadingsByDates(state.readings, appliedDates.from, appliedDates.through), [state.readings, appliedDates]);
  const buildingOptions = useMemo(() => monitoringBuildingOptions(directory.buildings), [directory.buildings]);
  const availableRooms = useMemo(() => monitoringRoomOptions(directory.rooms, building, directory.buildings), [directory.rooms, directory.buildings, building]);
  const filteredReadings = useMemo(() => datedReadings.filter((row) => (
    (!building || row.building_code === building) && (!room || String(row.room_id) === room)
  )), [datedReadings, building, room]);
  const summary = useMemo(() => occupancySummary(filteredReadings), [filteredReadings]);
  const trend = useMemo(() => occupancyTrend(filteredReadings), [filteredReadings]);
  const view = monitoringView({ loading: state.loading, error: state.error, rows: filteredReadings });

  function applyFilters(event) {
    event.preventDefault();
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setFilterError("The start date must be on or before the end date.");
      return;
    }
    setFilterError("");
    setRoom("");
    setAppliedDates({ from: dateFrom, through: dateTo });
    if (building !== appliedBuilding) {
      setState((current) => ({ ...current, loading: true, error: "" }));
      setAppliedBuilding(building);
    }
  }

  function refresh() {
    setState((current) => ({ ...current, loading: true, error: "" }));
    setReload((value) => value + 1);
  }

  function resetFilters() {
    setBuilding("");
    setRoom("");
    setDateFrom("");
    setDateTo("");
    setAppliedDates({ from: "", through: "" });
    if (appliedBuilding) {
      setState((current) => ({ ...current, loading: true, error: "" }));
      setAppliedBuilding("");
    }
    setFilterError("");
  }

  const periodLabel = appliedDates.from || appliedDates.through
    ? `${appliedDates.from || "Earliest"} to ${appliedDates.through || "Latest"}`
    : "All stored dates";

  return <main className="student-monitoring module-page">
    <header className="student-monitor-header">
      <div><p className="page-label">STUDENT PORTAL · HISTORICAL MONITORING</p><h1>Occupancy Monitoring</h1><p>Review timestamped simulated room readings across the selected period.</p></div>
      <button className="student-monitor-refresh" type="button" onClick={refresh} disabled={state.loading}><RefreshCw size={15} className={state.loading ? "student-monitor-spin" : ""}/>Refresh</button>
    </header>

    <div className="student-monitor-banner"><strong>SIMULATED DEMO DATA — NOT LIVE SENSOR READINGS</strong><span>Stored historical observations only. No live occupancy feed or camera-based counting is connected.</span></div>

    <form className="student-monitor-filters" onSubmit={applyFilters} aria-label="Filter occupancy readings">
      <label htmlFor="occupancy-building"><span>Building</span><select id="occupancy-building" value={building} onChange={(event) => { setBuilding(event.target.value); setRoom(""); }}><option value="">All available buildings</option>{buildingOptions.map(({ code, name }) => <option key={code} value={code}>{code} · {name}</option>)}</select></label>
      <label htmlFor="occupancy-room"><span>Room</span><select id="occupancy-room" value={room} onChange={(event) => setRoom(event.target.value)} disabled={!availableRooms.length}><option value="">All rooms</option>{availableRooms.map((item) => <option key={item.id} value={item.id}>{item.room_code} · {item.room_name || "Room"}</option>)}</select></label>
      <label htmlFor="occupancy-from"><span>From</span><input id="occupancy-from" type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)}/></label>
      <label htmlFor="occupancy-through"><span>Through</span><input id="occupancy-through" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)}/></label>
      <button type="submit" className="student-monitor-apply"><CalendarDays size={15}/>Apply filters</button>
      <button type="button" className="student-monitor-reset" onClick={resetFilters}>Reset filters</button>
      <span className="student-monitor-period">{periodLabel}{availableDateRange.from ? ` · returned data: ${availableDateRange.from} through ${availableDateRange.through} (UTC)` : " · no timestamped readings returned"}</span>
    </form>
    {directory.error && <p className="student-monitor-note" role="status">Building and room filter options could not be loaded: {directory.error}</p>}
    {filterError && <p className="student-monitor-error" role="alert">{filterError}</p>}
    {view === "error" && <div className="student-monitor-error" role="alert"><span>{state.error}</span><button type="button" onClick={refresh}>Retry</button></div>}
    {view === "loading" && <p className="student-monitor-state" role="status">Loading simulated occupancy readings…</p>}

    {view === "populated" && <>
      <section className="student-monitor-metrics" aria-label="Occupancy summary" aria-busy={state.loading}>
        <Metric icon={DoorOpen} label="ROOMS WITH READINGS" value={summary.roomCount} detail={`In ${periodLabel.toLowerCase()}`} tone="green"/>
        <Metric icon={Users} label="LATEST RECORDED OCCUPANTS" value={summary.latest ? `${summary.latest.occupied_count}` : "Unavailable"} detail={summary.latest ? `${summary.latest.room_code} · one room reading, not a campus total` : "No valid reading timestamp is available"} tone="cyan"/>
        <Metric icon={Activity} label="LATEST ROOM UTILIZATION" value={summary.latestPercent === null ? "Unavailable" : `${summary.latestPercent}%`} detail={summary.latestCapacity && summary.latest ? `${summary.latest.occupied_count} of ${summary.latestCapacity} stored seats` : "Positive room capacity is not recorded"} tone="amber"/>
        <Metric icon={Clock3} label="LATEST READING" value={formatTimestamp(summary.latestTimestamp)} detail="Timestamp of the newest selected observation" tone="purple" compact/>
      </section>

      <section className="student-monitor-panel">
        <header className="student-monitor-panel-heading"><div><h2>Occupancy trend</h2><p>Average occupants among readings recorded at each timestamp, in people per reading.</p></div><span>{trend.length} timestamp groups</span></header>
        <div className="student-monitor-chart" role="img" aria-label={`Historical occupancy trend with ${trend.length} timestamp groups; average occupants per reading`}>
          <ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 12, right: 18, bottom: 22, left: 4 }}>
            <CartesianGrid stroke="#2b3745" strokeDasharray="3 3"/>
            <XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={formatChartTime} minTickGap={28} stroke="#8292a6" tick={{ fontSize: 10 }}/>
            <YAxis allowDecimals={false} width={54} stroke="#8292a6" tick={{ fontSize: 10 }} label={{ value: "People / reading", angle: -90, position: "insideLeft", fill: "#91a1b6", fontSize: 10 }}/>
            <Tooltip content={<OccupancyTooltip/>}/>
            <Legend verticalAlign="top" height={28}/>
            <Area type="monotone" dataKey="average" name="Average occupants per reading" stroke="#35c4d9" fill="#35c4d9" fillOpacity={0.18} strokeWidth={2} activeDot={{ r: 4 }}/>
          </AreaChart></ResponsiveContainer>
        </div>
        <details className="student-monitor-chart-data"><summary>View chart data table</summary><div className="student-monitor-table-wrap"><table><caption>Occupancy trend values used in the chart</caption><thead><tr><th>Recorded at</th><th>Average occupants per reading</th><th>Room readings</th></tr></thead><tbody>{trend.map((point) => <tr key={point.timestamp}><td>{point.label}</td><td>{point.average.toFixed(1)}</td><td>{point.count}</td></tr>)}</tbody></table></div></details>
      </section>

      <section className="student-monitor-panel">
        <header className="student-monitor-panel-heading"><div><h2>Latest simulated reading by room</h2><p>Most recent reading per room in the selected building, room, and date filters.</p></div><span>{summary.roomReadings.length} rooms</span></header>
        <div className="student-monitor-table-wrap"><table><caption>Latest simulated occupancy and stored capacity by room</caption><thead><tr><th>Room</th><th>Building · floor</th><th>Occupants</th><th>Capacity</th><th>Utilization</th><th>Recorded at</th></tr></thead><tbody>
          {summary.roomReadings.map((row) => {
            const capacityValid = Number.isInteger(row.capacity) && row.capacity > 0;
            return <tr key={row.room_id}><td><strong>{row.room_name || row.room_code}</strong><small>{row.room_code}</small></td><td>{row.building_name || row.building_code || "Building unavailable"}<small>Floor {row.floor_number}</small></td><td>{row.occupied_count}</td><td>{capacityValid ? row.capacity : "Unavailable"}</td><td>{capacityValid ? `${Math.round(row.occupied_count / row.capacity * 100)}%` : "Unavailable"}</td><td>{formatTimestamp(row.recorded_at ? new Date(row.recorded_at) : null)}</td></tr>;
          })}
        </tbody></table></div>
      </section>
    </>}

    {view === "empty" && <EmptyState title="No simulated readings match these filters" onReset={resetFilters}>{availableDateRange.from
      ? `The returned readings range from ${availableDateRange.from} through ${availableDateRange.through} UTC. Clear the building, room, and date filters to view all available history.`
      : "No timestamped simulated readings were returned. Refresh the page or check that the documented local demo API is running."}</EmptyState>}
  </main>;
}
