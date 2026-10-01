import { useMemo, useState } from "react";
import { Bell, CheckCheck, CircleAlert, Info, TriangleAlert, X } from "lucide-react";
import "./Alerts.css";

const initialAlerts = [
  { id: 1, title: "Fire Sensor Triggered", description: "Mechanical Building — Floor 2", time: "2m ago", severity: "Critical", unread: true },
  { id: 2, title: "Hostel A Overcrowding", description: "Floor 3 exceeds maximum capacity by 12%", time: "8m ago", severity: "Critical", unread: true },
  { id: 3, title: "Energy Anomaly", description: "Mechanical Block usage 23% above normal", time: "14m ago", severity: "Warning", unread: true },
  { id: 4, title: "Temperature Spike", description: "Workshop temperature at 28.4°C — threshold exceeded", time: "22m ago", severity: "Warning", unread: false },
  { id: 5, title: "Sensor Offline", description: "SEN-T-003 — Hostel A Floor 3 unreachable", time: "34m ago", severity: "Warning", unread: false },
  { id: 6, title: "Room CSE-301 Booking Confirmed", description: "Reserved 2:00 PM – 4:00 PM by Dr. Sharma", time: "1h ago", severity: "Info", unread: false },
  { id: 7, title: "Maintenance Resolved", description: "Door lock in CSE-302 repaired", time: "2h ago", severity: "Info", unread: false },
];
const filters = ["All", "Critical", "Warning", "Info", "Unread"];

function SeverityIcon({ severity }) {
  if (severity === "Critical") return <CircleAlert size={18}/>;
  if (severity === "Warning") return <TriangleAlert size={18}/>;
  return <Info size={18}/>;
}

function Alerts() {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [filter, setFilter] = useState("All");
  const counts = useMemo(() => ({
    critical: alerts.filter((alert) => alert.severity === "Critical").length,
    warning: alerts.filter((alert) => alert.severity === "Warning").length,
    info: alerts.filter((alert) => alert.severity === "Info").length,
    unread: alerts.filter((alert) => alert.unread).length,
  }), [alerts]);
  const visibleAlerts = useMemo(() => alerts.filter((alert) => filter === "All" || (filter === "Unread" ? alert.unread : alert.severity === filter)), [alerts, filter]);

  function markRead(id) {
    setAlerts((items) => items.map((alert) => alert.id === id ? { ...alert, unread: false } : alert));
  }

  return <div className="alerts-page">
    <header className="alerts-heading"><div><h1>Alerts Center</h1><p>Campus-wide notifications and system alerts</p></div><button onClick={() => setAlerts((items) => items.map((alert) => ({ ...alert, unread: false })))}><CheckCheck size={16}/> Mark all read</button></header>

    <section className="alerts-summary" aria-label="Alert counts">
      <article><strong className="critical-text">{counts.critical}</strong><span>Critical</span></article>
      <article><strong className="warning-text">{counts.warning}</strong><span>Warning</span></article>
      <article><strong className="info-text">{counts.info}</strong><span>Information</span></article>
      <article><strong className="unread-text">{counts.unread}</strong><span>Unread</span></article>
    </section>

    <div className="alerts-controls"><div className="alerts-filters" role="tablist" aria-label="Filter alerts">{filters.map((item) => <button role="tab" aria-selected={filter === item} className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div><span>{visibleAlerts.length} alerts</span></div>

    <section className="alerts-list" aria-label="Notifications">
      {visibleAlerts.map((alert) => <article className={`alert-item ${alert.severity.toLowerCase()} ${alert.unread ? "unread" : "read"}`} key={alert.id}>
        <span className="alert-item-icon"><SeverityIcon severity={alert.severity}/></span>
        <div className="alert-item-content"><div className="alert-item-title"><strong>{alert.title}</strong>{alert.unread && <i className="alert-unread-dot"/>}<span className={`alert-severity ${alert.severity.toLowerCase()}`}>{alert.severity}</span></div><p>{alert.description}</p><small>{alert.time}</small></div>
        <div className="alert-item-actions">{alert.unread && <button className="alert-mark-read" onClick={() => markRead(alert.id)}>Mark read</button>}<button className="alert-dismiss" aria-label={`Dismiss ${alert.title}`} onClick={() => setAlerts((items) => items.filter((item) => item.id !== alert.id))}><X size={16}/></button></div>
      </article>)}
      {visibleAlerts.length === 0 && <div className="alerts-empty"><Bell size={24}/><strong>No alerts here</strong><span>Try a different filter.</span></div>}
    </section>
  </div>;
}

export default Alerts;
