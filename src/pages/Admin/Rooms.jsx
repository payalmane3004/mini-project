import { useEffect, useMemo, useState } from "react";
import { DoorOpen, ExternalLink, MapPin, Plus } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import labels from "../../data/wce-building-labels.json";
import footprints from "../../data/wce-campus-footprints.json";
import groundFloorSource from "../../data/main-building-ground-floor-labels.json";
import firstFloorSource from "../../data/main-building-first-floor-labels.json";
import { allBuildingPlans } from "../../data/buildingDrawings";
import MainBuildingInteriorPrototype from "./MainBuildingInteriorPrototype";
import { createRoom, fetchBuildings, fetchBuildingFloorLabels, fetchBuildingRooms } from "../../api/buildings";
import "./Rooms.css";

const footprintIds = new Set(footprints.footprints.map(({ id }) => id));
const buildings = labels.buildings.filter(({ footprintId }) => footprintIds.has(footprintId));
const EMPTY_ROOMS = [];
const mainBuildingFloors = [
  { number: 0, name: "Ground Floor", source: groundFloorSource },
  { number: 1, name: "First Floor", source: firstFloorSource },
];

function floorName(number) {
  return number === 0 ? "Ground Floor" : number === 1 ? "First Floor" : `Floor ${number}`;
}

function RoomCreateForm({ buildingCode, floorOptions, onCreated }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const room = await createRoom({
        building_code: buildingCode,
        room_code: String(data.get("room_code")).trim(),
        room_name: String(data.get("room_name")).trim() || null,
        floor_number: Number(data.get("floor_number")),
        capacity: Number(data.get("capacity")),
        room_type: String(data.get("room_type")).trim(),
      });
      onCreated(room);
      setSuccess(`${room.room_code} was added to the verified room records.`);
      form.reset();
    } catch (submitError) {
      setError(submitError.message || "Could not create this room.");
    } finally {
      setSubmitting(false);
    }
  }

  return <form className="rooms-create-form" onSubmit={handleSubmit}>
    <div className="rooms-create-heading"><Plus size={16}/><div><h4>Add verified room record</h4><p>Enter values confirmed by campus records. CAD annotations alone do not verify a room.</p></div></div>
    <div className="rooms-create-fields">
      <label>Room code <span className="rooms-required">(required)</span><input name="room_code" required maxLength={30} /></label>
      <label>Room name <span>(optional)</span><input name="room_name" maxLength={100} /></label>
      {floorOptions
        ? <label>Floor <span className="rooms-required">(required)</span><select name="floor_number" defaultValue="" required><option value="" disabled>Select a floor</option>{floorOptions.map(({ number, name: floor }) => <option key={number} value={number}>{floor}</option>)}</select></label>
        : <label>Floor number <span className="rooms-required">(required)</span><input name="floor_number" type="number" step="1" required /></label>}
      <label>Capacity <span className="rooms-required">(required)</span><input name="capacity" type="number" min="0" step="1" required /></label>
      <label>Room type <span className="rooms-required">(required)</span><input name="room_type" required maxLength={30} /></label>
      <button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Add room"}</button>
    </div>
    <p className="rooms-create-note">Capacity is required; enter 0 only when that is the confirmed capacity, not as a placeholder for unknown.</p>
    {error && <p className="rooms-api-error" role="alert">{error}</p>}
    {success && <p className="rooms-create-success" role="status">{success}</p>}
  </form>;
}

