import { useEffect, useState } from "react";
import { DoorOpen, RefreshCw, TriangleAlert, Users } from "lucide-react";
import { fetchLatestOccupancy } from "../../api/occupancy";
import "./Occupancy.css";

const metrics = [
  { key: "rooms", icon: DoorOpen, label: "ROOMS WITH READINGS", tone: "green" },
  { key: "people", icon: Users, label: "LATEST RECORDED OCCUPANTS", tone: "cyan" },
  { key: "capacity", icon: TriangleAlert, label: "ROOMS WITH CAPACITY", tone: "amber" },
  { key: "updated", icon: RefreshCw, label: "MOST RECENT READING", tone: "red" },
];

function formatTimestamp(value) {
  if (!value) return "Timestamp unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Invalid timestamp" : date.toLocaleString();
}

function floorName(number) {
  return number === 0 ? "Ground Floor" : number === 1 ? "First Floor" : `Floor ${number}`;
}

function sourceDescription(source) {
  const normalized = source?.trim().toUpperCase();
  if (normalized?.includes("SIMULAT")) return "Simulated demo data";
  if (normalized === "RECORDED_VIDEO") return "Recorded video source tag";
  if (normalized === "LIVE" || normalized === "SENSOR" || normalized === "LIVE_SENSOR") {
    return `Source tag: ${source} (not independently verified)`;
  }
  return source ? `Recorded · ${source}` : "Recorded · source not specified";
}

function EmptyState({ roomCount }) {
  const title = roomCount === 0 ? "No verified room records" : "No occupancy readings";
  const message = roomCount === 0
    ? "The database has no room records yet. CAD annotations are not treated as rooms or occupancy data."
    : `The database contains ${roomCount} room record${roomCount === 1 ? "" : "s"}, but none has a stored occupancy reading.`;
  return <div className="module-chart-empty occupancy-empty" role="status"><DoorOpen size={21} aria-hidden="true"/><strong>{title}</strong><p>{message}</p></div>;
}

export default function Occupancy() {
  const [reloadKey, setReloadKey] = useState(0);
  const [includeDemo, setIncludeDemo] = useState(false);
  const [state, setState] = useState({ loading: true, error: "", roomCount: 0, readings: [] });

  useEffect(() => {
    const controller = new AbortController();
    fetchLatestOccupancy({ signal: controller.signal, includeDemo })
      .then((result) => setState({ loading: false, error: "", roomCount: result.room_count, readings: result.readings }))
      .catch((error) => {
        if (error.name !== "AbortError") setState((current) => ({ ...current, loading: false, error: error.message }));
      });
    return () => controller.abort();
  }, [includeDemo, reloadKey]);

  const { loading, error, roomCount, readings } = state;
  const refresh = () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    setReloadKey((value) => value + 1);
  };
  const capacityReadings = readings.filter((reading) => Number.isInteger(reading.capacity) && reading.capacity > 0);
  const latestTimestamp = readings.reduce((latest, reading) => {
    if (!reading.recorded_at) return latest;
    const candidate = new Date(reading.recorded_at);
    return !Number.isNaN(candidate.getTime()) && (!latest || candidate > latest) ? candidate : latest;
  }, null);
  const metricValues = {
    rooms: readings.length,
    people: readings.length ? readings.reduce((total, reading) => total + reading.occupied_count, 0) : "—",
    capacity: capacityReadings.length,
    updated: latestTimestamp ? latestTimestamp.toLocaleString() : "—",
  };

  return (
    <div className="occupancy-page module-page">
      <header className="occupancy-page-heading">
        <div><h1>Occupancy Monitoring</h1><p>{includeDemo ? "Explicit preview including simulated demo readings" : "Latest stored readings for verified database rooms"}</p></div>
        <button className="occupancy-refresh" type="button" onClick={refresh} disabled={loading}>
          <RefreshCw size={15} className={loading ? "occupancy-refresh-spinning" : ""} /> Refresh
        </button>
        <button className="occupancy-refresh" type="button" aria-pressed={includeDemo} onClick={() => { setState((current) => ({ ...current, loading: true, error: "" })); setIncludeDemo((value) => !value); }} disabled={loading}>
          {includeDemo ? "Hide simulated demo data" : "Show simulated demo data"}
        </button>
      </header>

      <p className="occupancy-data-note">{includeDemo ? "DEMO PREVIEW: occupancy values are simulated fictional data and are excluded from operational counts. They are not live measurements." : "Latest stored reading per room; timestamps may differ, so this is not a live campus count. Simulated readings are excluded. Recorded video analysis and CCTV streaming are not implemented."}</p>

      {error && <div className="occupancy-api-error" role="alert"><TriangleAlert size={17}/><span>{error}</span><button type="button" onClick={refresh}>Retry</button></div>}
      {loading && <p className="occupancy-loading" role="status">Loading room occupancy from the database…</p>}

      <section className="occupancy-metrics" aria-label="Latest occupancy summary" aria-busy={loading}>
        {metrics.map(({ key, icon: Icon, label, tone }) => (
          <article className="occupancy-metric" key={key}>
            <div className={`occupancy-metric-icon ${tone}`}><Icon size={19} strokeWidth={1.8}/></div>
            <div className="occupancy-metric-label">{label}</div>
            <strong className={`occupancy-metric-value${key === "updated" ? " timestamp" : ""}`}>{loading || error ? "—" : metricValues[key]}</strong>
            <div className="occupancy-metric-note">{key === "rooms" ? `of ${roomCount} database rooms` : key === "capacity" ? "positive capacity stored" : key === "people" ? readings.length ? "sum of latest room readings" : "No occupancy readings available" : "from stored timestamps"}</div>
          </article>
        ))}
      </section>

      <section className="occupancy-panel occupancy-readings-panel">
        <header className="occupancy-panel-heading"><div><h2>Latest reading by room</h2><p>One most-recent database reading per room · ordered by building and floor</p></div></header>
        {loading ? <p className="occupancy-table-state" role="status">Waiting for the occupancy API…</p>
          : error ? <p className="occupancy-table-state">Room readings are unavailable until the API responds.</p>
            : readings.length === 0 ? <EmptyState roomCount={roomCount}/>
              : <div className="occupancy-table-scroll"><table className="occupancy-table">
                <thead><tr><th>Room</th><th>Building · floor</th><th>Latest occupancy</th><th>Stored capacity</th><th>Last updated</th><th>Source</th></tr></thead>
                <tbody>{readings.map((reading) => {
                  const hasCapacity = Number.isInteger(reading.capacity) && reading.capacity > 0;
                  const percentage = hasCapacity ? Math.round((reading.occupied_count / reading.capacity) * 100) : null;
                  return <tr key={reading.id}>
                    <td><strong>{reading.room_name || reading.room_code}</strong><small>{reading.room_code}</small></td>
                    <td>{reading.building_name || reading.building_code || "Building not linked"}<small>{floorName(reading.floor_number)}</small></td>
                    <td>{reading.occupied_count}</td>
                    <td>{hasCapacity ? <>{reading.capacity}<small>{percentage}% of stored capacity</small></> : "Not recorded"}</td>
                    <td>{formatTimestamp(reading.recorded_at)}</td>
                    <td><span className="occupancy-source-tag">{sourceDescription(reading.source)}</span></td>
                  </tr>;
                })}</tbody>
              </table></div>}
      </section>
      <p className="occupancy-source-disclaimer">Capacity is shown only when a positive value exists on the database room record. Source labels and timestamps are displayed as stored; they do not establish that a feed is live or that video analysis ran.</p>
    </div>
  );
}
