import {
  AlertTriangle,
  Zap,
  Wrench,
  Thermometer,
  ChevronRight,
} from "lucide-react";

const alerts = [
  {
    icon: AlertTriangle,
    title: "High occupancy detected",
    location: "Mechanical Block · Floor 2",
    time: "4 min ago",
    severity: "warning",
  },
  {
    icon: Zap,
    title: "Energy consumption spike",
    location: "CSE Building · Floor 3",
    time: "18 min ago",
    severity: "critical",
  },
  {
    icon: Wrench,
    title: "Maintenance request",
    location: "Central Library · Room 204",
    time: "32 min ago",
    severity: "info",
  },
  {
    icon: Thermometer,
    title: "Temperature above threshold",
    location: "Admin Block · Server Room",
    time: "48 min ago",
    severity: "warning",
  },
];

function RecentAlerts() {
  return (
    <div className="alerts-card">

      <div className="alerts-header">
        <div>
          <h2>Recent Alerts</h2>
          <p>Latest campus events requiring attention</p>
        </div>

        <span className="alert-count">7 active</span>
      </div>

      <div className="alerts-list">

        {alerts.map((alert, index) => {
          const Icon = alert.icon;

          return (
            <div className="alert-row" key={index}>

              <div className={`alert-icon ${alert.severity}`}>
                <Icon size={16} />
              </div>

              <div className="alert-content">
                <strong>{alert.title}</strong>

                <span>{alert.location}</span>
              </div>

              <div className="alert-time">
                {alert.time}
              </div>

            </div>
          );
        })}

      </div>

      <button className="view-alerts">
        View all alerts
        <ChevronRight size={15} />
      </button>

    </div>
  );
}

export default RecentAlerts;