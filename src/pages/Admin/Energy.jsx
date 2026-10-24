import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, CalendarDays, Clock3, Radio, RefreshCw, TriangleAlert, Zap } from "lucide-react";
import { fetchEnergyReadings } from "../../api/energy";
import "./Energy.css";

const SOURCE_COLORS = ["#39c9df", "#63d69b", "#f2b75f", "#a78bfa", "#fb7185", "#60a5fa"];

function sourceLabel(source) {
  if (!source?.trim()) return "Source not specified";
  return source.trim().toUpperCase() === "SIMULATED" ? "Simulated" : `Stored source: ${source.trim()}`;
}

function formatTimestamp(value) {
  if (!value) return "Timestamp unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Invalid timestamp" : date.toLocaleString();
}

function dateStart(value) {
  return value ? `${value}T00:00:00Z` : undefined;
}

function dateEndExclusive(value) {
  if (!value) return undefined;
  const end = new Date(`${value}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return end.toISOString();
}

function EmptyChart({ title, description }) {
  return <div className="module-chart-empty energy-empty" role="status"><Radio size={19} aria-hidden="true"/><strong>{title}</strong><p>{description}</p></div>;
}

function ReadingTooltip({ active, payload }) {
  const reading = active && payload?.[0]?.payload;
  if (!reading) return null;
  return <div className="energy-chart-tooltip"><strong>{reading.building_name} · {reading.building_code}</strong><span>{reading.energy_kwh.toFixed(3)} kWh</span><span>{formatTimestamp(reading.recorded_at)}</span><small>{reading.source_label}</small></div>;
}

function Metric({ icon: Icon, label, value, detail, tone }) {
  return <article className="energy-metric">
    <div className={`energy-metric-icon ${tone}`}><Icon size={19} strokeWidth={1.8}/></div>
    <div className="energy-metric-title">{label}</div>
    <strong className="energy-metric-value">{value}</strong>
    <div className="energy-metric-detail">{detail}</div>
  </article>;
}

export default function Energy() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedRange, setAppliedRange] = useState({ start: undefined, end: undefined });
  const [sourceFilter, setSourceFilter] = useState("all");
  const [reloadKey, setReloadKey] = useState(0);
  const [validationError, setValidationError] = useState("");
  const [state, setState] = useState({ loading: true, error: "", readings: [], truncated: false });

  useEffect(() => {
    const controller = new AbortController();
    fetchEnergyReadings({ ...appliedRange, signal: controller.signal })
      .then((result) => setState({ loading: false, error: "", readings: result.readings, truncated: result.truncated }))
      .catch((error) => {
        if (error.name !== "AbortError") setState((current) => ({ ...current, loading: false, error: error.message }));
      });
    return () => controller.abort();
  }, [appliedRange, reloadKey]);

  const { loading, error, readings, truncated } = state;
  const visibleReadings = useMemo(() => readings.filter((reading) => {
    const isSimulated = reading.reading_source?.trim().toUpperCase() === "SIMULATED";
    return sourceFilter === "all" || (sourceFilter === "simulated" ? isSimulated : !isSimulated);
  }), [readings, sourceFilter]);
  const chartReadings = useMemo(() => visibleReadings.flatMap((reading) => {
    const value = Number(reading.energy_kwh);
    const timestampMs = reading.recorded_at ? new Date(reading.recorded_at).getTime() : Number.NaN;
    if (!Number.isFinite(value) || value < 0 || !Number.isFinite(timestampMs)) return [];
    return [{ ...reading, energy_kwh: value, timestampMs, source_label: sourceLabel(reading.reading_source) }];
  }), [visibleReadings]);
  const sourceSeries = useMemo(() => {
    const series = new Map();
    chartReadings.forEach((reading) => {
      if (!series.has(reading.source_label)) series.set(reading.source_label, []);
      series.get(reading.source_label).push(reading);
    });
    return [...series.entries()];
  }, [chartReadings]);
  const latestReading = visibleReadings.reduce((latest, reading) => {
    if (!reading.recorded_at) return latest;
    const timestamp = new Date(reading.recorded_at);
    return !Number.isNaN(timestamp.getTime()) && (!latest || timestamp > new Date(latest.recorded_at)) ? reading : latest;
  }, null);
  const buildingLatest = useMemo(() => {
    const latest = new Map();
    chartReadings.forEach((reading) => {
      const key = reading.building_code;
      if (!latest.has(key) || reading.timestampMs > latest.get(key).timestampMs) latest.set(key, reading);
    });
    return [...latest.values()].sort((a, b) => a.building_code.localeCompare(b.building_code));
  }, [chartReadings]);

  function applyDateRange(event) {
    event.preventDefault();
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setValidationError("The start date must be on or before the end date.");
      return;
    }
    setValidationError("");
    setState((current) => ({ ...current, loading: true, error: "" }));
    setAppliedRange({ start: dateStart(dateFrom), end: dateEndExclusive(dateTo) });
  }

  function refresh() {
    setState((current) => ({ ...current, loading: true, error: "" }));
    setReloadKey((value) => value + 1);
  }

  const periodLabel = dateFrom || dateTo ? `${dateFrom || "Earliest"} to ${dateTo || "Latest"}` : "All recorded dates";

  return <div className="energy-page module-page">
    <header className="energy-page-heading">
      <div><h1>Energy Intelligence</h1><p>Stored building energy readings · values are in kWh</p></div>
      <button className="energy-refresh" type="button" onClick={refresh} disabled={loading}><RefreshCw size={15}/>Refresh</button>
    </header>

    <div className="energy-data-note"><Zap size={16}/><span>Readings are loaded from PostgreSQL. No live meter feed is connected. The stored source is shown as metadata; SIMULATED readings stay labeled and can be filtered separately.</span></div>

    <form className="energy-filters" onSubmit={applyDateRange}>
      <label><CalendarDays size={15}/>From<input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)}/></label>
      <label><CalendarDays size={15}/>Through<input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)}/></label>
      <label>Source<select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="all">All stored sources</option><option value="recorded">Exclude SIMULATED</option><option value="simulated">SIMULATED only</option></select></label>
      <button type="submit" disabled={loading}>Apply period</button>
      <span className="energy-period-label">{periodLabel}</span>
    </form>

    {validationError && <p className="energy-api-error" role="alert">{validationError}</p>}
    {error && <div className="energy-api-error" role="alert"><TriangleAlert size={16}/><span>{error}</span><button type="button" onClick={refresh}>Retry</button></div>}
    {loading && <p className="energy-loading" role="status">Loading stored energy readings…</p>}

    <section className="energy-metrics" aria-label="Energy readings summary" aria-busy={loading}>
      <Metric icon={Zap} label="READINGS IN PERIOD" value={loading || error ? "—" : visibleReadings.length} detail={truncated ? "Response is limited; refine the date range" : periodLabel} tone="cyan"/>
      <Metric icon={Zap} label="LATEST READING" value={loading || error || !latestReading ? "—" : `${Number(latestReading.energy_kwh).toFixed(3)} kWh`} detail={latestReading ? sourceLabel(latestReading.reading_source) : "No timestamped reading"} tone="green"/>
      <Metric icon={Building2} label="BUILDINGS REPORTING" value={loading || error ? "—" : new Set(visibleReadings.map((reading) => reading.building_code)).size} detail="Buildings linked by database foreign key" tone="amber"/>
      <Metric icon={Clock3} label="LATEST TIMESTAMP" value={loading || error || !latestReading ? "—" : formatTimestamp(latestReading.recorded_at)} detail="From the stored reading record" tone="cyan"/>
    </section>

    {truncated && <p className="energy-api-error" role="status">The API returned the most recent 1,000 readings in this range. Narrow the date range to inspect a complete period.</p>}

    <section className="energy-panel energy-consumption-panel">
      <header className="energy-panel-heading energy-consumption-heading"><div><h2>Energy readings over time</h2><p>Each point is a stored kWh reading; colors separate stored source tags</p></div><span className="source-chip">{loading ? "Loading" : `${chartReadings.length} timestamped points`}</span></header>
      <div className={`energy-consumption-chart energy-chart-wrap${!loading && !error && sourceSeries.length === 0 ? " is-empty" : ""}`}>
        {loading ? <EmptyChart title="Loading readings" description="The chart will update when the API responds."/>
          : error ? <EmptyChart title="Readings unavailable" description="Retry after the backend connection is restored."/>
            : sourceSeries.length === 0 ? <EmptyChart title={readings.length === 0 ? "No stored energy readings" : "No timestamped readings to chart"} description={readings.length === 0 ? "The energy_readings table currently has no records for this period." : "Stored values without a valid timestamp remain in the table but cannot be plotted over time."}/>
              : <ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 12, right: 20, bottom: 22, left: 5 }}>
                <CartesianGrid stroke="#2b3745" strokeDasharray="3 3"/>
                <XAxis type="number" dataKey="timestampMs" domain={["dataMin", "dataMax"]} tickFormatter={(value) => new Date(value).toLocaleDateString()} name="Recorded at" stroke="#8292a6" tick={{ fontSize: 10 }}/>
                <YAxis type="number" dataKey="energy_kwh" name="Energy" unit=" kWh" stroke="#8292a6" tick={{ fontSize: 10 }} width={74}/>
                <Tooltip content={<ReadingTooltip/>}/><Legend/>
                {sourceSeries.map(([source, points], index) => <Scatter key={source} name={source} data={points} fill={SOURCE_COLORS[index % SOURCE_COLORS.length]}/>) }
              </ScatterChart></ResponsiveContainer>}
      </div>
    </section>

    <section className="energy-panel energy-building-panel energy-comparison-panel">
      <header className="energy-panel-heading"><div><h2>Latest reading by building</h2><p>Same kWh unit; timestamps and source tags can differ. Values are not period totals.</p></div></header>
      <div className={`energy-building-chart energy-chart-wrap${!loading && !error && buildingLatest.length === 0 ? " is-empty" : ""}`}>
        {loading ? <EmptyChart title="Loading readings" description="Building associations will appear with stored readings."/>
          : error ? <EmptyChart title="Building readings unavailable" description="Retry after the backend connection is restored."/>
            : buildingLatest.length === 0 ? <EmptyChart title="No linked building readings" description="A comparison requires timestamped readings linked to database buildings."/>
              : <ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={buildingLatest} margin={{ top: 8, right: 28, bottom: 8, left: 8 }}>
                <CartesianGrid stroke="#2b3745" strokeDasharray="3 3" horizontal={false}/>
                <XAxis type="number" dataKey="energy_kwh" unit=" kWh" stroke="#8292a6" tick={{ fontSize: 10 }}/>
                <YAxis type="category" dataKey="building_code" width={82} stroke="#8292a6" tick={{ fontSize: 10 }}/>
                <Tooltip content={<ReadingTooltip/>}/>
                <Bar dataKey="energy_kwh" name="Latest stored reading" radius={[0, 4, 4, 0]}>
                  {buildingLatest.map((reading) => <Cell key={`${reading.building_code}-${reading.id}`} fill={reading.reading_source?.toUpperCase() === "SIMULATED" ? "#f2b75f" : "#39c9df"}/>)}
                </Bar>
              </BarChart></ResponsiveContainer>}
      </div>
    </section>

    <p className="energy-semantics-note">The database confirms kWh as the stored unit, but does not specify whether successive values are interval consumption or cumulative meter-register values. A period consumption total is therefore not calculated. No tariff, anomaly, or savings estimates are shown without supporting data.</p>

    <section className="energy-panel energy-records-panel">
      <header className="energy-panel-heading"><div><h2>Stored readings</h2><p>Chronological records returned by the API, with provenance labels intact</p></div></header>
      {loading ? <p className="energy-table-state" role="status">Loading readings…</p>
        : error ? <p className="energy-table-state">Records are unavailable until the API responds.</p>
          : visibleReadings.length === 0 ? <EmptyChart title={readings.length ? "No readings match this source filter" : "No stored energy readings"} description={readings.length ? "Choose another source option to view the returned records." : "There are no energy readings in PostgreSQL for the selected period."}/>
            : <div className="energy-table-scroll"><table className="energy-table"><thead><tr><th>Recorded at</th><th>Building</th><th>Energy reading</th><th>Source</th></tr></thead><tbody>
              {visibleReadings.map((reading) => <tr key={reading.id}><td>{formatTimestamp(reading.recorded_at)}</td><td><strong>{reading.building_name}</strong><small>{reading.building_code}</small></td><td>{Number(reading.energy_kwh).toFixed(3)} kWh</td><td><span className={`energy-source-tag${reading.reading_source?.toUpperCase() === "SIMULATED" ? " simulated" : ""}`}>{sourceLabel(reading.reading_source)}</span></td></tr>)}
            </tbody></table></div>}
    </section>
  </div>;
}
