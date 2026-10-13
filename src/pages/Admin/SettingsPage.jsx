import { useState } from "react";
import { Bell, Shield, Wifi } from "lucide-react";
import "./SettingsPage.css";

const initialPreferences = {
  criticalAlerts: true,
  emailDigest: true,
  maintenanceReminders: false,
  dataRetention: true,
  anonymizeReports: true,
  websocketFeed: false,
  restApi: false,
};

const settingGroups = [
  {
    title: "Notifications",
    icon: Bell,
    items: [
      { id: "criticalAlerts", title: "Critical Alerts", description: "Receive immediate notifications for critical events" },
      { id: "emailDigest", title: "Email Digest", description: "Daily summary of campus activity" },
      { id: "maintenanceReminders", title: "Maintenance Reminders", description: "Notifications for upcoming maintenance tasks" },
    ],
  },
  {
    title: "Data & Privacy",
    icon: Shield,
    items: [
      { id: "dataRetention", title: "Data Retention", description: "Keep sensor data for 90 days" },
      { id: "anonymizeReports", title: "Anonymize Reports", description: "Remove personal data from exported reports" },
    ],
  },
  {
    title: "Integrations",
    icon: Wifi,
    items: [
      { id: "websocketFeed", title: "WebSocket Live Feed", description: "Local preference only; no sensor feed is connected" },
      { id: "restApi", title: "REST API Access", description: "Local preference only; no API service is configured" },
    ],
  },
];

function SettingSwitch({ enabled, label, onToggle }) {
  return <button className={`settings-switch ${enabled ? "on" : "off"}`} role="switch" aria-checked={enabled} aria-label={label} onClick={onToggle}><span/></button>;
}

function SettingsPage() {
  const [preferences, setPreferences] = useState(initialPreferences);
  function toggle(id) {
    setPreferences((current) => ({ ...current, [id]: !current[id] }));
  }

  return <div className="settings-page">
    <header className="settings-heading"><h1>Settings</h1><p>Local demonstration preferences</p></header>
    <div className="workspace-demo-note">These switches are held in this page session. No notification service, sensor feed, data retention job, or external API is connected.</div>
    <div className="settings-column">
      <section className="settings-system-card">
        <h2>SYSTEM INFORMATION</h2>
        <dl className="settings-system-grid">
          <div><dt>Platform Version</dt><dd>v2.4.1</dd></div>
          <div><dt>Campus</dt><dd>Walchand College of Engineering</dd></div>
          <div><dt>Last Sync</dt><dd>Not connected</dd></div>
          <div><dt>Active Sensors</dt><dd>Unavailable</dd></div>
          <div><dt>API Status</dt><dd>Not connected</dd></div>
          <div><dt>Data Mode</dt><dd>Local demonstration</dd></div>
        </dl>
      </section>
      {settingGroups.map(({ title, icon: Icon, items }) => <section className="settings-group-card" key={title}>
        <header><Icon size={17}/><h2>{title}</h2></header>
        <div>{items.map((item) => <div className="settings-preference" key={item.id}><div><strong>{item.title}</strong><p>{item.description}</p></div><SettingSwitch enabled={preferences[item.id]} label={item.title} onToggle={() => toggle(item.id)}/></div>)}</div>
      </section>)}
    </div>
  </div>;
}

export default SettingsPage;
