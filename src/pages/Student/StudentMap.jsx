import { useState } from "react";
import {
  Map,
  MapPin,
  Building2,
  Library,
  FlaskConical,
  Users,
  Navigation,
  Info,
} from "lucide-react";

const buildings = [
  {
    id: "CSE",
    name: "CSE Building",
    type: "Academic",
    floors: 4,
    rooms: 68,
    x: 28,
    y: 28,
    icon: Building2,
  },
  {
    id: "ME",
    name: "Mechanical Block",
    type: "Academic",
    floors: 3,
    rooms: 74,
    x: 62,
    y: 25,
    icon: Building2,
  },
  {
    id: "LIB",
    name: "Central Library",
    type: "Library",
    floors: 3,
    rooms: 42,
    x: 48,
    y: 50,
    icon: Library,
  },
  {
    id: "EE",
    name: "Electrical Engineering",
    type: "Academic",
    floors: 3,
    rooms: 56,
    x: 75,
    y: 55,
    icon: Building2,
  },
  {
    id: "ADM",
    name: "Admin Block",
    type: "Administration",
    floors: 2,
    rooms: 31,
    x: 25,
    y: 70,
    icon: Users,
  },
  {
    id: "WS",
    name: "Workshop",
    type: "Laboratory",
    floors: 2,
    rooms: 28,
    x: 62,
    y: 76,
    icon: FlaskConical,
  },
];

function StudentMap() {
  const [selectedBuilding, setSelectedBuilding] = useState(null);

  const handleBuildingClick = (building) => {
    setSelectedBuilding(building);
  };

  return (
    <div className="student-map-page">

      {/* Header */}
      <div className="student-page-header">
        <div>
          <h1>Campus Map</h1>
          <p>Explore buildings and navigate around campus.</p>
        </div>

        <button className="student-map-location-btn">
          <Navigation size={17} />
          My Location
        </button>
      </div>

      {/* Temporary Map Notice */}
      <div className="map-info-banner">
        <Info size={18} />

        <div>
          <strong>Temporary Campus Map</strong>
          <p>
            This is a temporary interactive campus layout.
            The official college map can be connected here later.
          </p>
        </div>
      </div>

      <div className="student-map-layout">

        {/* Map */}
        <div className="student-map-card">

          <div className="map-card-header">
            <div>
              <h2>
                <Map size={19} />
                Campus Overview
              </h2>
              <span>Click a building to view details</span>
            </div>
          </div>

          <div className="campus-map">

            {/* Roads */}
            <div className="map-road horizontal-road road-one" />
            <div className="map-road horizontal-road road-two" />
            <div className="map-road vertical-road road-three" />
            <div className="map-road vertical-road road-four" />

            {/* Central Open Area */}
            <div className="campus-ground">
              <span>Campus Ground</span>
            </div>

            {/* Building markers */}
            {buildings.map((building) => {
              const Icon = building.icon;
              const isSelected = selectedBuilding?.id === building.id;

              return (
                <button
                  key={building.id}
                  className={`map-building-marker ${
                    isSelected ? "selected" : ""
                  }`}
                  style={{
                    left: `${building.x}%`,
                    top: `${building.y}%`,
                  }}
                  onClick={() => handleBuildingClick(building)}
                >
                  <div className="map-building-icon">
                    <Icon size={19} />
                  </div>

                  <span>{building.id}</span>
                </button>
              );
            })}

            {/* Legend */}
            <div className="map-legend">
              <div>
                <span className="legend-dot academic" />
                Academic
              </div>

              <div>
                <span className="legend-dot library" />
                Library
              </div>

              <div>
                <span className="legend-dot admin" />
                Administration
              </div>

              <div>
                <span className="legend-dot lab" />
                Laboratory
              </div>
            </div>

          </div>
        </div>

        {/* Details */}
        <div className="student-map-details">

          {!selectedBuilding ? (
            <div className="map-empty-state">
              <MapPin size={34} />

              <h3>Select a Building</h3>

              <p>
                Click any building marker on the map to view
                information about that building.
              </p>
            </div>
          ) : (
            <div className="map-building-details">

              <div className="selected-building-icon">
                <Building2 size={25} />
              </div>

              <h2>{selectedBuilding.name}</h2>

              <span className="selected-building-type">
                {selectedBuilding.type}
              </span>

              <div className="selected-building-stats">

                <div>
                  <strong>{selectedBuilding.floors}</strong>
                  <span>Floors</span>
                </div>

                <div>
                  <strong>{selectedBuilding.rooms}</strong>
                  <span>Rooms</span>
                </div>

                <div>
                  <strong>{selectedBuilding.id}</strong>
                  <span>Code</span>
                </div>

              </div>

              <button className="map-view-building-btn">
                <Building2 size={17} />
                View Building
              </button>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default StudentMap;