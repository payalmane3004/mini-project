import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { Activity, Brain, RefreshCw, Zap } from "lucide-react";
import { fetchAnalyticsSummary } from "../../api/analytics";
import { isValidAnalyticsDateRange, toAnalyticsDateBounds } from "../../api/analyticsDashboardData";
import {
  buildHistoricalReadingSeries, formatSelectedPeriod, getForecastReadiness, getPredictionPageState,
} from "./predictionsData";
import "./Predictions.css";

const numberFormat = new Intl.NumberFormat();

function EmptyState({ children }) {
  return <div className="predictions-empty" role="status">{children}</div>;
}

function EnergyReadingTooltip({ active, payload }) {
  const reading = active && payload?.[0]?.payload;
  if (!reading) return null;
  const timestamp = new Date(reading.timestampMs).toLocaleString();
  return <div className="predictions-tooltip">
    <strong>{reading.building_name} · {reading.building_code}</strong>
    <span>{reading.energyKwh.toFixed(3)} kWh</span>
    <span>{timestamp}</span>
    <small>{reading.source || "Source unavailable"}</small>
  </div>;
}

function Predictions() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedRange, setAppliedRange] = useState({ start: "", end: "" });
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [rangeError, setRangeError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchAnalyticsSummary({
      ...toAnalyticsDateBounds(appliedRange.start, appliedRange.end),
      signal: controller.signal,
    }).then((data) => {
      setSummary(data);
      setError("");
      setLoading(false);
    }).catch((reason) => {
      if (reason.name !== "AbortError") {
        setSummary(null);
        setError("Could not load stored historical readings. Retry the request or check API access.");
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, [appliedRange, retryKey]);

  const series = useMemo(() => buildHistoricalReadingSeries(summary), [summary]);
  const readiness = getForecastReadiness(series);
  const pageState = getPredictionPageState({ loading, error, series });
  const occupancyChart = useMemo(() => series.occupancyByHour.map((bucket) => ({
    ...bucket,
    time: new Date(bucket.timestamp).toLocaleString([], {
      month: "short", day: "numeric", hour: "numeric",
    }),
    sourceLabel: bucket.sources.join(", ") || "Source unavailable",
  })), [series]);

  function applyDateRange(event) {
    event.preventDefault();
    if (!isValidAnalyticsDateRange(dateFrom, dateTo)) {
      setRangeError("Choose valid dates with the start on or before the end.");
      return;
    }
    setRangeError("");
    setLoading(true);
    setError("");
    setAppliedRange({ start: dateFrom, end: dateTo });
  }

  function chooseRecentPeriod(days) {
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const endDate = end.toISOString().slice(0, 10);
    const startDate = start.toISOString().slice(0, 10);
    setDateFrom(startDate);
    setDateTo(endDate);
    setRangeError("");
    setLoading(true);
    setError("");
    setAppliedRange({ start: startDate, end: endDate });
  }

  function showAllDates() {
    setDateFrom("");
    setDateTo("");
    setRangeError("");
    setLoading(true);
    setError("");
    setAppliedRange({ start: "", end: "" });
  }

  function retry() {
    setLoading(true);
    setError("");
    setRetryKey((current) => current + 1);
  }

  const selectedPeriod = formatSelectedPeriod(appliedRange.start, appliedRange.end);

  return <div className="predictions-page">
    <header className="predictions-heading">
      <div>
        <span className="predictions-eyebrow"><Brain size={14} aria-hidden="true"/> CAMPUS INTELLIGENCE</span>
        <h1>Predictive Intelligence</h1>
        <p>Review stored occupancy and energy history before forecasting is enabled.</p>
      </div>
      <button className="predictions-refresh" type="button" onClick={retry} disabled={loading} aria-label="Retry loading historical readings">
        <RefreshCw size={15} aria-hidden="true"/> Refresh
      </button>
    </header>

    <section className="predictions-status-panel" aria-label="Forecasting status">
      <div className="predictions-status-icon" aria-hidden="true"><Activity size={18}/></div>
      <div className="predictions-status-copy">
        <span className="predictions-status-label">Forecasting status</span>
        <strong>{loading ? "Checking stored data" : error ? "Historical data unavailable" : readiness.status}</strong>
        <p>{loading ? "Loading the selected period from the analytics API." : error ? "Forecasting remains unavailable while historical data could not be checked." : readiness.detail}</p>
      </div>
      <span className={`predictions-status-badge ${loading ? "pending" : error ? "error" : readiness.status === "Not configured" ? "unavailable" : "insufficient"}`} role="status">
        {loading ? "Loading" : error ? "Data unavailable" : readiness.status}
      </span>
    </section>

    <form className="predictions-filters" onSubmit={applyDateRange} aria-label="Historical data date range">
      <label htmlFor="predictions-date-from">From<input id="predictions-date-from" type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)}/></label>
      <label htmlFor="predictions-date-to">Through<input id="predictions-date-to" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)}/></label>
      <div className="predictions-filter-actions" role="group" aria-label="Date range actions">
        <button type="submit" disabled={loading}>Apply dates</button>
        <button type="button" onClick={() => chooseRecentPeriod(30)} disabled={loading}>Last 30 days</button>
        <button type="button" onClick={showAllDates} disabled={loading || (!appliedRange.start && !appliedRange.end)}>All dates</button>
      </div>
      <p className="predictions-period">Selected period: <strong>{selectedPeriod}</strong></p>
    </form>

    {rangeError && <p className="predictions-error" role="alert">{rangeError}</p>}
    {pageState === "error" && <div className="predictions-error" role="alert"><span>{error}</span><button type="button" onClick={retry} disabled={loading}><RefreshCw size={14} aria-hidden="true"/> Retry</button></div>}
    {pageState === "loading" && <div className="predictions-loading" role="status">Loading stored historical readings…</div>}

    {pageState !== "loading" && pageState !== "error" && <>
      {pageState === "insufficient" && <section className="predictions-no-history" role="status">
        <Activity size={18} aria-hidden="true"/>
        <div><strong>No timestamped historical readings for this period</strong><p>Occupancy and energy trends need stored readings with valid timestamps. Try all dates if a narrower period is selected. This empty state does not mean current occupancy or energy is zero.</p></div>
      </section>}

      <section className="predictions-trend-grid" aria-label="Stored historical trends">
        <article className="predictions-panel">
          <header className="predictions-panel-heading"><div><h2><Activity size={16} aria-hidden="true"/> Historical Occupancy</h2><p>Average stored occupied count per UTC hour</p></div></header>
          <div className="predictions-panel-summary"><strong>{numberFormat.format(series.occupancyTotal)}</strong><span>stored readings in period</span></div>
          {series.occupancy.length > 0 && <p className="predictions-sample-note">Charted timestamped observations: {numberFormat.format(series.occupancy.length)}{series.occupancyTruncated ? " of a capped API sample" : ""}.</p>}
          {loading ? <EmptyState>Loading occupancy history…</EmptyState> : error ? <EmptyState>Occupancy history is unavailable.</EmptyState> : occupancyChart.length === 0 ? <EmptyState>No timestamped occupancy readings are available in this period.</EmptyState> : <>
            <div className="predictions-chart" role="img" aria-label={`Historical occupancy chart with ${occupancyChart.length} hourly average points`}>
              <ResponsiveContainer width="100%" height="100%"><AreaChart data={occupancyChart} margin={{ top: 10, right: 14, left: 0, bottom: 0 }}>
                <defs><linearGradient id="predictiveOccupancyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c6d9" stopOpacity={0.22}/><stop offset="100%" stopColor="#22c6d9" stopOpacity={0.015}/></linearGradient></defs>
                <CartesianGrid stroke="#293542" strokeDasharray="3 4" vertical={false}/>
                <XAxis dataKey="time" axisLine={false} tickLine={false} interval="preserveStartEnd" tick={{ fill: "#9cacbd", fontSize: 10 }}/>
                <YAxis domain={[0, "auto"]} axisLine={false} tickLine={false} width={42} tick={{ fill: "#9cacbd", fontSize: 10 }}/>
                <Tooltip contentStyle={{ background: "#17212b", border: "1px solid #344552", borderRadius: 7, color: "#e4edf4" }} formatter={(value, _name, item) => [`${Number(value).toFixed(1)} occupied count · ${item.payload.readingCount} readings`, item.payload.sourceLabel]}/>
                <Area type="monotone" dataKey="averageOccupied" name="Hourly average" stroke="#42c9d8" strokeWidth={2} fill="url(#predictiveOccupancyFill)" isAnimationActive={false}/>
              </AreaChart></ResponsiveContainer>
            </div>
            <p className="predictions-chart-caption">Each point averages only stored readings recorded during that UTC hour. No missing hours are filled.</p>
          </>}
        </article>

        <article className="predictions-panel">
          <header className="predictions-panel-heading"><div><h2><Zap size={16} aria-hidden="true"/> Historical Energy</h2><p>Individual stored readings in kWh; no totals are inferred</p></div></header>
          <div className="predictions-panel-summary"><strong>{numberFormat.format(series.energyTotal)}</strong><span>stored readings in period</span></div>
          {series.energy.length > 0 && <p className="predictions-sample-note">Charted individual readings: {numberFormat.format(series.energy.length)}{series.energyTruncated ? " of a capped API sample" : ""}.</p>}
          {loading ? <EmptyState>Loading energy history…</EmptyState> : error ? <EmptyState>Energy history is unavailable.</EmptyState> : series.energy.length === 0 ? <EmptyState>No timestamped energy readings are available in this period.</EmptyState> : <>
            <div className="predictions-chart" role="img" aria-label={`Individual historical energy chart with ${series.energy.length} readings`}>
              <ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#293542" strokeDasharray="3 4" vertical={false}/>
                <XAxis type="number" dataKey="timestampMs" name="Recorded at" domain={["dataMin", "dataMax"]} tickFormatter={(value) => new Date(value).toLocaleDateString([], { month: "short", day: "numeric" })} axisLine={false} tickLine={false} tick={{ fill: "#9cacbd", fontSize: 10 }}/>
                <YAxis type="number" dataKey="energyKwh" name="Energy" unit=" kWh" domain={[0, "auto"]} axisLine={false} tickLine={false} width={52} tick={{ fill: "#9cacbd", fontSize: 10 }}/>
                <Tooltip content={<EnergyReadingTooltip/>}/>
                <Scatter data={series.energy} dataKey="energyKwh" fill="#e0ad55" name="Individual reading" isAnimationActive={false}/>
              </ScatterChart></ResponsiveContainer>
            </div>
            <p className="predictions-chart-caption">Each point is one timestamped database reading. Source and building details are available on hover.</p>
          </>}
        </article>
      </section>

      <section className="predictions-requirements">
        <div><span>Forecasting prerequisites</span><h2>What must be available first</h2></div>
        <p>CampusSphere needs a forecasting service, a defined target and horizon, and timestamped historical observations suitable for validation against held-out data. This page displays stored history only; it does not produce forecasts or model evaluations.</p>
      </section>
      {summary?.occupancy_truncated || summary?.energy_truncated ? <p className="predictions-limit-note">The analytics API response is capped. Counts show the endpoint totals; charts use only the returned timestamped sample.</p> : null}
    </>}
  </div>;
}

export default Predictions;
