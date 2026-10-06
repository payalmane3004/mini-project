import {
  Building2,
  RotateCcw,
  Maximize2,
  X,
  Activity,
  Layers3,
} from "lucide-react";
import { useState } from "react";

import CampusScene from "../components/digital-twin/CampusScene";

function DigitalTwin() {
  const [selectedBuilding, setSelectedBuilding] =
    useState(null);

  return (
    <div className="digital-twin-page">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Digital Twin</h1>
          <p>
            Interactive real-time model of the campus
          </p>
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

            <CampusScene
              selectedId={selectedBuilding?.id}
              onSelectBuilding={setSelectedBuilding}
            />

            <div className="map-status">
              <Activity size={13} />
              CAD campus geometry
            </div>

          </div>
        </div>

        {/* Building Details */}
        <div className="building-panel">

          {!selectedBuilding ? (
            <div className="empty-building-panel">

              <Building2 size={34} />

              <h3>
                Select a building
              </h3>

              <p>
                Click any building footprint on the
                digital twin to inspect its source
                information.
              </p>

            </div>
          ) : (
            <>

              {/* Header */}
              <div className="building-panel-header">

                <div>

                  <div className="building-panel-code">
                    {selectedBuilding.code}
                  </div>

                  <h2>
                    {selectedBuilding.name}
                  </h2>

                  <span className="status-pill normal">
                    <span></span>
                    CAD Geometry
                  </span>

                </div>

                <button
                  className="close-panel"
                  onClick={() =>
                    setSelectedBuilding(null)
                  }
                >
                  <X size={17} />
                </button>

              </div>

              {/* Source Information */}
              <div className="panel-section">

                <div className="panel-section-title">
                  Source Information
                </div>

                <div className="info-row">
                  <span>CAD Footprint</span>
                  <strong>
                    {selectedBuilding.id}
                  </strong>
                </div>

                <div className="info-row">
                  <span>Source</span>
                  <strong>
                    college land.dxf
                  </strong>
                </div>

                <div className="info-row">
                  <span>Source Label</span>
                  <strong>
                    {selectedBuilding.sourceLabels?.length
                      ? selectedBuilding.sourceLabels.join(
                          " / "
                        )
                      : "Not labelled in CAD"}
                  </strong>
                </div>

              </div>

              {/* Live data */}
              <div className="panel-section">

                <div className="panel-section-title">
                  Live Campus Data
                </div>

                <div className="info-row">
                  <span>Occupancy</span>
                  <strong>
                    Not connected
                  </strong>
                </div>

                <div className="info-row">
                  <span>Energy</span>
                  <strong>
                    Not connected
                  </strong>
                </div>

                <div className="info-row">
                  <span>Temperature</span>
                  <strong>
                    Not connected
                  </strong>
                </div>

                <div className="info-row">
                  <span>Rooms</span>
                  <strong>
                    Not connected
                  </strong>
                </div>

              </div>

              {/* Model status */}
              <div className="panel-section">

                <div className="panel-section-title">
                  Model Status
                </div>

                <div className="info-row">
                  <span>Geometry</span>

                  <strong className="online-text">
                    Exact CAD footprint
                  </strong>
                </div>

                <div className="info-row">
                  <span>3D Height</span>

                  <strong>
                    Not provided
                  </strong>
                </div>

              </div>

            </>
          )}

        </div>
      </div>
    </div>
  );
}

export default DigitalTwin;