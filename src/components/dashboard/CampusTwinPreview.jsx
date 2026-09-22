import { Maximize2, Layers3, RotateCcw } from "lucide-react";

const buildings = [
  {
    id: 1,
    name: "CSE Building",
    x: 18,
    y: 22,
    width: 25,
    height: 20,
    status: "normal",
  },
  {
    id: 2,
    name: "Mechanical Block",
    x: 58,
    y: 18,
    width: 25,
    height: 22,
    status: "warning",
  },
  {
    id: 3,
    name: "Central Library",
    x: 38,
    y: 57,
    width: 23,
    height: 18,
    status: "normal",
  },
  {
    id: 4,
    name: "Admin Block",
    x: 70,
    y: 60,
    width: 18,
    height: 17,
    status: "normal",
  },
];

function CampusTwinPreview() {
  return (
    <div className="twin-card">

      {/* Header */}
      <div className="twin-header">
        <div>
          <h2>Campus Digital Twin</h2>
          <p>Live campus visualization</p>
        </div>

        <div className="twin-actions">
          <button title="Layers">
            <Layers3 size={17} />
          </button>

          <button title="Reset view">
            <RotateCcw size={16} />
          </button>

          <button title="Fullscreen">
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {/* Campus */}
      <div className="campus-map">

        {/* Grid */}
        <div className="map-grid"></div>

        {/* Roads */}
        <div className="road road-horizontal road-one"></div>
        <div className="road road-horizontal road-two"></div>
        <div className="road road-vertical road-three"></div>

        {/* Campus boundary */}
        <div className="campus-boundary"></div>

        {/* Buildings */}
        {buildings.map((building) => (
          <div
            key={building.id}
            className={`map-building ${building.status}`}
            style={{
              left: `${building.x}%`,
              top: `${building.y}%`,
              width: `${building.width}%`,
              height: `${building.height}%`,
            }}
          >
            <div className="building-light"></div>

            <span>{building.name}</span>

            <div className="building-status"></div>
          </div>
        ))}

        {/* Trees */}
        <div className="tree tree-1"></div>
        <div className="tree tree-2"></div>
        <div className="tree tree-3"></div>
        <div className="tree tree-4"></div>

        {/* Map label */}
        <div className="map-label">
          <span className="map-live-dot"></span>
          LIVE CAMPUS
        </div>

        {/* Compass */}
        <div className="compass">
          <span>N</span>
          <div>↑</div>
        </div>

      </div>

      {/* Footer */}
      <div className="twin-footer">
        <div className="map-legend">
          <span>
            <i className="legend-dot normal"></i>
            Normal
          </span>

          <span>
            <i className="legend-dot warning"></i>
            Warning
          </span>

          <span>
            <i className="legend-dot critical"></i>
            Critical
          </span>
        </div>

        <span className="twin-updated">
          Updated just now
        </span>
      </div>

    </div>
  );
}

export default CampusTwinPreview;