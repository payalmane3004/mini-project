import {
  Building2,
  DoorOpen,
  Users,
  Zap,
  Bell,
  Wrench,
} from "lucide-react";

const icons = {
  buildings: Building2,
  rooms: DoorOpen,
  occupancy: Users,
  energy: Zap,
  alerts: Bell,
  maintenance: Wrench,
};

function StatCard({
  type,
  title,
  value,
  subtitle,
  trend,
  trendType = "neutral",
}) {
  const Icon = icons[type];

  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <div className={`stat-icon ${type}`}>
          <Icon size={19} strokeWidth={1.8} />
        </div>

        {trend && (
          <span className={`stat-trend ${trendType}`}>
            {trend}
          </span>
        )}
      </div>

      <div className="stat-title">{title}</div>

      <div className="stat-value">{value}</div>

      <div className="stat-subtitle">{subtitle}</div>
    </div>
  );
}

export default StatCard;