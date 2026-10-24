import { useEffect, useState } from "react";
import { FlaskConical, RefreshCw } from "lucide-react";
import { fetchAdminBookings } from "../../api/admin";
import { fetchBuildings, fetchRooms } from "../../api/buildings";
import { validateAdminBookingList } from "../../api/analyticsDashboardData";
import { calculateBuildingClosureScope, CLOSURE_DURATIONS, hasScenarioSourceData } from "./scenarioScope";
import "./ScenarioLab.css";

function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatWindowTime(timestamp) {
  return new Date(timestamp).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

const EMPTY_RESOURCES = { buildings: null, rooms: null, bookings: null };

function ScenarioLab() {
  const [resources, setResources] = useState(EMPTY_RESOURCES);
  const [resourceErrors, setResourceErrors] = useState({});
  const [selectedBuilding, setSelectedBuilding] = useState("");
  const [startDate, setStartDate] = useState(() => localDateInputValue());
  const [durationDays, setDurationDays] = useState(1);
  const [result, setResult] = useState(null);
  const [calculationError, setCalculationError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      fetchBuildings(),
      fetchRooms(),
      fetchAdminBookings().then(validateAdminBookingList),
    ]).then((outcomes) => {
      if (!active) return;
      const keys = ["buildings", "rooms", "bookings"];
      const nextResources = { ...EMPTY_RESOURCES };
      const nextErrors = {};
      outcomes.forEach((outcome, index) => {
        const key = keys[index];
        if (outcome.status === "fulfilled") nextResources[key] = outcome.value;
        else nextErrors[key] = `Could not load verified ${key} records.`;
      });
      setResources(nextResources);
      setResourceErrors(nextErrors);
      setSelectedBuilding((current) => (
        nextResources.buildings?.some((building) => String(building.id) === current)
          ? current
          : String(nextResources.buildings?.[0]?.id || "")
      ));
      setResult(null);
      setCalculationError("");
      setLoading(false);
    });
    return () => { active = false; };
  }, [retryKey]);

  const buildings = resources.buildings || [];
  const rooms = resources.rooms || [];
  const bookings = resources.bookings || [];
  const canCalculate = !loading && hasScenarioSourceData({
    buildings: resources.buildings,
    rooms: resources.rooms,
    bookings: resources.bookings,
  });
  const selectedBuildingRecord = buildings.find((building) => String(building.id) === selectedBuilding) || null;

  function calculate(event) {
    event.preventDefault();
    setCalculationError("");
    const calculated = calculateBuildingClosureScope(
      Number(selectedBuilding), buildings, rooms, bookings, startDate, Number(durationDays),
    );
    if (!calculated) {
      setResult(null);
      setCalculationError("Choose a verified building, valid start date, and supported closure duration.");
      return;
    }
    setResult(calculated);
  }

  function retry() {
    setLoading(true);
    setResourceErrors({});
    setResult(null);
    setRetryKey((value) => value + 1);
  }

  const inventoryUnavailable = !loading && !resourceErrors.buildings && !resourceErrors.rooms
    && (buildings.length === 0 || rooms.length === 0);
  const requiredResourceUnavailable = ["buildings", "rooms", "bookings"]
    .some((resource) => resourceErrors[resource]);

  return <div className="scenario-page">
    <header className="scenario-page-heading">
      <div>
        <span className="scenario-eyebrow"><FlaskConical size={14} aria-hidden="true"/> PLANNING WORKSPACE</span>
        <h1>Campus Scenario Lab</h1>
        <p>Scope a temporary building closure using verified inventory and booking records.</p>
      </div>
      <span className="scenario-readonly-badge">Read-only calculation</span>
    </header>

    <section className="scenario-disclaimer" aria-label="Scenario calculation disclaimer">
      <FlaskConical size={17} aria-hidden="true"/>
      <p><strong>Scenario estimate</strong> · Deterministic record-based calculation, not a measurement, live simulation, or prediction. No bookings are changed.</p>
    </section>

    {loading && <div className="scenario-data-state" role="status">Loading verified building, room, and booking records…</div>}
    {requiredResourceUnavailable && <div className="scenario-error" role="alert">
      <div><strong>Required scenario data is unavailable</strong><span>{Object.values(resourceErrors).join(" ")} The calculation is disabled until all three sources can be loaded.</span></div>
      <button type="button" onClick={retry} disabled={loading}><RefreshCw size={14} aria-hidden="true"/> Retry</button>
    </div>}

    {!loading && inventoryUnavailable && <section className="scenario-empty-inventory" role="status">
      <strong>Verified inventory is required</strong>
      <p>{buildings.length === 0 ? "No verified database building records are available." : "No verified database room records are available."} Add verified building and room records before calculating a closure scope. CAD labels do not establish inventory.</p>
    </section>}

    <section className="scenario-workspace" aria-labelledby="scenario-config-title">
      <div className="scenario-section-heading"><div><span>CONFIGURATION</span><h2 id="scenario-config-title">Temporary building closure</h2></div><p>Choose a verified building and a closure window.</p></div>
      <form className="scenario-config-form" onSubmit={calculate}>
        <label htmlFor="scenario-building">Verified building <span aria-hidden="true">*</span>
          <select id="scenario-building" required value={selectedBuilding} disabled={!canCalculate} onChange={(event) => { setSelectedBuilding(event.target.value); setResult(null); setCalculationError(""); }}>
            <option value="">Select a building</option>
            {buildings.map((building) => <option key={building.id} value={building.id}>{building.name} · {building.building_code}</option>)}
          </select>
        </label>
        <label htmlFor="scenario-start-date">Closure starts <span aria-hidden="true">*</span>
          <input id="scenario-start-date" type="date" required value={startDate} disabled={!canCalculate} onChange={(event) => { setStartDate(event.target.value); setResult(null); setCalculationError(""); }}/>
        </label>
        <label htmlFor="scenario-duration">Duration <span aria-hidden="true">*</span>
          <select id="scenario-duration" required value={durationDays} disabled={!canCalculate} onChange={(event) => { setDurationDays(Number(event.target.value)); setResult(null); setCalculationError(""); }}>
            {CLOSURE_DURATIONS.map((duration) => <option key={duration.days} value={duration.days}>{duration.label}</option>)}
          </select>
        </label>
        <button className="scenario-calculate-button" type="submit" disabled={!canCalculate || !selectedBuilding || !startDate}>
          Calculate scenario
        </button>
      </form>

      {selectedBuildingRecord && <p className="scenario-building-summary"><strong>{selectedBuildingRecord.name}</strong> · {selectedBuildingRecord.building_code}{selectedBuildingRecord.description ? ` · ${selectedBuildingRecord.description}` : ""}</p>}
      {!loading && !requiredResourceUnavailable && !inventoryUnavailable && !canCalculate && <p className="scenario-unavailable-note">Building, room, and booking records are all required. An empty bookings list is valid; failed or unavailable sources disable the calculation.</p>}
      {calculationError && <p className="scenario-validation-error" role="alert">{calculationError}</p>}
    </section>

    <section className="scenario-results" aria-labelledby="scenario-results-title" aria-live="polite">
      <div className="scenario-section-heading"><div><span>RESULTS</span><h2 id="scenario-results-title">Closure scope</h2></div>{result && <span className="scenario-result-tag">Based on stored records</span>}</div>
      {!result && <div className="scenario-results-empty" role="status">Configure a closure and calculate its verified room scope. No impact figures are generated before calculation.</div>}
      {result && <>
        <dl className="scenario-result-grid">
          <div><dt>Building</dt><dd>{result.building.name} · {result.building.building_code}</dd></div>
          <div><dt>Closure period</dt><dd>{result.durationDays === 7 ? "1 week" : `${result.durationDays} day${result.durationDays === 1 ? "" : "s"}`} · {formatWindowTime(result.windowStart)} – {formatWindowTime(result.windowEnd)} <small>(end exclusive)</small></dd></div>
          <div><dt>Verified rooms in scope</dt><dd>{result.roomCount}</dd></div>
          <div><dt>Overlapping active bookings</dt><dd>{result.overlappingBookingCount === null ? "Incomplete data" : result.overlappingBookingCount}</dd></div>
        </dl>
        {result.uncheckableBookingCount > 0 && <p className="scenario-limitation" role="status">{result.uncheckableBookingCount} active booking record(s) for rooms in this building had invalid time values. A complete overlap count cannot be reported.</p>}
        {result.overlappingBookingCount !== null && <p className="scenario-method-note">Overlap rule: a booking is included when its status is PENDING or APPROVED and its time intersects the selected closure window. Rejected and cancelled bookings are excluded.</p>}
        <p className="scenario-limitation">Alternative room assignments are not calculated: booking records do not include attendance or room-compatibility requirements needed to establish a suitable replacement.</p>
      </>}
    </section>

    <p className="scenario-source-note">Calculations use the existing read-only building, room, and administrator booking APIs. The tool does not create, edit, or cancel bookings.</p>
  </div>;
}

export default ScenarioLab;
