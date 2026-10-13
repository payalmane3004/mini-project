import DataUnavailable from "../../components/DataUnavailable";

export default function Occupancy() {
  return <div className="module-page"><header className="page-header"><div><h1>Occupancy</h1><p>Campus people counts and space utilization</p></div></header><DataUnavailable title="Occupancy telemetry is not connected" description="This project has no occupancy API or sensor feed. Sample figures have been removed so this page does not imply live monitoring." sources={["People counters", "Room capacity records", "Occupancy history"]}/><section className="module-guidance"><h2>What is available here</h2><p>Campus building footprints and source labels are available in the Digital Twin. Room-level capacity and sensor readings are not present in the repository.</p></section></div>;
}
