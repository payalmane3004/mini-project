import { AlertTriangle, DollarSign, Lightbulb, Radio, TrendingDown, Zap } from "lucide-react";
import DataUnavailable from "../../components/DataUnavailable";

const summary = [
  { icon: Zap, title: "CURRENT DEMAND", detail: "Instantaneous", tone: "cyan" },
  { icon: Zap, title: "TODAY'S USAGE", detail: "Daily total", tone: "cyan" },
  { icon: TrendingDown, title: "MONTHLY USAGE", detail: "Monthly total", tone: "green" },
  { icon: DollarSign, title: "ENERGY COST", detail: "Tariff data", tone: "amber" },
];

function MetricCard({ icon: Icon, title, detail, tone }) {
  return (
    <article className="energy-metric">
      <div className={`energy-metric-icon ${tone}`}><Icon size={19} strokeWidth={1.8} /></div>
      <div className="energy-metric-title">{title}</div>
      <strong className="energy-metric-value">—</strong>
      <div className="energy-metric-detail">{detail} · unavailable</div>
    </article>
  );
}

function EmptyPanel({ children }) {
  return (
    <div className="module-chart-empty" role="status">
      <Radio size={19} aria-hidden="true" />
      <strong>No verified energy data</strong>
      <p>{children}</p>
    </div>
  );
}

export default function Energy() {
  return (
    <div className="energy-page module-page">
      <header className="energy-page-heading">
        <h1>Energy Intelligence</h1>
        <p>Building consumption and efficiency</p>
      </header>

      <DataUnavailable
        title="Energy data is not connected"
        description="No meter integration, energy API, or verified consumption dataset is configured. Usage and cost values will appear when a trusted source is connected."
        sources={["Building meters", "Energy history", "Tariff data"]}
      />

      <section className="energy-metrics" aria-label="Energy summary">
        {summary.map((metric) => <MetricCard key={metric.title} {...metric} />)}
      </section>

      <section className="energy-panel energy-consumption-panel">
        <header className="energy-panel-heading energy-consumption-heading">
          <div><h2>Energy Consumption</h2><p>Campus-wide usage over time</p></div>
          <span className="source-chip">Awaiting meter data</span>
        </header>
        <div className="energy-consumption-chart">
          <EmptyPanel>Consumption trends will be shown after verified meter readings are available.</EmptyPanel>
        </div>
      </section>

      <section className="energy-detail-grid">
        <article className="energy-panel energy-building-panel">
          <header className="energy-panel-heading"><h2>Energy by Building</h2></header>
          <div className="energy-building-chart">
            <EmptyPanel>Building comparisons require connected meters and a consistent reporting period.</EmptyPanel>
          </div>
        </article>

        <div className="energy-insights-column">
          <article className="energy-panel energy-anomalies-panel">
            <header className="energy-panel-heading"><h2><AlertTriangle size={16} /> Energy Anomalies</h2></header>
            <div className="energy-insight-list"><EmptyPanel>Anomaly detection is unavailable until verified energy history is connected.</EmptyPanel></div>
          </article>
          <article className="energy-panel energy-savings-panel">
            <header className="energy-panel-heading"><h2><Lightbulb size={16} /> Saving Opportunities</h2></header>
            <div className="energy-insight-list"><EmptyPanel>Recommendations require measured energy use and supporting operational data.</EmptyPanel></div>
          </article>
        </div>
      </section>
    </div>
  );
}
