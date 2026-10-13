import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, Search } from "lucide-react";
import facilityDirectory from "../../data/main-building-facilities.json";
import { processedBuildingPlans } from "../../data/buildingDrawings";
import { normalizeCadAnnotation } from "../../data/cadAnnotationCatalog";
import "./CampusFacilitySearch.css";

const mainFacilities = facilityDirectory.annotations.map((annotation) => ({
  key: annotation.id,
  buildingId: "BU-002",
  buildingName: "Main Building",
  text: annotation.originalCadText,
  floor: annotation.floor,
  x: annotation.dxfX,
  y: annotation.dxfY,
  sourceEntity: annotation.sourceEntityType ?? "CAD text",
  sourceLayer: annotation.layerName ?? "unavailable",
  source: annotation.sourceDrawing,
  verification: `${annotation.verificationStatus}; room association ${annotation.roomAssociationStatus}`,
  route: `/main-building-interior?facility=${encodeURIComponent(annotation.id)}`,
}));

export default function CampusFacilitySearch() {
  const [query, setQuery] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [floorFilter, setFloorFilter] = useState("all");
  const [drawingFacilities, setDrawingFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failedReports, setFailedReports] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(processedBuildingPlans);
    Promise.all(entries.map(async ([buildingId, drawing]) => {
      try {
        const response = await fetch(drawing.inspectionUrl);
        if (!response.ok) throw new Error(`Could not load ${drawing.inspectionUrl}`);
        const report = await response.json();
        return (report.sourceText ?? []).map((annotation, sourceIndex) => normalizeCadAnnotation({ buildingId, drawing, annotation, sourceIndex })).filter((item) => item.text);
      } catch {
        return null;
      }
    })).then((groups) => {
      if (cancelled) return;
      const available = groups.filter(Boolean);
      setDrawingFacilities(available.flat());
      setFailedReports(groups.length - available.length);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const facilities = useMemo(() => [...mainFacilities, ...drawingFacilities], [drawingFacilities]);
  const matching = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return facilities.filter((item) => {
      const matchesQuery = !term || `${item.text} ${item.buildingName} ${item.buildingId}`.toLocaleLowerCase().includes(term);
      const matchesBuilding = buildingFilter === "all" || item.buildingId === buildingFilter;
      const matchesFloor = floorFilter === "all" || item.floor === floorFilter;
      return matchesQuery && matchesBuilding && matchesFloor;
    }).slice(0, 60);
  }, [facilities, query, buildingFilter, floorFilter]);

  const buildingOptions = useMemo(() => [...new Map(facilities.map((item) => [item.buildingId, item.buildingName])).entries()], [facilities]);
  const floorOptions = useMemo(() => [...new Set(facilities.map((item) => item.floor).filter(Boolean))], [facilities]);

  return <section className="campus-facility-search" aria-labelledby="campus-facility-search-title">
    <div className="campus-facility-search-header">
      <div><h2 id="campus-facility-search-title">Campus facility search</h2><p>Search source labels across the Main Building and converted building drawings.</p></div>
      <span>{loading ? "Loading source labels…" : `${matching.length} results shown`}</span>
    </div>
    <div className="campus-facility-search-controls">
      <label className="campus-facility-query"><Search size={16}/><span className="sr-only">Search facility labels</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search facility text, building name, or ID" /></label>
      <label><span>Building</span><select value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}><option value="all">All available buildings</option>{buildingOptions.map(([id,name]) => <option value={id} key={id}>{name} · {id}</option>)}</select></label>
      <label><span>Available floor metadata</span><select value={floorFilter} onChange={(event) => setFloorFilter(event.target.value)}><option value="all">All floors / unassigned labels</option>{floorOptions.map((floor) => <option value={floor} key={floor}>{floor}</option>)}</select></label>
    </div>
    {failedReports > 0 && <p className="campus-facility-search-warning" role="status">Some converted drawing reports could not be loaded; available results remain searchable.</p>}
    <div className="campus-facility-search-results" aria-live="polite">
      {matching.map((item) => <button type="button" key={item.key} className="campus-facility-result" onClick={() => navigate(item.route, { state: { returnTo: location.pathname === "/digital-twin" ? `/digital-twin?building=${encodeURIComponent(item.buildingId)}` : location.pathname } })}>
        <span><strong>{item.text}</strong><small>{item.buildingName} · {item.buildingId}{item.floor ? ` · ${item.floor}` : " · floor not assigned"}</small><small>{item.verification} · {item.source}{Number.isFinite(item.x) && Number.isFinite(item.y) ? ` · CAD insertion X ${item.x.toFixed(2)}, Y ${item.y.toFixed(2)}` : ""}</small></span><ArrowUpRight size={16}/>
      </button>)}
      {!loading && matching.length === 0 && <p className="campus-facility-search-empty">No source annotations match these filters.</p>}
      {loading && <p className="campus-facility-search-empty">Loading inspection reports for converted building drawings…</p>}
    </div>
    <p className="campus-facility-search-footnote">Search results are CAD text annotations, not verified room records, capacities, or service locations. Non-Main floor filters use only drawing regions separated by explicit titles and geometry; they do not assert room membership. Indoor route guidance is unavailable because no verified walkable path graph exists; selecting a result opens its source annotation.</p>
  </section>;
}
