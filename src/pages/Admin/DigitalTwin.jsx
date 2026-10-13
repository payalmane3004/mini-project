import {
  RotateCcw,
  Maximize2,
  Activity,
  Layers3,
  Search,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import CampusScene from "../../components/digital-twin/CampusScene";
import BuildingDetailsPanel from "../../components/digital-twin/BuildingDetailsPanel";
import CampusFacilitySearch from "../../components/digital-twin/CampusFacilitySearch";
import footprintData from "../../data/wce-campus-footprints.json";
import labelData from "../../data/wce-building-labels.json";
import "./DigitalTwin.css";

function DigitalTwin() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const buildings = useMemo(() => {
    const labels = new Map(labelData.buildings.map((entry) => [entry.footprintId, entry.labels]));
    return footprintData.footprints.map((footprint) => ({
      id: footprint.id,
      labels: labels.get(footprint.id) ?? [],
      name: labels.get(footprint.id)?.join(" / ") || footprint.id,
    }));
  }, []);
  const selectedBuilding = useMemo(() => {
    const building = buildings.find((item) => item.id === searchParams.get("building"));
    return building ? { ...building, code: building.id, sourceLabels: building.labels, sourceFilename: "college land.dxf" } : null;
  }, [buildings, searchParams]);
  const [sceneKey, setSceneKey] = useState(0);
  const [buildingQuery, setBuildingQuery] = useState(() => selectedBuilding?.name ?? "");
  const mapRef = useRef(null);
  const buildingMatches = useMemo(() => {
    const term = buildingQuery.trim().toLocaleLowerCase();
    return term ? buildings.filter((building) => `${building.id} ${building.name}`.toLocaleLowerCase().includes(term)).slice(0, 8) : [];
  }, [buildings, buildingQuery]);
  const updateSelection = (building) => {
    setBuildingQuery(building?.name ?? "");
    const next = new URLSearchParams(searchParams);
    if (building?.id) next.set("building", building.id);
    else next.delete("building");
    setSearchParams(next, { replace: true });
  };
  const selectBuilding = (building) => {
    updateSelection({ ...building, code: building.id, sourceLabels: building.labels, sourceFilename: "college land.dxf" });
  };

  return (
    <div className="digital-twin-page">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Digital Twin</h1>
          <p>
            Select a footprint to inspect CAD source labels and linked floor plans.
          </p>
        </div>

        <div className="page-actions">
          <button onClick={() => { updateSelection(null); setSceneKey((key) => key + 1); }}>
            <RotateCcw size={15} />
            Reset View
          </button>

          <button onClick={() => mapRef.current?.requestFullscreen?.()}>
            <Maximize2 size={15} />
            Fullscreen
          </button>
        </div>
      </div>

      {/* Main Twin Area */}
      <div className="twin-layout">

        {/* Campus View */}
        <div className="twin-view-card" ref={mapRef}>

          <div className="twin-toolbar">
            <div className="twin-title">
              <Layers3 size={17} />
              <span>Campus Digital Twin</span>
            </div>

            <div className="live-indicator">
              <span className="demo-dot"></span>
              CAD SOURCE
            </div>
          </div>

          <div className="campus-building-finder">
            <label htmlFor="campus-building-query"><Search size={15} /><span className="sr-only">Find a campus building</span></label>
            <input id="campus-building-query" value={buildingQuery} onChange={(event) => setBuildingQuery(event.target.value)} placeholder="Find a building by name, CAD label, or ID" autoComplete="off" />
            {buildingQuery && <button type="button" onClick={() => updateSelection(null)} aria-label="Clear building search">Clear</button>}
            {buildingMatches.length > 0 && selectedBuilding?.name !== buildingQuery && <div className="campus-building-matches" role="listbox" aria-label="Matching campus buildings">
              {buildingMatches.map((building) => <button type="button" role="option" aria-selected={selectedBuilding?.id === building.id} key={building.id} onClick={() => selectBuilding(building)}>
                <strong>{building.name}</strong><small>{building.id} · source CAD footprint</small>
              </button>)}
            </div>}
          </div>

          <div className="twin-map">

            <CampusScene
              key={sceneKey}
              selectedId={selectedBuilding?.id}
              onSelectBuilding={(building) => updateSelection(building ? { ...building, sourceFilename: "college land.dxf" } : null)}
            />

            <div className="map-status">
              <Activity size={13} />
              CAD campus geometry
            </div>

          </div>
        </div>

        <BuildingDetailsPanel
          building={selectedBuilding ? {
            ...selectedBuilding,
            heading: selectedBuilding.name,
            sourceFilename: "college land.dxf",
          } : null}
          onClose={() => updateSelection(null)}
          onExploreBuilding={() => navigate(`/building-explorer/${encodeURIComponent(selectedBuilding.id)}`, { state: { returnTo: `/digital-twin?building=${encodeURIComponent(selectedBuilding.id)}` } })}
        />
      </div>
      <CampusFacilitySearch />
    </div>
  );
}

export default DigitalTwin;

