import { Building2, X, Box } from "lucide-react";
import { allBuildingPlans, originalBuildingDrawings, buildingDrawings } from "../../data/buildingDrawings";
import FloorPlanViewer from "./FloorPlanViewer";
import "./BuildingFloorPlan.css";

function BuildingDetailsPanel({ building, onClose, onExploreBuilding }) {
  const drawing = building ? allBuildingPlans[building.id] : null;
  const isMainBuildingDrawing = building ? Boolean(buildingDrawings[building.id]) : false;
  const originalDrawing = building ? originalBuildingDrawings[building.id] : null;
  return (
    <div className="building-panel">
      {!building ? (
        <div className="empty-building-panel">
          <Building2 size={34} />
          <h3>Select a building</h3>
          <p>
            Click any building footprint on the
            digital twin to inspect its source
            information.
          </p>
        </div>
      ) : (
        <>
          <div className="building-panel-header">
            <div>
              <div className="building-panel-code">{building.code}</div>
              <h2>{building.heading}</h2>
              <span className="status-pill normal">
                <span></span>
                CAD Geometry
              </span>
            </div>

            <button className="close-panel" onClick={onClose}>
              <X size={17} />
            </button>
          </div>

          {originalDrawing && (
            <section className="building-drawing-source-card">
              <div className="panel-section-title">Building-Specific Source Drawing</div>
              <p>{originalDrawing.evidence}</p>
              <a className="building-drawing-source" href={originalDrawing.sourceUrl} download>
                Download original DWG: {originalDrawing.originalFilename}
              </a>
              {!drawing && <p className="building-drawing-note">This original DWG has no processed plan for in-app viewing. Explore Building opens the campus footprint exterior only.</p>}
            </section>
          )}

          <div className="panel-section">
            <div className="panel-section-title">Source Information</div>

            <div className="info-row">
              <span>CAD Footprint</span>
              <strong>{building.id}</strong>
            </div>

            <div className="info-row">
              <span>Source</span>
              <strong>{building.sourceFilename}</strong>
            </div>

            <div className="info-row">
              <span>Source Label</span>
              <strong>
                {building.sourceLabels?.length
                  ? building.sourceLabels.join(" / ")
                  : "Not labelled in CAD"}
              </strong>
            </div>
          </div>

          {drawing && (
            <section className="building-drawing-section">
              <div className="panel-section-title">Source Floor Plan</div>
              <FloorPlanViewer
                src={drawing.previewUrl}
                title={`${drawing.buildingName} floor plan`}
                filename={drawing.originalFilename}
              />
              {isMainBuildingDrawing && <div className="building-drawing-floors">CAD labels: {drawing.floorLabels.join(" / ")}</div>}
              <p className="building-drawing-evidence">{drawing.associationEvidence}</p>
              <p className="building-drawing-note">{drawing.renderingNotes}</p>
              <a className="building-drawing-source" href={drawing.sourceUrl} download>
                Download original: {drawing.originalFilename}
              </a>
            </section>
          )}

          {onExploreBuilding && <button className="view-building-button" onClick={onExploreBuilding}>
            <Box size={15} />
            Explore Building
          </button>}

          {!drawing && !originalDrawing && <p className="building-drawing-note building-plan-unavailable">No confidently associated detailed building plan is available. The explorer will show the campus footprint exterior only.</p>}

          <div className="panel-section">
            <div className="panel-section-title">Live Campus Data</div>

            <div className="info-row">
              <span>Occupancy</span>
              <strong>Not connected</strong>
            </div>

            <div className="info-row">
              <span>Energy</span>
              <strong>Not connected</strong>
            </div>

            <div className="info-row">
              <span>Temperature</span>
              <strong>Not connected</strong>
            </div>

            <div className="info-row">
              <span>Rooms</span>
              <strong>Not connected</strong>
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-section-title">Model Status</div>

            <div className="info-row">
              <span>Geometry</span>
              <strong className="online-text">
                Exact CAD footprint &#183; illustrative height
              </strong>
            </div>

            <div className="info-row">
              <span>3D Height</span>
              <strong>
                Temporary visualization only; not surveyed
              </strong>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default BuildingDetailsPanel;
