import {
  Building2,
  Users,
  Zap,
  Layers3,
  Search,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";

const buildings = [
  {
    id: 1,
    name: "CSE Building",
    code: "CSE",
    type: "Academic",
    floors: 4,
    rooms: 68,
    occupancy: 72,
    energy: 342,
    status: "normal",
  },
  {
    id: 2,
    name: "Mechanical Block",
    code: "ME",
    type: "Academic",
    floors: 3,
    rooms: 74,
    occupancy: 84,
    energy: 418,
    status: "warning",
  },
  {
    id: 3,
    name: "Central Library",
    code: "LIB",
    type: "Academic",
    floors: 3,
    rooms: 42,
    occupancy: 61,
    energy: 186,
    status: "normal",
  },
  {
    id: 4,
    name: "Admin Block",
    code: "ADM",
    type: "Administration",
    floors: 2,
    rooms: 31,
    occupancy: 43,
    energy: 154,
    status: "normal",
  },
  {
    id: 5,
    name: "Electrical Engineering",
    code: "EE",
    type: "Academic",
    floors: 3,
    rooms: 56,
    occupancy: 69,
    energy: 291,
    status: "normal",
  },
  {
    id: 6,
    name: "Workshop",
    code: "WS",
    type: "Laboratory",
    floors: 2,
    rooms: 28,
    occupancy: 77,
    energy: 376,
    status: "warning",
  },
];

function Buildings() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const filteredBuildings = buildings.filter((building) => {
    const matchesSearch =
      building.name.toLowerCase().includes(search.toLowerCase()) ||
      building.code.toLowerCase().includes(search.toLowerCase());

    const matchesFilter =
      filter === "All" || building.type === filter;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="buildings-page">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Buildings</h1>
          <p>Manage and monitor campus buildings</p>
        </div>

        <div className="page-actions">
          <button>↻ Refresh</button>
          <button className="primary-button">
            + Add Building
          </button>
        </div>
      </div>

      {/* Overview */}
      <div className="building-overview">

        <div className="overview-card">
          <div className="overview-icon">
            <Building2 size={18} />
          </div>

          <div>
            <span>Total Buildings</span>
            <strong>24</strong>
          </div>
        </div>

        <div className="overview-card">
          <div className="overview-icon green">
            <Layers3 size={18} />
          </div>

          <div>
            <span>Operational</span>
            <strong>22</strong>
          </div>
        </div>

        <div className="overview-card">
          <div className="overview-icon yellow">
            <AlertTriangle size={18} />
          </div>

          <div>
            <span>Needs Attention</span>
            <strong>2</strong>
          </div>
        </div>

        <div className="overview-card">
          <div className="overview-icon blue">
            <Users size={18} />
          </div>

          <div>
            <span>Campus Occupancy</span>
            <strong>64.2%</strong>
          </div>
        </div>

      </div>

      {/* Toolbar */}
      <div className="buildings-toolbar">

        <div className="building-search">
          <Search size={16} />

          <input
            type="text"
            placeholder="Search buildings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="building-filters">
          {["All", "Academic", "Administration", "Laboratory"].map(
            (item) => (
              <button
                key={item}
                className={filter === item ? "active" : ""}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            )
          )}
        </div>

      </div>

      {/* Buildings */}
      <div className="buildings-grid">

        {filteredBuildings.map((building) => (
          <div className="building-card" key={building.id}>

            <div className="building-card-header">

              <div className="building-card-icon">
                <Building2 size={20} />
              </div>

              <span
                className={`building-status ${building.status}`}
              >
                <span></span>

                {building.status === "normal"
                  ? "Operational"
                  : "Warning"}
              </span>

            </div>

            <div className="building-card-title">
              <div className="building-code-label">
                {building.code}
              </div>

              <h3>{building.name}</h3>

              <span>{building.type}</span>
            </div>

            {/* Occupancy */}
            <div className="building-occupancy-section">

              <div className="occupancy-heading">
                <span>Occupancy</span>
                <strong>{building.occupancy}%</strong>
              </div>

              <div className="building-progress">
                <div
                  style={{
                    width: `${building.occupancy}%`,
                  }}
                ></div>
              </div>

            </div>

            {/* Metrics */}
            <div className="building-card-metrics">

              <div>
                <Layers3 size={14} />
                <span>Floors</span>
                <strong>{building.floors}</strong>
              </div>

              <div>
                <Building2 size={14} />
                <span>Rooms</span>
                <strong>{building.rooms}</strong>
              </div>

              <div>
                <Zap size={14} />
                <span>Energy</span>
                <strong>{building.energy}</strong>
              </div>

            </div>

            <button className="building-details-button">
              View Details
              <ChevronRight size={14} />
            </button>

          </div>
        ))}

      </div>

      {filteredBuildings.length === 0 && (
        <div className="no-buildings">
          <Building2 size={30} />
          <h3>No buildings found</h3>
          <p>
            Try changing your search or filter.
          </p>
        </div>
      )}

    </div>
  );
}

export default Buildings;