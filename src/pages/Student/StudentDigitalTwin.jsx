import { useMemo, useRef, useState } from "react";
import { Activity, Layers3, Maximize2, RotateCcw } from "lucide-react";

import CampusScene from "../../components/digital-twin/CampusScene";
import BuildingDetailsPanel from "../../components/digital-twin/BuildingDetailsPanel";
import footprintData from "../../data/wce-campus-footprints.json";
import labelData from "../../data/wce-building-labels.json";

function StudentDigitalTwin() {
  const [selectedId, setSelectedId] = useState(null);
  const mapRef = useRef(null);
  const buildings = useMemo(() => {
    const labels = new Map(labelData.buildings.map((entry) => [entry.footprintId, entry.labels]));
    return footprintData.footprints.map((footprint) => {
      const sourceLabels = labels.get(footprint.id) ?? [];
      return {
        id: footprint.id,
        code: footprint.id,
        name: sourceLabels.join(" / ") || footprint.id,
        heading: sourceLabels.join(" / ") || footprint.id,
        sourceLabels,
        sourceFilename: "college land.dxf",
      };
    });
  }, []);
  const selectedBuilding = buildings.find((building) => building.id === selectedId) ?? null;

  return (
    <div className="student-digital-twin-page">
      <div className="student-page-header">
        <div>
          <p className="page-label">CAMPUS EXPLORER</p>
          <h1>Digital Twin</h1>
          <p>Explore the campus using its existing CAD footprint data.</p>
        </div>
        <div className="student-twin-actions">
          <button type="button" onClick={() => setSelectedId(null)}>
            <RotateCcw size={15} /> Reset View
          </button>
          <button type="button" onClick={() => mapRef.current?.requestFullscreen?.()}>
            <Maximize2 size={15} /> Fullscreen
          </button>
        </div>
      </div>

      <div className="twin-layout">
        <section className="twin-view-card" ref={mapRef} aria-label="Interactive campus digital twin">
          <div className="twin-toolbar">
            <div className="twin-title">
              <Layers3 size={17} />
              <span>Campus Digital Twin</span>
            </div>
            <div className="live-indicator" aria-label="CAD source data">
              <span className="demo-dot" /> CAD SOURCE
            </div>
          </div>

          <div className="twin-map student-twin-map">
            <CampusScene
              selectedId={selectedId}
              onSelectBuilding={(building) => setSelectedId(building?.id ?? null)}
            />
            <div className="map-status">
              <Activity size={13} /> CAD campus geometry
            </div>
          </div>
        </section>

        <BuildingDetailsPanel
          building={selectedBuilding}
          onClose={() => setSelectedId(null)}
        />
      </div>
    </div>
  );
}

export default StudentDigitalTwin;
