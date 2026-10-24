import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import { fetchPublishedEmergencyAlerts } from "../../api/student";

function StudentEmergency() {
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetchPublishedEmergencyAlerts().then((items) => { if (active) { setAlerts(items); setStatus("ready"); setError(""); } })
      .catch((reason) => { if (active) { setStatus("error"); setError(reason.message); } });
    return () => { active = false; };
  }, [retryKey]);

  return <div className="student-emergency-page">
    <div className="student-page-header"><div><h1>Emergency &amp; Safety</h1><p>Published emergency alerts and campus safety information.</p></div></div>
    <section className="student-emergency-config" role="note"><ShieldAlert size={24} /><div><h2>Campus emergency information needs configuration</h2><p>Official campus security and medical contacts, evacuation routes, and approved instructions have not been verified in CampusSphere. Contact college authorities using the official channels provided by your institution.</p></div></section>
    <section className="student-panel"><div className="student-panel-header"><div><h2>Current alerts</h2><p>Only active, unexpired alerts published by an administrator appear here.</p></div><AlertTriangle size={20} /></div>
      {status === "loading" && <p role="status">Loading alerts…</p>}
      {status === "error" && <div className="student-dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={() => setRetryKey((key) => key + 1)}><RefreshCw size={15} /> Retry</button></div>}
      {status === "ready" && alerts.length === 0 && <p>No current published emergency alerts.</p>}
      {status === "ready" && alerts.map((alert) => <article className="student-live-notice" key={alert.id}><div><AlertTriangle size={18} /><span>{alert.severity} alert</span></div><h3>{alert.title}</h3><p>{alert.message}</p><small>{alert.created_at ? new Date(alert.created_at).toLocaleString() : "Publication time unavailable"}</small></article>)}
    </section>
    <section className="student-panel"><div className="student-panel-header"><div><h2>Incident reporting</h2><p>A student reporting endpoint is not configured.</p></div></div><p>Submitting reports here would not contact emergency services or campus authorities. For immediate danger, use your institution's verified emergency contact process.</p></section>
  </div>;
}

export default StudentEmergency;
