import { useMemo } from "react";
import { DoorOpen, ExternalLink, MapPin } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import labels from "../../data/wce-building-labels.json";
import footprints from "../../data/wce-campus-footprints.json";
import { allBuildingPlans } from "../../data/buildingDrawings";

const footprintIds = new Set(footprints.footprints.map(({ id }) => id));
const buildings = labels.buildings.filter(({ footprintId }) => footprintIds.has(footprintId));

export default function Rooms() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("building") || "";
  const building = useMemo(() => buildings.find(({ footprintId }) => footprintId === selectedId), [selectedId]);
  const name = building?.labels.join(" / ") || selectedId;

  function selectBuilding(event) {
    const id = event.target.value;
    setParams(id ? { building: id } : {});
  }

  return <div className="rooms-page">
    <header className="page-header"><div><h1>Floors &amp; Rooms</h1><p>Room records are shown only when verified source data exists.</p></div></header>
    <section className="rooms-building-picker">
      <label htmlFor="rooms-building">Selected building</label>
      <select id="rooms-building" value={selectedId} onChange={selectBuilding}>
        <option value="">Choose a CAD-labelled building</option>
        {buildings.map(({ footprintId, labels: buildingLabels }) => <option value={footprintId} key={footprintId}>{buildingLabels.join(" / ")} · {footprintId}</option>)}
      </select>
      {selectedId && building && <p><MapPin size={14}/> {name} <span>Footprint {selectedId}</span></p>}
    </section>
    {!selectedId ? <section className="rooms-unavailable"><DoorOpen size={24}/><h2>Select a building</h2><p>Choose a building to check for source-backed room records.</p></section>
      : !building ? <section className="rooms-unavailable"><DoorOpen size={24}/><h2>Building not found</h2><p>Footprint {selectedId} is not present in the labelled campus directory.</p></section>
        : <section className="rooms-unavailable" aria-live="polite"><DoorOpen size={24}/><p className="rooms-state-label">{name} · {selectedId}</p><h2>Room data not available</h2><p>Available CAD information has not been mapped to verified room records for this building. No room numbers, floor assignments, capacities, or equipment are asserted here.</p>
          {selectedId === "BU-002" && <div className="rooms-source-note">Main Building has source CAD text annotations on two floors. These labels are not verified room records and are not associated with room boundaries.</div>}
          {allBuildingPlans[selectedId] && <Link className="rooms-plan-link" to={`/building-explorer/${encodeURIComponent(selectedId)}`}><ExternalLink size={15}/> View this building’s source plan and annotations</Link>}
        </section>}
  </div>;
}
