import { DoorOpen, Radio, TrendingUp, TriangleAlert, Users } from "lucide-react";
import DataUnavailable from "../../components/DataUnavailable";

const summary = [
  { icon: Users, label: "CURRENT OCCUPANCY", note: "Campus-wide", tone: "cyan" },
  { icon: TrendingUp, label: "PEAK OCCUPANCY", note: "Daily peak", tone: "amber" },
  { icon: DoorOpen, label: "AVAILABLE ROOMS", note: "Room records", tone: "green" },
  { icon: TriangleAlert, label: "OVERCROWDED", note: "Capacity alerts", tone: "red" },
];

function MetricCard({ icon: Icon, label, note, tone }) {
  return (
    <article className="occupancy-metric">
      <div className={`occupancy-metric-icon ${tone}`}><Icon size={19} strokeWidth={1.8} /></div>
      <div className="occupancy-metric-label">{label}</div>
      <strong className="occupancy-metric-value">—</strong>
      <div className="occupancy-metric-note">{note} · unavailable</div>
    </article>
  );
}

function EmptyPanel({ description }) {
  return (
    <div className="module-chart-empty" role="status">
      <Radio size={19} aria-hidden="true" />
      <strong>No occupancy readings</strong>
      <p>{description}</p>
    </div>
  );
}

export default function Occupancy() {
  return (
    <div className="occupancy-page module-page">
      <header className="occupancy-page-heading">
        <h1>Occupancy Monitoring</h1>
        <p>Campus people counts and space utilization</p>
      </header>

      <DataUnavailable
        title="Occupancy telemetry is not connected"
        description="No occupancy API or sensor feed is configured. Summary values and charts will appear when verified readings are available."
        sources={["People counters", "Room capacity records", "Occupancy history"]}
      />

      <section className="occupancy-metrics" aria-label="Occupancy summary">
        {summary.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </section>

      <section className="occupancy-panel occupancy-trend-panel">
        <header className="occupancy-panel-heading">
          <div><h2>Campus Occupancy</h2><p>Occupancy history across campus buildings</p></div>
        </header>
        <div className="occupancy-trend-chart">
          <EmptyPanel description="A time series will be shown after an occupancy history source is connected." />
        </div>
      </section>

      <section className="occupancy-detail-grid">
        <article className="occupancy-panel occupancy-building-panel">
          <header className="occupancy-panel-heading"><h2>Occupancy by Building</h2></header>
          <div className="occupancy-building-chart">
            <EmptyPanel description="Building comparisons require verified occupancy readings and room capacities." />
          </div>
        </article>

        <article className="occupancy-panel occupancy-heatmap-panel">
          <header className="occupancy-panel-heading"><div><h2>Occupancy Heatmap</h2><p>Occupancy by building and time</p></div></header>
          <div className="occupancy-heatmap-scroll">
            <EmptyPanel description="The heatmap will populate when timestamped building occupancy data is available." />
          </div>
        </article>
      </section>
    </div>
  );
}
