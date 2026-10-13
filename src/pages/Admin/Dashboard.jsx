import StatsGrid from "../../components/dashboard/StatsGrid";
import CampusStatus from "../../components/dashboard/CampusStatus";
import OccupancyChart from "../../components/dashboard/OccupancyChart";
import RecentAlerts from "../../components/dashboard/RecentAlerts";
import { Link } from "react-router-dom";

function Dashboard() {
  return (
    <div>

      <div className="page-header">
        <div>
          <h1>Campus Overview</h1>

          <p>
            Campus CAD inventory and clearly labelled demonstration widgets
          </p>
        </div>

        <div className="page-actions"><Link to="/buildings" className="primary-button">Browse campus buildings</Link></div>
      </div>

      <div className="workspace-demo-note">Overview widgets use illustrative sample values. Live occupancy, energy, and alert feeds are not connected.</div>

      <StatsGrid />

      <div className="campus-section">
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
