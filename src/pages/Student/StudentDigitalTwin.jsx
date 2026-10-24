import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Layers3, Maximize2, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";

import CampusScene from "../../components/digital-twin/CampusScene";
import BuildingDetailsPanel from "../../components/digital-twin/BuildingDetailsPanel";
import footprintData from "../../data/wce-campus-footprints.json";
import labelData from "../../data/wce-building-labels.json";
import { fetchBuildings, fetchBuildingRooms } from "../../api/buildings";
import { findUniqueBuildingMatch } from "../../api/buildingMatching";

function StudentDigitalTwin() {
  const [selectedId, setSelectedId] = useState(null);
  const [databaseLookup, setDatabaseLookup] = useState({ key: null, status: "idle", building: null, roomCount: null, error: "" });
  const [databaseRetryKey, setDatabaseRetryKey] = useState(0);
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
  const currentDatabaseLookup = databaseLookup.key === selectedId
    ? databaseLookup
    : { status: selectedId ? "loading" : "idle", building: null, roomCount: null, error: "" };

  useEffect(() => {
    if (!selectedId) return undefined;
    let active = true;
    fetchBuildings().then(async (rows) => {
      const match = findUniqueBuildingMatch(selectedId, rows);
      if (!active) return;
      if (match.status !== "matched") { setDatabaseLookup({ key: selectedId, status: match.status, building: null, roomCount: null, error: "" }); return; }
      const rooms = await fetchBuildingRooms(match.building.building_code);
      if (active) setDatabaseLookup({ key: selectedId, status: "ready", building: match.building, roomCount: rooms.length, error: "" });
    }).catch((reason) => { if (active) setDatabaseLookup({ key: selectedId, status: "error", building: null, roomCount: null, error: reason.message }); });
    return () => { active = false; };
  }, [selectedId, databaseRetryKey]);

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
      {selectedBuilding && <section className="student-panel student-twin-database-link"><div className="student-panel-header"><div><h2>Database room records</h2><p>CAD annotations are matched only by an exact building code.</p></div></div>
        {currentDatabaseLookup.status === "loading" && <p role="status">Checking the campus directory…</p>}
        {currentDatabaseLookup.status === "error" && <div role="alert"><p>{currentDatabaseLookup.error}</p><button type="button" onClick={() => setDatabaseRetryKey((key) => key + 1)}>Retry directory lookup</button></div>}
        {currentDatabaseLookup.status === "ambiguous" && <p>Multiple database building codes match CAD footprint {selectedBuilding.id}; no record was selected. The displayed labels remain CAD annotations.</p>}
        {currentDatabaseLookup.status === "missing" && <p>No database building-code match for CAD footprint {selectedBuilding.id}. The displayed labels remain CAD annotations.</p>}
        {currentDatabaseLookup.status === "ready" && currentDatabaseLookup.building && <><p>{currentDatabaseLookup.building.name} ({currentDatabaseLookup.building.building_code}): {currentDatabaseLookup.roomCount} verified database room records.</p><Link className="student-link-button" to={`/student-rooms?building=${encodeURIComponent(currentDatabaseLookup.building.building_code)}`}>Browse verified rooms</Link></>}
      </section>}
    </div>
  );
}

export default StudentDigitalTwin;