export default function Rooms() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("building") || "";
  const [databaseBuildings, setDatabaseBuildings] = useState([]);
  const [buildingsLoading, setBuildingsLoading] = useState(true);
  const [buildingsError, setBuildingsError] = useState("");
  const databaseBuilding = useMemo(() => databaseBuildings.find(({ building_code }) => building_code === selectedId), [databaseBuildings, selectedId]);
  const cadBuilding = useMemo(() => buildings.find(({ footprintId }) => footprintId === selectedId), [selectedId]);
  const name = cadBuilding?.labels.join(" / ") || databaseBuilding?.name || selectedId;
  const [roomsState, setRoomsState] = useState({ key: null, records: [], error: "" });
  const [labelsState, setLabelsState] = useState({ key: null, labels: [], error: "" });

  const roomsLoading = Boolean(selectedId && databaseBuilding && roomsState.key !== selectedId);
  const rooms = roomsState.key === selectedId ? roomsState.records : EMPTY_ROOMS;
  const roomsError = roomsState.key === selectedId ? roomsState.error : "";

  const roomFloors = useMemo(() => [...new Set(rooms.map(({ floor_number }) => floor_number))].sort((a, b) => a - b), [rooms]);
  const requestedFloor = Number(params.get("floor"));
  const selectedFloor = selectedId === "BU-002"
    ? (requestedFloor === 1 ? 1 : 0)
    : Number.isInteger(requestedFloor) && roomFloors.includes(requestedFloor)
      ? requestedFloor
      : roomFloors[0] ?? null;
  const activeMainFloor = mainBuildingFloors.find(({ number }) => number === selectedFloor);
  const labelsKey = selectedFloor === null ? null : `${selectedId}:${selectedFloor}`;
  const labelsLoading = Boolean(labelsKey && databaseBuilding && labelsState.key !== labelsKey);
  const floorLabels = labelsState.key === labelsKey ? labelsState.labels : [];
  const labelsError = labelsState.key === labelsKey ? labelsState.error : "";

  useEffect(() => {
    let active = true;
    fetchBuildings()
      .then((records) => { if (active) { setDatabaseBuildings(records); setBuildingsError(""); } })
      .catch((error) => { if (active) setBuildingsError(error.message); })
      .finally(() => { if (active) setBuildingsLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedId || !databaseBuilding) return undefined;

    let active = true;
    fetchBuildingRooms(selectedId)
      .then((records) => { if (active) setRoomsState({ key: selectedId, records, error: "" }); })
      .catch((error) => { if (active) setRoomsState({ key: selectedId, records: [], error: error.message }); });
    return () => { active = false; };
  }, [selectedId, databaseBuilding]);

  useEffect(() => {
    if (!selectedId || selectedFloor === null || !databaseBuilding) return undefined;

    let active = true;
    fetchBuildingFloorLabels(selectedId, selectedFloor)
      .then((result) => { if (active) setLabelsState({ key: labelsKey, labels: result.floor_labels, error: "" }); })
      .catch((error) => { if (active) setLabelsState({ key: labelsKey, labels: [], error: error.message }); });
    return () => { active = false; };
  }, [selectedId, selectedFloor, databaseBuilding, labelsKey]);

  function setFloor(number) {
    const next = new URLSearchParams(params);
    if (number === null || number === undefined) next.delete("floor");
    else next.set("floor", String(number));
    setParams(next);
  }

  function selectBuilding(event) {
    const id = event.target.value;
    setParams(id ? { building: id, ...(id === "BU-002" ? { floor: "0" } : {}) } : {});
  }

  function handleViewerFloorChange(floor) {
    const number = mainBuildingFloors.find(({ name: label }) => label === floor)?.number;
    if (number !== undefined && number !== selectedFloor) setFloor(number);
  }

  function handleRoomCreated(room) {
    setRoomsState((current) => ({
      key: selectedId,
      records: current.key === selectedId ? [...current.records, room] : [room],
      error: "",
    }));
    setFloor(room.floor_number);
  }

  const roomsOnFloor = selectedFloor === null ? [] : rooms.filter((room) => room.floor_number === selectedFloor);

  return <div className="rooms-page">
    <header className="page-header"><div><h1>Floors &amp; Rooms</h1><p>Source annotations and verified room records are shown separately.</p></div></header>
    <section className="rooms-building-picker">
      <label htmlFor="rooms-building">Database building</label>
      <select id="rooms-building" value={selectedId} onChange={selectBuilding}>
        <option value="">{buildingsLoading ? "Loading database buildings…" : "Choose a database building"}</option>
        {databaseBuildings.map(({ building_code, name: buildingName }) => {
          const sourceLabels = buildings.find(({ footprintId }) => footprintId === building_code)?.labels;
          const displayName = sourceLabels?.length ? `${buildingName} · ${sourceLabels.join(" / ")}` : buildingName;
          return <option value={building_code} key={building_code}>{displayName} · {building_code}</option>;
        })}
      </select>
      {buildingsError && <p className="rooms-api-error" role="alert">{buildingsError}</p>}
      {selectedId && databaseBuilding && <p><MapPin size={14}/> {name} <span>Database code {selectedId}</span></p>}
      {selectedId === "BU-002" && <><label htmlFor="rooms-floor">Selected floor</label><select id="rooms-floor" value={selectedFloor ?? 0} onChange={(event) => setFloor(Number(event.target.value))}>{mainBuildingFloors.map(({ number, name: floor }) => <option key={number} value={number}>{floor}</option>)}</select></>}
      {selectedId && selectedId !== "BU-002" && roomFloors.length > 0 && <><label htmlFor="rooms-floor">Selected floor</label><select id="rooms-floor" value={selectedFloor} onChange={(event) => setFloor(Number(event.target.value))}>{roomFloors.map((number) => <option key={number} value={number}>{floorName(number)}</option>)}</select></>}
      {selectedId && selectedId !== "BU-002" && roomFloors.length === 0 && !roomsLoading && <p>No verified floor records are available for this building.</p>}
    </section>

    {!selectedId ? <section className="rooms-unavailable"><DoorOpen size={24}/><h2>Select a building</h2><p>Choose a building to check for source-backed floor labels and room records.</p></section>
      : buildingsLoading ? <section className="rooms-unavailable" role="status"><p>Loading buildings from the database…</p></section>
        : !databaseBuilding ? <section className="rooms-unavailable"><DoorOpen size={24}/><h2>Building not found</h2><p>{buildingsError || `Building ${selectedId} is not present in the database building list.`}</p></section>
        : <>
          <section className="rooms-unavailable rooms-floor-summary" aria-live="polite">
            <DoorOpen size={24}/><p className="rooms-state-label">{name} · {selectedId}{selectedFloor !== null ? ` · ${floorName(selectedFloor)}` : ""}</p>
            {selectedFloor !== null && selectedId === "BU-002" && activeMainFloor && <><h2>Source floor annotations</h2><p>Text below is original CAD annotation metadata. It does not establish room boundaries, room numbers, occupancy, or capacity.</p><div className="rooms-cad-annotations">{activeMainFloor.source.labels.map((annotation, index) => <span className="rooms-cad-annotation" key={`${annotation.text}-${index}`}>{annotation.text}</span>)}</div><p className="rooms-cad-source">Source: {activeMainFloor.source.source} · local uncalibrated drawing coordinates.</p></>}
            {labelsLoading && <p role="status">Loading database floor annotations…</p>}
            {labelsError && <p className="rooms-api-error" role="alert">{labelsError} Local CAD source annotations remain available where provided.</p>}
            {!labelsLoading && !labelsError && <div className="rooms-database-labels"><h3>Floor labels stored in PostgreSQL</h3><p>These records are imported floor annotations, not verified room records.</p>{floorLabels.length ? <ul>{floorLabels.map((item, index) => <li key={`${item.floor_number}-${item.label}-${index}`}>{item.label}</li>)}</ul> : <p>No database floor labels are recorded for this floor.</p>}</div>}
            {roomsLoading && <p role="status">Loading verified room records…</p>}
            {roomsError && <p className="rooms-api-error" role="alert">{roomsError}</p>}
            {!roomsLoading && !roomsError && <div className="rooms-verified-records"><h3>Verified database room records</h3>{roomsOnFloor.length ? <div className="rooms-record-list">{roomsOnFloor.map((room) => <article className="directory-row" key={room.id}><DoorOpen size={18}/><div className="directory-name"><h3>{room.room_name || room.room_code}</h3><p>Room code {room.room_code} · {room.room_type} · capacity {room.capacity}</p></div></article>)}</div> : <p>No verified room records are available for this floor.</p>}</div>}
            {!roomsLoading && <RoomCreateForm buildingCode={selectedId} floorOptions={selectedId === "BU-002" ? mainBuildingFloors : null} onCreated={handleRoomCreated}/>}
            {allBuildingPlans[selectedId] && <Link className="rooms-plan-link" to={`/building-explorer/${encodeURIComponent(selectedId)}`}><ExternalLink size={15}/> View this building’s source plan and annotations</Link>}
          </section>
          {selectedId === "BU-002" && <MainBuildingInteriorPrototype embedded floor={activeMainFloor?.name || "Ground Floor"} onFloorChange={handleViewerFloorChange} />}
        </>}
  </div>;
}
