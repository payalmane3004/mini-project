import { useEffect, useState } from "react";
import { AlertTriangle, Bell, RefreshCw, XCircle } from "lucide-react";
import { deactivateEmergencyAlert, fetchAdminAlerts, publishEmergencyAlert } from "../../api/admin";
import "./Alerts.css";

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetchAdminAlerts().then((rows) => { if (active) { setAlerts(rows); setStatus("ready"); setError(""); } })
      .catch((reason) => { if (active) { setStatus("error"); setError(reason.message); } });
    return () => { active = false; };
  }, [retryKey]);

  async function submit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const expires = form.get("expires_at");
    setBusy(true); setError(""); setMessage("");
    try {
      const alert = await publishEmergencyAlert({ title: form.get("title").trim(), message: form.get("message").trim(), severity: form.get("severity"), expires_at: expires ? new Date(expires).toISOString() : null });
      setAlerts((items) => [alert, ...items]); formElement.reset(); setMessage("Alert published to students.");
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function deactivate(id) {
    setBusy(true); setError(""); setMessage("");
    try { const updated = await deactivateEmergencyAlert(id); setAlerts((items) => items.map((item) => item.id === id ? updated : item)); setMessage("Alert deactivated."); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  return <div className="alerts-page">
    <header className="alerts-heading"><div><h1>Emergency Alerts</h1><p>Publish and manage database-backed campus alerts.</p></div></header>
    <div className="workspace-demo-note">Publishing makes the alert visible to students immediately. Verify the message and severity before publishing. Alerts can be deactivated; expired alerts stop appearing in the student view.</div>
    <form className="admin-alert-form" onSubmit={submit}><h2>Publish an alert</h2><label>Title<input name="title" maxLength={200} required /></label><label>Message<textarea name="message" required rows="3" /></label><div><label>Severity<select name="severity" defaultValue="MEDIUM"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></label><label>Expiry (optional)<input name="expires_at" type="datetime-local" /></label></div><button type="submit" disabled={busy}>Publish alert</button></form>
    {(error || message) && <p role={error ? "alert" : "status"}>{error || message}</p>}
    {status === "loading" && <p role="status">Loading alerts…</p>}
    {status === "error" && <div role="alert"><span>{error}</span><button type="button" onClick={() => setRetryKey((key) => key + 1)}><RefreshCw size={15} /> Retry</button></div>}
    {status === "ready" && alerts.length === 0 && <div className="alerts-empty"><Bell size={24}/><strong>No alerts</strong><span>No alerts have been created.</span></div>}
    {status === "ready" && <section className="alerts-list" aria-label="Stored alerts">{alerts.map((alert) => <article className={`alert-item ${alert.severity.toLowerCase()}`} key={alert.id}><span className="alert-item-icon"><AlertTriangle size={18}/></span><div className="alert-item-content"><div className="alert-item-title"><strong>{alert.title}</strong>{alert.is_demo && <span>DEMO ONLY · fictional</span>}<span className={`alert-severity ${alert.severity.toLowerCase()}`}>{alert.severity}</span><span>{alert.active ? "Enabled" : "Disabled"}</span></div><p>{alert.message}</p><small>Created {alert.created_at ? new Date(alert.created_at).toLocaleString() : "time unavailable"}{alert.expires_at ? ` · expires ${new Date(alert.expires_at).toLocaleString()}` : " · no expiry"}</small></div>{alert.active && <button type="button" className="alert-dismiss" disabled={busy} onClick={() => deactivate(alert.id)} aria-label={`Deactivate ${alert.title}`}><XCircle size={17}/></button>}</article>)}</section>}
  </div>;
}

export default Alerts;
