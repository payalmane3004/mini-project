import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Building2, DoorOpen, LayoutGrid, List, Map as MapIcon, Search, X } from "lucide-react";
import labels from "../../data/wce-building-labels.json";
import footprints from "../../data/wce-campus-footprints.json";
import { allBuildingPlans, originalBuildingDrawings } from "../../data/buildingDrawings";
import CampusFacilitySearch from "../../components/digital-twin/CampusFacilitySearch";
import { fetchBuildingRooms, fetchBuildings } from "../../api/buildings";
import {
  buildDirectoryEntries,
  filterDirectoryEntries,
  getDirectoryMatchLabel,
  hasSourcePlan,
  summarizeVerifiedRooms,
} from "./buildingDirectoryData";
import "./Buildings.css";

const CampusScene = lazy(() => import("../../components/digital-twin/CampusScene"));
const footprintIds = new Set(footprints.footprints.map(({ id }) => id));
const directory = labels.buildings.filter(({ footprintId }) => footprintIds.has(footprintId))
  .map(({ footprintId, labels: sourceLabels }) => ({ id: footprintId, name: sourceLabels.join(" / ") }));
const directoryFilters = [
  ["all", "All entries"],
  ["cad-matched", "CAD matched"],
  ["cad-unmatched", "CAD unmatched"],
  ["database", "Database records"],
];

