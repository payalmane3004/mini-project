import {
  Building2,
  Users,
  Zap,
  Thermometer,
  Layers3,
  RotateCcw,
  Maximize2,
  X,
  Activity,
} from "lucide-react";
import { useState } from "react";

const buildings = [
  {
    id: 1,
    name: "CSE Building",
    code: "CSE",
    x: 15,
    y: 20,
    width: 27,
    height: 22,
    status: "normal",
    occupancy: 72,
    energy: 342,
    temperature: 24.6,
    floors: 4,
    rooms: 68,
  },
  {
    id: 2,
    name: "Mechanical Block",
    code: "ME",
    x: 57,
    y: 16,
    width: 27,
    height: 24,
    status: "warning",
    occupancy: 84,
    energy: 418,
    temperature: 26.8,
    floors: 3,
    rooms: 74,
  },
  {
    id: 3,
    name: "Central Library",
    code: "LIB",
    x: 36,
    y: 57,
    width: 24,
    height: 18,
    status: "normal",
    occupancy: 61,
    energy: 186,
    temperature: 23.9,
    floors: 3,
    rooms: 42,
  },
  {
    id: 4,
    name: "Admin Block",
    code: "ADM",
    x: 69,
    y: 59,
    width: 19,
    height: 17,
    status: "normal",
    occupancy: 43,
    energy: 154,
    temperature: 24.1,
    floors: 2,
    rooms: 31,
  },
];

function DigitalTwin() {
  const [selectedBuilding, setSelectedBuilding] = useState(null);

  return (
    <div className="digital-twin-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Digital Twin</h1>
          <p>Interactive real-time model of the campus</p>
        </div>

        <div className="page-actions">
          <button>
            <RotateCcw size={15} />
            Reset View
          </button>

          <button>
            <Maximize2 size={15} />
            Fullscreen
          </button>
        </div>
      </div>

      {/* Main Twin Area */}
      <div className="twin-layout">

        {/* Campus View */}
        <div className="twin-view-card">
          <div className="twin-toolbar">
            <div className="twin-title">
              <Layers3 size={17} />
              <span>Campus Digital Twin</span>
            </div>

            <div className="live-indicator">
              <span className="live-dot"></span>
              LIVE
            </div>
          </div>

          <div className="twin-map">

            {/* Grid */}
            <div className="map-grid"></div>

            {/* Campus Boundary */}
            <div className="campus-boundary"></div>

            {/* Roads */}
            <div className="road road-horizontal road-1"></div>
            <div className="road road-horizontal road-2"></div>
            <div className="road road-vertical road-3"></div>

            {/* Buildings */}
            {buildings.map((building) => (
              <button
                key={building.id}
                className={`twin-building ${building.status} ${
                  selectedBuilding?.id === building.id ? "selected" : ""
                }`}
                style={{
                  left: `${building.x}%`,
                  top: `${building.y}%`,
                  width: `${building.width}%`,
                  height: `${building.height}%`,
                }}
                onClick={() => setSelectedBuilding(building)}
              >
                <Building2 size={20} />

                <span className="building-code">
                  {building.code}
                </span>

                <span className="building-occupancy">
                  {building.occupancy}%
                </span>
              </button>
            ))}

            {/* Trees */}
            <span className="tree tree-1">●</span>
            <span className="tree tree-2">●</span>
            <span className="tree tree-3">●</span>
            <span className="tree tree-4">●</span>
            <span className="tree tree-5">●</span>

            {/* Compass */}
            <div className="compass">
              <span>N</span>
              <div>↑</div>
            </div>

            {/* Legend */}
            <div className="twin-legend">
              <div>
                <span className="legend-dot normal"></span>
                Normal
              </div>

              <div>
                <span className="legend-dot warning"></span>
                Warning
              </div>

              <div>
                <span className="legend-dot critical"></span>
                Critical
              </div>
            </div>

            <div className="map-status">
              <Activity size={13} />
              All sensors connected
            </div>
          </div>
        </div>

        {/* Building Details */}
        <div className="building-panel">

          {!selectedBuilding ? (
            <div className="empty-building-panel">
              <Building2 size={34} />
              <h3>Select a building</h3>
              <p>
                Click any building on the digital twin to view
                real-time information.
              </p>
            </div>
          ) : (
            <>
              <div className="building-panel-header">
                <div>
                  <div className="building-panel-code">
                    {selectedBuilding.code}
                  </div>

                  <h2>{selectedBuilding.name}</h2>

                  <span
                    className={`status-pill ${selectedBuilding.status}`}
                  >
                    <span></span>
                    {selectedBuilding.status === "normal"
                      ? "Operational"
                      : "Attention Required"}
                  </span>
                </div>

                <button
                  className="close-panel"
                  onClick={() => setSelectedBuilding(null)}
                >
                  <X size={17} />
                </button>
              </div>

              <div className="building-metrics">

                <div className="building-metric">
                  <div className="metric-icon occupancy">
                    <Users size={17} />
                  </div>

                  <div>
                    <span>Occupancy</span>
                    <strong>
                      {selectedBuilding.occupancy}%
                    </strong>
                  </div>
                </div>

                <div className="building-metric">
                  <div className="metric-icon energy">
                    <Zap size={17} />
                  </div>

                  <div>
                    <span>Energy Usage</span>
                    <strong>
                      {selectedBuilding.energy} kWh
                    </strong>
                  </div>
                </div>

                <div className="building-metric">
                  <div className="metric-icon temperature">
                    <Thermometer size={17} />
                  </div>

                  <div>
                    <span>Temperature</span>
                    <strong>
                      {selectedBuilding.temperature}°C
                    </strong>
                  </div>
                </div>

                <div className="building-metric">
                  <div className="metric-icon floors">
                    <Layers3 size={17} />
                  </div>

                  <div>
                    <span>Floors</span>
                    <strong>
                      {selectedBuilding.floors}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="panel-section">
                <div className="panel-section-title">
                  Building Information
                </div>

                <div className="info-row">
                  <span>Total Rooms</span>
                  <strong>{selectedBuilding.rooms}</strong>
                </div>

                <div className="info-row">
                  <span>Occupied Rooms</span>
                  <strong>
                    {Math.round(
                      selectedBuilding.rooms *
                        (selectedBuilding.occupancy / 100)
                    )}
                  </strong>
                </div>

                <div className="info-row">
                  <span>Sensor Status</span>
                  <strong className="online-text">
                    Online
                  </strong>
                </div>
              </div>

              <div className="panel-section">
                <div className="panel-section-title">
                  Occupancy
                </div>

                <div className="occupancy-progress">
                  <div
                    style={{
                      width: `${selectedBuilding.occupancy}%`,
                    }}
                  ></div>
                </div>

                <div className="progress-label">
                  <span>Current occupancy</span>
                  <strong>
                    {selectedBuilding.occupancy}%
                  </strong>
                </div>
              </div>

              <button className="view-building-button">
                View Floors & Rooms →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default DigitalTwin;