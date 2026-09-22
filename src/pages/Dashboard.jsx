import StatsGrid from "../components/dashboard/StatsGrid";
import CampusTwinPreview from "../components/dashboard/CampusTwinPreview";
import CampusStatus from "../components/dashboard/CampusStatus";
import OccupancyChart from "../components/dashboard/OccupancyChart";
import RecentAlerts from "../components/dashboard/RecentAlerts";

function Dashboard() {
  return (
    <div>

      <div className="page-header">
        <div>
          <h1>Campus Overview</h1>

          <p>
            Real-time status of your campus digital twin
          </p>
        </div>

        <div className="page-actions">
          <button>↻ Refresh</button>

          <button className="primary-button">
            ↓ Export
          </button>
        </div>
      </div>

      <StatsGrid />

      <div className="campus-section">
        <CampusTwinPreview />
        <CampusStatus />
      </div>

      <div className="bottom-section">
        <OccupancyChart />
        <RecentAlerts />
      </div>

    </div>
  );
}

export default Dashboard;