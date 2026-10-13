import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Building2, Search, Map, DoorOpen } from "lucide-react";
import labels from "../../data/wce-building-labels.json";
import footprints from "../../data/wce-campus-footprints.json";
import { allBuildingPlans, originalBuildingDrawings } from "../../data/buildingDrawings";
import CampusFacilitySearch from "../../components/digital-twin/CampusFacilitySearch";

const footprintIds = new Set(footprints.footprints.map(({ id }) => id));
const directory = labels.buildings.filter(({ footprintId }) => footprintIds.has(footprintId))
  .map(({ footprintId, labels: sourceLabels }) => ({ id: footprintId, name: sourceLabels.join(" / ") }));

export default function Buildings() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const navigate = useNavigate();
  const filtered = useMemo(() => directory.filter(({ id, name }) => `${id} ${name}`.toLowerCase().includes(query.toLowerCase())), [query]);
  return <div className="buildings-page directory-page">
    <header className="page-header"><div><h1>Building Directory</h1><p>Names from source CAD text, matched to campus footprints.</p></div><span className="source-chip"><Map size={14}/> CAD directory · {directory.length} labelled footprints</span></header>
    <div className="directory-source-note">Footprint labels are source annotations, not verified building records. Unlabelled CAD footprints are omitted from this named directory.</div>
    <CampusFacilitySearch />
    <label className="building-search"><Search size={17}/><input aria-label="Search buildings" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search names or footprint IDs"/></label>
    {filtered.length ? <div className="directory-list">{filtered.map((building) => {
      const originalDrawing = originalBuildingDrawings[building.id];
      return <article className="directory-row" key={building.id}><span className="directory-icon"><Building2 size={19}/></span><div className="directory-name"><h2>{building.name}</h2><p>CAD footprint {building.id} · source: {footprints.source}</p></div><span className="directory-evidence">Source label</span>{allBuildingPlans[building.id] ? <button className="directory-action" onClick={() => navigate(`/building-explorer/${building.id}`)}><DoorOpen size={15}/> Explore source plan</button> : originalDrawing ? <button className="directory-action" onClick={() => navigate(`/building-explorer/${building.id}`)}><DoorOpen size={15}/> Exterior &amp; source DWG</button> : <span className="directory-unavailable">No matched drawing</span>}</article>;
    })}</div> : <div className="directory-empty"><Building2 size={26}/><h2>No matching labels</h2><p>Try another building name or footprint ID.</p></div>}
  </div>;
}
