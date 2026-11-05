import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { Activity, Brain, RefreshCw, TrendingUp, Zap } from "lucide-react";
import { fetchAnalyticsSummary } from "../../api/analytics";
import { fetchPredictionSummary } from "../../api/predictions.js";
import { isValidAnalyticsDateRange, toAnalyticsDateBounds } from "../../api/analyticsDashboardData";
import { useDemoMode } from "../../components/layout/useDemoMode.js";
import { buildHistoricalReadingSeries, formatSelectedPeriod, getHistoricalDateRange } from "./predictionsData";
import "./Predictions.css";

const numberFormat = new Intl.NumberFormat();
const percentFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

function EmptyState({ children }) {
  return <div className="predictions-empty" role="status">{children}</div>;
}

function timestampLabel(value, options = { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "UTC" }) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : `${date.toLocaleString([], options)} UTC`;
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

function QualityNote({ quality, coverage }) {
  return <p className="predictions-quality">
    Data quality: <strong>{quality?.quality || "limited"}</strong>
    {Number.isFinite(coverage) ? ` · ${percentFormat.format(coverage)}% facility coverage` : ""}
    {quality?.latest_reading ? ` · latest ${timestampLabel(quality.latest_reading)}` : ""}
  </p>;
}

function RequirementsNote({ data, requirements, metricLabel }) {
  const quality = data?.data_quality;
  if (!quality || !requirements) return null;
  return <div className="predictions-data-requirements">
    <strong>{metricLabel} history</strong>
    <span>{numberFormat.format(quality.records_available)} / {numberFormat.format(quality.records_required)} timestamped readings</span>
    <span>{numberFormat.format(quality.history_days)} / {numberFormat.format(quality.history_days_required)} days</span>
    <p>{quality.reason}</p>
  </div>;
}