export default function Buildings() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("grid");
  const [mapOpen, setMapOpen] = useState(false);
  const [mapSelectionId, setMapSelectionId] = useState("");
  const [databaseBuildings, setDatabaseBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [roomState, setRoomState] = useState({ buildingId: null, rooms: [], loading: false, error: "" });
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    fetchBuildings()
      .then((buildings) => {
        if (active) {
          setDatabaseBuildings(buildings);
          setApiError("");
        }
      })
      .catch((error) => { if (active) setApiError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const entries = useMemo(() => buildDirectoryEntries(directory, databaseBuildings), [databaseBuildings]);
  const filtered = useMemo(() => filterDirectoryEntries(entries, query, filter), [entries, query, filter]);
  const selected = entries.find(({ source, id }) => `${source}-${id}` === selectedKey) || null;
  const selectedRecord = selected?.match.building || null;

  useEffect(() => {
    if (!selectedRecord) {
      return undefined;
    }
    let active = true;
    fetchBuildingRooms(selectedRecord.building_code)
      .then((rooms) => { if (active) setRoomState({ buildingId: selectedRecord.id, rooms, loading: false, error: "" }); })
      .catch((error) => { if (active) setRoomState({ buildingId: selectedRecord.id, rooms: [], loading: false, error: error.message }); });
    return () => { active = false; };
  }, [selectedRecord]);

  const cadMatched = entries.filter(({ source, match }) => source === "cad" && match.status === "matched").length;
  const selectedRoomState = selectedRecord
    ? selectedRecord.id === roomState.buildingId
      ? roomState
      : { buildingId: selectedRecord.id, rooms: [], loading: true, error: "" }
    : null;
  const roomSummary = selectedRoomState && !selectedRoomState.loading && !selectedRoomState.error
    ? summarizeVerifiedRooms(selectedRoomState.rooms)
    : null;

  function openSourcePlan(buildingId) {
    navigate(`/building-explorer/${encodeURIComponent(buildingId)}`, { state: { returnTo: "/buildings" } });
  }

  function selectDirectoryEntry(entry) {
    const key = `${entry.source}-${entry.id}`;
    setSelectedKey((current) => current === key ? "" : key);
    setMapSelectionId(entry.source === "cad" ? entry.id : "");
  }

  return <div className="buildings-page directory-page">
    <header className="page-header">
      <div><h1>Building Directory</h1><p>Explore database building records alongside source annotations from campus drawings.</p></div>
      <div className="directory-header-actions"><Link to="/digital-twin"><MapIcon size={15}/> Open Digital Twin</Link><span className="source-chip"><MapIcon size={14}/> CAD source drawings · {directory.length} labelled footprints</span></div>
    </header>

    <section className="directory-summary" aria-label="Building directory sources">
      <div><span>Database buildings</span><strong>{loading || apiError ? "—" : databaseBuildings.length}</strong><small>{apiError ? "Unavailable · API request failed" : "Records returned by the buildings API"}</small></div>
      <div><span>CAD footprints</span><strong>{directory.length}</strong><small>Labelled footprints in the source directory</small></div>
      <div><span>Unique code matches</span><strong>{loading || apiError ? "—" : cadMatched}</strong><small>CAD footprint IDs matched to database codes</small></div>
    </section>

    {apiError && <div className="directory-source-note" role="alert">{apiError} Database records are unavailable; CAD source annotations remain separate below.</div>}
    <CampusFacilitySearch />

    <section className="building-directory-section" aria-labelledby="building-directory-title">
      <div className="building-directory-heading">
        <div><h2 id="building-directory-title">Building records and footprints</h2><p>Search names or codes, then filter by record source and match status.</p></div>
        <div className="directory-heading-actions">
          <button type="button" className="directory-map-toggle" aria-expanded={mapOpen} aria-controls="building-directory-map" onClick={() => setMapOpen((open) => !open)}><MapIcon size={15}/>{mapOpen ? "Hide source map" : "Show source map"}</button>
          <div className="directory-view-toggle" role="group" aria-label="Directory layout">
            <button type="button" aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid size={16}/></button>
            <button type="button" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={16}/></button>
          </div>
        </div>
      </div>
      <label className="building-search"><Search size={17}/><input type="search" aria-label="Search building names or codes" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search building names or codes"/></label>
      <div className="directory-filter-list" role="group" aria-label="Filter building directory">
        {directoryFilters.map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        {(query || filter !== "all") && <button type="button" className="directory-clear-filter" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button>}
      </div>
      {loading && <p className="directory-loading" role="status">Loading database building records. CAD annotations are available separately.</p>}

      {mapOpen && <section className="directory-map-preview" id="building-directory-map" aria-label="Campus CAD footprint preview">
        <div className="directory-map-canvas"><Suspense fallback={<p role="status">Loading CAD footprint viewer…</p>}><CampusScene selectedId={mapSelectionId || undefined} onSelectBuilding={(building) => {
          setMapSelectionId(building?.id || "");
          const match = building && entries.find((entry) => entry.source === "cad" && entry.id === building.id);
          setSelectedKey(match ? `cad-${match.id}` : "");
        }}/></Suspense></div>
        <p>{mapSelectionId ? `Selected CAD footprint ${mapSelectionId}.` : "Click a footprint to highlight its source geometry."} Geometry and labels come from CAD source files; selection does not verify a database building or room.</p>
      </section>}

      {filtered.length > 0 ? <div className={`directory-cards ${view === "list" ? "list-view" : "grid-view"}`}>
        {filtered.map((entry) => {
          const record = entry.match.building;
          const title = record?.name || entry.name;
          const canExplore = hasSourcePlan(entry.id, allBuildingPlans, originalBuildingDrawings);
          return <article className={`directory-card source-${entry.source}${record ? " has-record" : ""}`} key={`${entry.source}-${entry.id}`}>
            <div className="directory-card-heading"><span className={`directory-icon ${entry.source}`}><Building2 size={18}/></span><span className="directory-code">{entry.source === "database-only" ? "DATABASE CODE" : "CAD FOOTPRINT"} · {entry.id}</span></div>
            <h3 title={title}>{title}</h3>
            {entry.is_demo && <p className="directory-demo-tag">DEMO DATA · fictional building, not verified inventory</p>}
            {entry.source === "cad" && record && record.name !== entry.name && <p className="directory-card-meta">Source label: {entry.name}</p>}
            {entry.source === "database-only" && <p className="directory-card-meta">No matching footprint ID was found in the loaded campus source directory.</p>}
            {entry.source === "cad" && !record && <p className="directory-card-meta">This source annotation is not a verified database building record.</p>}
            {record && record.description && <p className="directory-card-description" title={record.description}>{record.description}</p>}
            <span className={`directory-evidence ${record ? "database-match" : "cad-only"}`}>{getDirectoryMatchLabel(entry)}</span>
            <div className="directory-card-actions">
              <button type="button" className="directory-action primary" aria-expanded={selectedKey === `${entry.source}-${entry.id}`} aria-controls={selectedKey === `${entry.source}-${entry.id}` ? "directory-details-panel" : undefined} onClick={() => selectDirectoryEntry(entry)}>
                {selectedKey === `${entry.source}-${entry.id}` ? "Hide details" : "View details"}
              </button>
              {canExplore && <button type="button" className="directory-action" onClick={() => openSourcePlan(entry.id)}><DoorOpen size={15}/> Explore source plan</button>}
              {!canExplore && <span className="directory-unavailable">Source plan unavailable</span>}
            </div>
          </article>;
        })}
      </div> : <div className="directory-empty"><Building2 size={25}/><h3>No entries match these filters</h3><p>Change the search text or clear filters to view available CAD labels and database records.</p></div>}
    </section>

    {selected && <aside className="directory-details" id="directory-details-panel" aria-labelledby="directory-details-title">
      <div className="directory-details-heading"><div><span>{selectedRecord ? "DATABASE BUILDING RECORD" : "CAD SOURCE ANNOTATION"}</span><h2 id="directory-details-title">{selectedRecord?.name || selected.name}</h2>{selected.is_demo && <p className="directory-demo-tag">DEMO DATA · fictional building, not verified inventory</p>}</div><button type="button" aria-label="Close building details" onClick={() => setSelectedKey("")}><X size={18}/></button></div>
      {selectedRecord ? <>
        <dl className="directory-details-fields"><div><dt>Building code</dt><dd>{selectedRecord.building_code}</dd></div><div><dt>Description</dt><dd>{selectedRecord.description || "No description is stored."}</dd></div><div><dt>CAD association</dt><dd>{selected.source === "cad" ? getDirectoryMatchLabel(selected) : "No matching CAD footprint was found."}</dd></div></dl>
        <section className="directory-verified-rooms" aria-label="Verified room summary">
          <h3>Verified room records</h3>
          {selectedRoomState?.loading && <p role="status">Loading associated rooms…</p>}
          {selectedRoomState?.error && <p role="alert">{selectedRoomState.error}</p>}
          {roomSummary && <p>{roomSummary.roomCount} non-demo room record{roomSummary.roomCount === 1 ? "" : "s"}{roomSummary.floorNumbers.length ? ` across ${roomSummary.floorNumbers.length} floor${roomSummary.floorNumbers.length === 1 ? "" : "s"}` : "; no floor values are available"}.{roomSummary.demoRoomCount > 0 && ` ${roomSummary.demoRoomCount} demo room${roomSummary.demoRoomCount === 1 ? "" : "s"} excluded from operational inventory.`}</p>}
          {!selectedRoomState && <p>Room records are not available until a database building is selected.</p>}
        </section>
        <div className="directory-detail-actions"><button type="button" className="directory-action primary" onClick={() => navigate(`/rooms?building=${encodeURIComponent(selectedRecord.building_code)}`)}>Open Floors &amp; Rooms</button>{hasSourcePlan(selected.id, allBuildingPlans, originalBuildingDrawings) && <button type="button" className="directory-action" onClick={() => openSourcePlan(selected.id)}>Explore source plan</button>}</div>
      </> : <p className="directory-cad-detail">CAD footprint {selected.id} is a source annotation only. No verified database building record matched this identifier, so room and capacity details are unavailable.</p>}
    </aside>}
  </div>;
}
