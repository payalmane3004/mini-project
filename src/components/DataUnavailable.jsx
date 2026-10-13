import { Database, Radio } from "lucide-react";

export default function DataUnavailable({ title, description, sources }) {
  return <section className="data-unavailable" aria-labelledby="data-unavailable-title">
    <div className="data-unavailable-icon"><Radio size={22}/></div>
    <div><p className="data-eyebrow">SOURCE STATUS · UNAVAILABLE</p><h2 id="data-unavailable-title">{title}</h2><p>{description}</p>
      <div className="data-source-list">{sources.map((source) => <span key={source}><Database size={14}/>{source}<b>Not connected</b></span>)}</div>
    </div>
  </section>;
}
