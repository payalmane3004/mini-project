import DataUnavailable from "../../components/DataUnavailable";

export default function Energy() {
  return <div className="module-page"><header className="page-header"><div><h1>Energy</h1><p>Building consumption and efficiency</p></div></header><DataUnavailable title="Energy data is not connected" description="No meter integration, energy API, or verified consumption dataset is configured. This page does not estimate usage or cost." sources={["Building meters", "Energy history", "Tariff data"]}/><section className="module-guidance"><h2>Campus geometry is not energy telemetry</h2><p>The CAD model provides building footprints only. It contains no measured energy values, so the Digital Twin labels geometry separately from operational data.</p></section></div>;
}
