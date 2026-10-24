import { useEffect, useMemo, useState } from "react";
import { Building2, RefreshCw, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchBuildings, fetchRooms } from "../../api/buildings";

function StudentBuildings() {
  const [buildings, setBuildings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([fetchBuildings(), fetchRooms()]).then(([buildingRows, roomRows]) => {
      if (!active) return;
      setBuildings(buildingRows); setRooms(roomRows); setStatus("ready"); setError("");
    }).catch((reason) => { if (active) { setStatus("error"); setError(reason.message); } });
    return () => { active = false; };
  }, [retryKey]);

  const roomCounts = useMemo(() => rooms.reduce((counts, room) => {
    counts.set(room.building_id, (counts.get(room.building_id) || 0) + 1);
    return counts;
  }, new Map()), [rooms]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return buildings.filter((building) => !query || `${building.name} ${building.building_code} ${building.description || ""}`.toLowerCase().includes(query));
  }, [buildings, search]);

  return <div className="student-buildings-page">
    <div className="student-page-header"><div><h1>Campus Buildings</h1><p>Browse building records in the campus directory.</p></div></div>
    <label className="student-building-search"><Search size={17} /><span className="sr-only">Search buildings</span><input placeholder="Search buildings" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    {status === "loading" && <p role="status">Loading campus directory…</p>}
    {status === "error" && <div className="student-dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={() => setRetryKey((key) => key + 1)}><RefreshCw size={15} /> Retry</button></div>}
    {status === "ready" && buildings.length === 0 && <div className="student-building-empty"><Building2 size={36} /><h2>No building records</h2><p>The campus directory has no building records.</p></div>}
    {status === "ready" && buildings.length > 0 && filtered.length === 0 && <div className="student-building-empty"><h2>No matching buildings</h2><p>Try changing your search.</p></div>}
    {status === "ready" && filtered.length > 0 && <div className="student-building-grid">{filtered.map((building) => <article className="student-building-card" key={building.building_code}>
      <div className="student-building-card-top"><div className="student-building-icon"><Building2 size={22} /></div><span className="student-building-code">{building.building_code}</span></div>
      <h2>{building.name}</h2>
      {building.description && <p className="student-building-description">{building.description}</p>}
      <div className="student-building-stats"><span><strong>{roomCounts.get(building.id) || 0}</strong> verified room records</span></div>
      <Link className="student-explore-button" to={`/student-rooms?building=${encodeURIComponent(building.building_code)}`}>Explore database rooms</Link>
    </article>)}</div>}
    <p className="student-dashboard-data-note">Room totals include only database room records. CAD annotations and floor labels are separate map references and are not counted as verified rooms.</p>
  </div>;
}

export default StudentBuildings;
