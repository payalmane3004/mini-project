import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import FloorPlanViewer from "./FloorPlanViewer";
import { findSupportedFloorView } from "../../data/cadAnnotationCatalog";
import "./SourceBuildingPlan.css";
import { validateInspectionReport } from "../../data/inspectionReport";

export default function SourceBuildingPlan({ drawing, buildingId }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    let cancelled = false;
    fetch(drawing.inspectionUrl).then((response) => {
      if (!response.ok) throw new Error("Inspection report unavailable");
      return response.json();
    }).then(validateInspectionReport).then((data) => { if (!cancelled) setReport(data); }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [drawing.inspectionUrl]);

  const labels = useMemo(() => (report?.sourceText ?? []).map((entry, sourceIndex) => ({ ...entry, sourceIndex }))
    .filter((entry) => entry.text && entry.type !== "ATTRIB" && entry.type !== "ATTDEF"), [report]);
  const floorViews = drawing.floorViews ?? [];
  const requestedFloor = searchParams.get("floor");
  const selectedFloor = floorViews.find((floor) => floor.id === requestedFloor) ?? null;
  const visibleLabels = useMemo(() => selectedFloor
    ? labels.filter((entry) => findSupportedFloorView(drawing, entry)?.id === selectedFloor.id)
    : labels, [drawing, labels, selectedFloor]);
  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return visibleLabels.filter((entry) => !term || entry.text.toLocaleLowerCase().includes(term));
  }, [visibleLabels, query]);
  const floorLabels = useMemo(() => visibleLabels.filter((entry) => /\b(floor|storey|story)\b/i.test(entry.text)), [visibleLabels]);
  const rawSelection = searchParams.get("annotation");
  const selectedIndex = rawSelection === null ? null : Number(rawSelection);
  const selected = visibleLabels.find((entry) => entry.sourceIndex === selectedIndex) ?? null;
  const previewUrl = selectedFloor?.previewUrl ?? drawing.previewUrl;
  const annotationBounds = selectedFloor?.bounds ?? report?.renderBounds;
  const setFloor = (floorId) => {
    const next = new URLSearchParams(searchParams);
    if (floorId) next.set("floor", floorId);
    else next.delete("floor");
    next.delete("annotation");
    setSearchParams(next, { replace: true });
  };
  const selectAnnotation = (entry) => {
    const next = new URLSearchParams(searchParams);
    next.set("annotation", String(entry.sourceIndex));
    setSearchParams(next, { replace: true });
  };
  const clearSelection = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("annotation");
    setSearchParams(next, { replace: true });
  };
  const renderedEntityCount = report?.rendererRenderedEntityCounts
    ? Object.values(report.rendererRenderedEntityCounts).reduce((total, count) => total + count, 0)
    : report?.rendererSupportedEntities?.reduce((total, type) => total + (report.entityCounts[type] ?? 0), 0);

  return <div className="source-plan-layout">
    <section className="source-plan-viewer">
      <div className="source-plan-heading"><strong>{drawing.originalFilename} · source CAD drawing</strong><span>Zoom · pan · fit</span></div>
      <div className="source-plan-preview">
        {floorViews.length > 0 && <label className="source-plan-floor-select">Drawing view<select value={selectedFloor?.id ?? "combined"} onChange={(event) => setFloor(event.target.value === "combined" ? "" : event.target.value)}><option value="combined">Combined source drawing</option>{floorViews.map((floor) => <option key={floor.id} value={floor.id}>{floor.label} · verified drawing region</option>)}</select></label>}
        <FloorPlanViewer key={previewUrl} src={previewUrl} title={`${drawing.buildingName} source drawing`} filename={drawing.originalFilename}
          annotationBounds={annotationBounds} annotations={selected ? [selected] : []} onSelectAnnotation={selectAnnotation} />
      </div>
      {error && <p className="source-plan-report-error" role="status">The drawing preview is available, but its inspection report could not be loaded. Searchable annotations are unavailable.</p>}
      <div className="source-plan-note">This is the converted source drawing, shown in 2D at its original aspect ratio. No walls, floor elevations, room boundaries, routes, or room associations are reconstructed. The marker identifies a CAD text insertion point only.</div>
    </section>
    <aside className="source-plan-inspector">
      <section>
        <h2>Source drawing</h2>
        <p>{drawing.associationEvidence}</p>
        <p>{drawing.renderingNotes}</p>
        <div className="source-plan-meta"><span>Building ID</span><strong>{buildingId}</strong></div>
        <div className="source-plan-meta"><span>Source file</span><strong>{drawing.originalFilename}</strong></div>
        <div className="source-plan-meta"><span>Model space / rendered</span><strong>{report ? `${report.modelSpaceEntityCount} / ${renderedEntityCount}` : error ? "Report unavailable" : "Loading…"}</strong></div>
        <div className="source-plan-meta"><span>Floor organization</span><strong>{floorViews.length ? `${floorViews.length} geometry-supported drawing regions` : floorLabels.length ? "Labels found; plan not split" : "Not identified"}</strong></div>
        <div className="source-plan-meta"><span>Room associations</span><strong>Not available</strong></div>
        {selectedFloor && <p>{selectedFloor.evidence} This is a drawing-region view; room boundaries and room associations remain unverified.</p>}
        {!selectedFloor && floorLabels.length > 0 && <p>Floor-related source labels: {floorLabels.map((entry) => entry.text).join(" · ")}. Other plan groups are not reliably separated.</p>}
        <a className="source-plan-download" href={drawing.sourceUrl} download>Download original DWG: {drawing.originalFilename}</a>
      </section>
      <section>
        <h2>Search source text ({matches.length} of {visibleLabels.length})</h2>
        <p>Text is copied from the drawing. Selecting a label highlights its insertion point; it is not a verified room record or center.</p>
        <label className="source-plan-search-label" htmlFor="source-plan-search">Search labels</label>
        <div className="source-plan-search"><Search size={15}/><input id="source-plan-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find text in drawing" /></div>
        <div className="source-plan-label-list">
          {matches.map((entry) => <button type="button" key={entry.sourceIndex} className={selected === entry ? "selected" : ""} onClick={() => selectAnnotation(entry)}>
            <span>{entry.text}</span><small>{entry.layer} · {entry.type}</small>
          </button>)}
          {!error && matches.length === 0 && <p>{report ? "No matching source text." : "Loading source annotations…"}</p>}
        </div>
        {selected && <div className="source-plan-detail"><strong>{selected.text}</strong><span>Source annotation · {selected.layer} / {selected.type}</span><span>CAD insertion point: X {Number.isFinite(selected.x) ? selected.x.toFixed(3) : "unavailable"}, Y {Number.isFinite(selected.y) ? selected.y.toFixed(3) : "unavailable"}</span><span>Room association: unverified</span><button type="button" onClick={clearSelection}>Clear highlight</button></div>}
      </section>
    </aside>
  </div>;
}
