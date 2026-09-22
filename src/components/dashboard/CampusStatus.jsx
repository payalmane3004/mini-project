import {
  Building2,
  ChevronRight,
  CircleAlert,
} from "lucide-react";

const buildings = [
  {
    name: "CSE Building",
    code: "CSE",
    occupancy: "72%",
    status: "normal",
  },
  {
    name: "Mechanical Block",
    code: "ME",
    occupancy: "84%",
    status: "warning",
  },
  {
    name: "Central Library",
    code: "LIB",
    occupancy: "61%",
    status: "normal",
  },
  {
    name: "Admin Block",
    code: "ADM",
    occupancy: "43%",
    status: "normal",
  },
];

function CampusStatus() {
  return (
    <div className="status-card">

      <div className="status-header">
        <div>
          <h2>Campus Status</h2>
          <p>Building health overview</p>
        </div>

        <Building2 size={19} />
      </div>

      <div className="status-summary">
        <div className="overall-status">
          <span className="overall-dot"></span>

          <div>
            <strong>All Systems Operational</strong>
            <span>22 of 24 buildings online</span>
          </div>
        </div>

        <span className="status-alert">
          <CircleAlert size={14} />
          2 warnings
        </span>
      </div>

      <div className="building-list">

        {buildings.map((building) => (
          <div className="building-row" key={building.code}>

            <div className="building-info">
              <div className={`building-icon ${building.status}`}>
                <Building2 size={16} />
              </div>

              <div>
                <strong>{building.name}</strong>
                <span>
                  Occupancy {building.occupancy}
                </span>
              </div>
            </div>

            <div className="building-right">

              <span className={`status-pill ${building.status}`}>
                <i></i>
                {building.status}
              </span>

              <ChevronRight size={15} />

            </div>

          </div>
        ))}

      </div>

      <button className="view-buildings">
        View all buildings
        <ChevronRight size={15} />
      </button>

    </div>
  );
}

export default CampusStatus;