function Predictions() {
  const demoMode = useDemoMode();
  const [initialRange] = useState(() => getHistoricalDateRange());
  const [dateFrom, setDateFrom] = useState(initialRange.start);
  const [dateTo, setDateTo] = useState(initialRange.end);
  const [appliedRange, setAppliedRange] = useState(initialRange);
  const [summary, setSummary] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [predictionError, setPredictionError] = useState("");
  const [resolvedSummaryKey, setResolvedSummaryKey] = useState("");
  const [resolvedPredictionKey, setResolvedPredictionKey] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [rangeError, setRangeError] = useState("");
  const summaryRequestKey = JSON.stringify([appliedRange.start, appliedRange.end, demoMode, retryKey]);
  const predictionRequestKey = JSON.stringify([demoMode, retryKey]);
  const summaryLoading = resolvedSummaryKey !== summaryRequestKey;
  const predictionLoading = resolvedPredictionKey !== predictionRequestKey;

  useEffect(() => {
    const controller = new AbortController();
    fetchAnalyticsSummary({
      ...toAnalyticsDateBounds(appliedRange.start, appliedRange.end),
      includeDemo: demoMode,
      signal: controller.signal,
    }).then((data) => {
      setSummary(data);
      setSummaryError("");
    }).catch((reason) => {
      if (reason.name !== "AbortError") {
        setSummary(null);
        setSummaryError("Could not load stored historical readings. Check API access and retry.");
      }
    }).finally(() => {
      if (!controller.signal.aborted) setResolvedSummaryKey(summaryRequestKey);
    });
    return () => controller.abort();
  }, [appliedRange, retryKey, demoMode, summaryRequestKey]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPredictionSummary({ includeDemo: demoMode, signal: controller.signal }).then((data) => {
      setPredictions(data);
      setPredictionError("");
    }).catch((reason) => {
      if (reason.name !== "AbortError") {
        setPredictions(null);
        setPredictionError(reason.message || "Could not load predictive analytics.");
      }
    }).finally(() => {
      if (!controller.signal.aborted) setResolvedPredictionKey(predictionRequestKey);
    });
    return () => controller.abort();
  }, [retryKey, demoMode, predictionRequestKey]);

  const series = useMemo(() => buildHistoricalReadingSeries(summary), [summary]);
  const occupancyChart = useMemo(() => series.occupancyByHour.map((bucket) => ({
    ...bucket,
    time: new Date(bucket.timestamp).toLocaleString([], {
      month: "short", day: "numeric", hour: "numeric", timeZone: "UTC",
    }),
    sourceLabel: bucket.sources.join(", ") || "Source unavailable",
  })), [series]);
  const forecastOccupancyChart = useMemo(() => (predictions?.occupancy?.forecast_points || []).map((point) => ({
    ...point,
    time: timestampLabel(point.forecast_at),
  })), [predictions]);
  const forecastEnergyChart = useMemo(() => (predictions?.energy?.forecast_points || []).map((point) => ({
    ...point,
    time: timestampLabel(point.forecast_at),
  })), [predictions]);
  const occupancyAverage = forecastOccupancyChart.length
    ? forecastOccupancyChart.reduce((sum, point) => sum + point.expected_utilization_percent, 0) / forecastOccupancyChart.length
    : null;
  const energyAverage = forecastEnergyChart.length
    ? forecastEnergyChart.reduce((sum, point) => sum + point.expected_energy_kwh, 0) / forecastEnergyChart.length
    : null;
  const readiness = predictionError
    ? { status: "Prediction data unavailable", detail: "Forecast data could not be checked. Historical charts may still be available." }
    : predictions?.occupancy?.available && predictions?.energy?.available
      ? { status: "Historical baseline available", detail: "Seven-day estimates are based on repeated weekday/hour readings. They are transparent baselines, not a trained or validated model." }
      : predictions?.occupancy?.available || predictions?.energy?.available
        ? { status: "Partial baseline available", detail: "Only metrics with sufficient historical coverage are estimated. Other metrics remain unavailable until their data requirements are met." }
        : { status: "Insufficient historical data", detail: "Predictions are withheld until timestamped history has enough duration, repeated time slots, and facility coverage." };
  const loading = summaryLoading || predictionLoading;
  const selectedPeriod = formatSelectedPeriod(appliedRange.start, appliedRange.end);

  function applyDateRange(event) {
    event.preventDefault();
    if (!isValidAnalyticsDateRange(dateFrom, dateTo)) {
      setRangeError("Choose valid dates with the start on or before the end.");
      return;
    }
    setRangeError("");
    setAppliedRange({ start: dateFrom, end: dateTo });
  }

  function chooseRecentPeriod(days) {
    const range = getHistoricalDateRange(days);
    setDateFrom(range.start);
    setDateTo(range.end);
    setRangeError("");
    setAppliedRange(range);
  }

  function showAllDates() {
    setDateFrom("");
    setDateTo("");
    setRangeError("");
    setAppliedRange({ start: "", end: "" });
  }

  function retry() {
    setSummaryError("");
    setPredictionError("");
    setRetryKey((current) => current + 1);
  }

  return <div className="predictions-page">
    <header className="predictions-heading">
      <div>
        <span className="predictions-eyebrow"><Brain size={14} aria-hidden="true"/> CAMPUS INTELLIGENCE</span>
        <h1>Predictive Intelligence</h1>
        <p>Evidence-based occupancy and energy baselines from timestamped facility history.</p>
      </div>
      <button className="predictions-refresh" type="button" onClick={retry} disabled={loading} aria-label="Retry loading predictive data">
        <RefreshCw size={15} aria-hidden="true"/> Refresh
      </button>
    </header>

    {predictions?.demo_preview && <p className="predictions-demo-banner" role="status">DEMO PREVIEW · Simulated historical readings from the isolated local demo database. These estimates are not live campus data.</p>}

    <section className="predictions-status-panel" aria-label="Forecasting status">
      <div className="predictions-status-icon" aria-hidden="true"><Activity size={18}/></div>
      <div className="predictions-status-copy">
        <span className="predictions-status-label">Forecasting status</span>
        <strong>{loading ? "Checking historical data" : readiness.status}</strong>
        <p>{loading ? "Loading the selected history and the latest 56 days of prediction inputs." : readiness.detail}</p>
      </div>
      <span className={`predictions-status-badge ${loading ? "pending" : predictionError ? "error" : predictions?.occupancy?.available || predictions?.energy?.available ? "available" : "insufficient"}`} role="status">
        {loading ? "Loading" : predictionError ? "Unavailable" : readiness.status}
      </span>
    </section>

    <form className="predictions-filters" onSubmit={applyDateRange} aria-label="Historical data date range">
      <label htmlFor="predictions-date-from">From<input id="predictions-date-from" type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)}/></label>
      <label htmlFor="predictions-date-to">Through<input id="predictions-date-to" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)}/></label>
      <div className="predictions-filter-actions" role="group" aria-label="Date range actions">
        <button type="submit" disabled={summaryLoading}>Apply dates</button>
        <button type="button" onClick={() => chooseRecentPeriod(30)} disabled={summaryLoading}>Last 30 days</button>
        <button type="button" onClick={showAllDates} disabled={summaryLoading || (!appliedRange.start && !appliedRange.end)}>All dates</button>
      </div>
      <p className="predictions-period">Historical chart period: <strong>{selectedPeriod}</strong>. Forecast inputs use the latest 56 days.</p>
    </form>

    {rangeError && <p className="predictions-error" role="alert">{rangeError}</p>}
    {predictionError && <div className="predictions-error" role="alert"><span>{predictionError}</span><button type="button" onClick={retry} disabled={loading}><RefreshCw size={14} aria-hidden="true"/> Retry</button></div>}
    {summaryError && <div className="predictions-error" role="alert"><span>{summaryError}</span><button type="button" onClick={retry} disabled={loading}><RefreshCw size={14} aria-hidden="true"/> Retry</button></div>}

    <section className="predictions-forecast-grid" aria-label="Seven-day baseline forecasts">
      <article className="predictions-panel predictions-forecast-panel">
        <header className="predictions-panel-heading"><div><h2><TrendingUp size={16} aria-hidden="true"/> Expected Occupancy Utilization</h2><p>Seven-day weekday/hour historical baseline</p></div></header>
        {predictions?.occupancy?.available ? <>
          <div className="predictions-forecast-value"><strong>{percentFormat.format(occupancyAverage)}%</strong><span>average expected utilization</span></div>
          <QualityNote quality={predictions.occupancy.data_quality} coverage={predictions.occupancy.coverage_percent}/>
          <div className="predictions-chart predictions-forecast-chart" role="img" aria-label={`Seven-day occupancy utilization baseline with ${forecastOccupancyChart.length} points`}>
            <ResponsiveContainer width="100%" height="100%"><AreaChart data={forecastOccupancyChart} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#293542" strokeDasharray="3 4" vertical={false}/>
              <XAxis dataKey="time" axisLine={false} tickLine={false} interval="preserveStartEnd" tick={{ fill: "#9cacbd", fontSize: 9 }}/>
              <YAxis domain={[0, 100]} unit="%" axisLine={false} tickLine={false} width={42} tick={{ fill: "#9cacbd", fontSize: 10 }}/>
              <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Expected utilization"]}/>
              <Area type="monotone" dataKey="expected_utilization_percent" name="Expected utilization" stroke="#42c9d8" strokeWidth={2} fill="#22c6d9" fillOpacity={0.12} isAnimationActive={false}/>
            </AreaChart></ResponsiveContainer>
          </div>
        </> : loading ? <EmptyState>Loading occupancy forecast inputs…</EmptyState> : predictionError ? <EmptyState>Occupancy forecast inputs are unavailable.</EmptyState> : <>
          <EmptyState>Not enough operational occupancy history for a forecast.</EmptyState>
          <RequirementsNote data={predictions?.occupancy} requirements={predictions?.requirements} metricLabel="Occupancy"/>
        </>}
      </article>

      <article className="predictions-panel predictions-forecast-panel">
        <header className="predictions-panel-heading"><div><h2><Zap size={16} aria-hidden="true"/> Expected Energy</h2><p>Expected kWh across covered buildings per recorded interval</p></div></header>
        {predictions?.energy?.available ? <>
          <div className="predictions-forecast-value"><strong>{energyAverage.toFixed(2)}</strong><span>kWh per interval · covered buildings</span></div>
          <QualityNote quality={predictions.energy.data_quality} coverage={predictions.energy.coverage_percent}/>
          <div className="predictions-chart predictions-forecast-chart" role="img" aria-label={`Seven-day energy baseline with ${forecastEnergyChart.length} points`}>
            <ResponsiveContainer width="100%" height="100%"><AreaChart data={forecastEnergyChart} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#293542" strokeDasharray="3 4" vertical={false}/>
              <XAxis dataKey="time" axisLine={false} tickLine={false} interval="preserveStartEnd" tick={{ fill: "#9cacbd", fontSize: 9 }}/>
              <YAxis domain={[0, "auto"]} unit=" kWh" axisLine={false} tickLine={false} width={55} tick={{ fill: "#9cacbd", fontSize: 10 }}/>
              <Tooltip formatter={(value) => [`${Number(value).toFixed(3)} kWh`, "Expected reading"]}/>
              <Area type="monotone" dataKey="expected_energy_kwh" name="Expected energy" stroke="#d9ad5e" strokeWidth={2} fill="#d9ad5e" fillOpacity={0.12} isAnimationActive={false}/>
            </AreaChart></ResponsiveContainer>
          </div>
        </> : loading ? <EmptyState>Loading energy forecast inputs…</EmptyState> : predictionError ? <EmptyState>Energy forecast inputs are unavailable.</EmptyState> : <>
          <EmptyState>Not enough operational energy history for a forecast.</EmptyState>
          <RequirementsNote data={predictions?.energy} requirements={predictions?.requirements} metricLabel="Energy"/>
        </>}
      </article>
    </section>

    <section className="predictions-insights-grid">
      <article className="predictions-panel">
        <header className="predictions-panel-heading"><div><h2><Activity size={16} aria-hidden="true"/> Peak Usage Periods</h2><p>Highest expected occupancy by covered room capacity</p></div></header>
        {predictions?.occupancy?.available && predictions.occupancy.peak_usage.length ? <ol className="predictions-insight-list">
          {predictions.occupancy.peak_usage.map((peak) => <li key={peak.forecast_at}><span>{timestampLabel(peak.forecast_at)}</span><strong>{percentFormat.format(peak.expected_utilization_percent)}%</strong><small>{peak.rooms_covered}/{peak.rooms_total} rooms covered</small></li>)}
        </ol> : <EmptyState>Peak periods will appear when occupancy history meets the coverage requirements.</EmptyState>}
      </article>
      <article className="predictions-panel">
        <header className="predictions-panel-heading"><div><h2><Activity size={16} aria-hidden="true"/> Underutilized Rooms</h2><p>Average observed use below 20% on sampled daytime readings</p></div></header>
        {predictions?.occupancy?.available && predictions.occupancy.underutilized_rooms.length ? <ul className="predictions-insight-list">
          {predictions.occupancy.underutilized_rooms.map((room) => <li key={room.room_id}><span>{room.room_code} · {room.building_name || room.building_code}</span><strong>{percentFormat.format(room.average_utilization_percent)}%</strong><small>{room.observation_days} observed days</small></li>)}
        </ul> : <EmptyState>{predictions?.occupancy?.available ? "No room met the underutilization threshold in the observed daytime periods." : "Room utilization needs sufficient timestamped occupancy and room-capacity data."}</EmptyState>}
      </article>
    </section>

    <section className="predictions-panel predictions-recommendations">
      <header className="predictions-panel-heading"><div><h2>Actionable Recommendations</h2><p>Derived only from the reported history and baseline estimates</p></div></header>
      {predictionError ? <EmptyState>Recommendations are unavailable until prediction data can be loaded.</EmptyState> : <ul className="predictions-recommendation-list">
        {(predictions?.recommendations || []).map((item, index) => <li key={`${item.title}-${index}`}><strong>{item.title}</strong><span>{item.detail}</span></li>)}
      </ul>}
    </section>

    <section className="predictions-requirements">
      <div><span>Baseline method and limits</span><h2>How estimates are produced</h2></div>
      <p>{predictions?.method || "The baseline compares each weekday/hour with matching readings from the prior 28 days."} Predictions need at least 28 days of history, at least three matching observations per time slot, and 70% facility coverage. They are simple historical baselines, not a validated forecasting model.</p>
    </section>

    <section className="predictions-trend-grid" aria-label="Stored historical trends">
      <article className="predictions-panel">
        <header className="predictions-panel-heading"><div><h2><Activity size={16} aria-hidden="true"/> Historical Occupancy</h2><p>Average stored occupied count per UTC hour</p></div></header>
        <div className="predictions-panel-summary"><strong>{numberFormat.format(series.occupancyTotal)}</strong><span>stored readings in selected period</span></div>
        {series.occupancy.length > 0 && <p className="predictions-sample-note">Charted timestamped observations: {numberFormat.format(series.occupancy.length)}{series.occupancyTruncated ? " of a capped API sample" : ""}.</p>}
        {summaryLoading ? <EmptyState>Loading occupancy history…</EmptyState> : summaryError ? <EmptyState>Occupancy history is unavailable.</EmptyState> : occupancyChart.length === 0 ? <EmptyState>No timestamped occupancy readings are available in this period.</EmptyState> : <>
          <div className="predictions-chart" role="img" aria-label={`Historical occupancy chart with ${occupancyChart.length} hourly average points`}>
            <ResponsiveContainer width="100%" height="100%"><AreaChart data={occupancyChart} margin={{ top: 10, right: 14, left: 0, bottom: 0 }}>
              <defs><linearGradient id="predictiveOccupancyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c6d9" stopOpacity={0.22}/><stop offset="100%" stopColor="#22c6d9" stopOpacity={0.015}/></linearGradient></defs>
              <CartesianGrid stroke="#293542" strokeDasharray="3 4" vertical={false}/>
              <XAxis dataKey="time" axisLine={false} tickLine={false} interval="preserveStartEnd" tick={{ fill: "#9cacbd", fontSize: 10 }}/>
              <YAxis domain={[0, "auto"]} axisLine={false} tickLine={false} width={42} tick={{ fill: "#9cacbd", fontSize: 10 }}/>
              <Tooltip formatter={(value, _name, item) => [`${Number(value).toFixed(1)} occupied count · ${item.payload.readingCount} readings`, item.payload.sourceLabel]}/>
              <Area type="monotone" dataKey="averageOccupied" name="Hourly average" stroke="#42c9d8" strokeWidth={2} fill="url(#predictiveOccupancyFill)" isAnimationActive={false}/>
            </AreaChart></ResponsiveContainer>
          </div>
        </>}
      </article>

      <article className="predictions-panel">
        <header className="predictions-panel-heading"><div><h2><Zap size={16} aria-hidden="true"/> Historical Energy</h2><p>Individual stored readings in kWh; no totals are inferred</p></div></header>
        <div className="predictions-panel-summary"><strong>{numberFormat.format(series.energyTotal)}</strong><span>stored readings in selected period</span></div>
        {series.energy.length > 0 && <p className="predictions-sample-note">Charted individual readings: {numberFormat.format(series.energy.length)}{series.energyTruncated ? " of a capped API sample" : ""}.</p>}
        {summaryLoading ? <EmptyState>Loading energy history…</EmptyState> : summaryError ? <EmptyState>Energy history is unavailable.</EmptyState> : series.energy.length === 0 ? <EmptyState>No timestamped energy readings are available in this period.</EmptyState> : <>
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
  </div>;
}

export default Predictions;
