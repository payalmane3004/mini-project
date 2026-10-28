import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { DoorOpen, Download, ExternalLink, MapPin, Plus, Printer, QrCode, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import labels from "../../data/wce-building-labels.json";
import footprints from "../../data/wce-campus-footprints.json";
import groundFloorSource from "../../data/main-building-ground-floor-labels.json";
import firstFloorSource from "../../data/main-building-first-floor-labels.json";
import { allBuildingPlans } from "../../data/buildingDrawings";
import MainBuildingInteriorPrototype from "./MainBuildingInteriorPrototype";
import { createRoom, fetchBuildings, fetchBuildingFloorLabels, fetchBuildingRooms, fetchRooms } from "../../api/buildings";
import { fetchAdminBookings } from "../../api/admin";
import { isDemoFloorLabel, isDemoRoom } from "../../api/demoData.js";
import { buildCampusRoomQrPayload } from "../../api/roomQr.js";
import { useDemoMode } from "../../components/layout/useDemoMode.js";
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

function roomAvailability(room, bookings, now) {
  if (!now) return "Availability unavailable";
  return bookings.some((booking) => booking.room_id === room.id
    && ["PENDING", "APPROVED"].includes(String(booking.status).toUpperCase())
    && Date.parse(booking.start_time) <= now && Date.parse(booking.end_time) > now) ? "Occupied" : "Available";
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
      setSuccess(`${room.room_code} was added to the room records${isDemoRoom(room) ? " as demo-only inventory" : ""}.`);
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

function RoomQrDialog({ room, buildingName, onClose }) {
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(buildCampusRoomQrPayload(room.room_code), { errorCorrectionLevel: "M", margin: 2, width: 420 })
      .then((url) => { if (active) setImage(url); })
      .catch(() => { if (active) setError("Could not generate this room QR code."); });
    return () => { active = false; };
  }, [room.room_code]);
  return <div className="rooms-qr-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="rooms-qr-dialog" role="dialog" aria-modal="true" aria-labelledby="room-qr-title">
      <button className="rooms-qr-close" type="button" aria-label="Close room QR" onClick={onClose}><X size={18}/></button>
      <h2 id="room-qr-title">Room QR code</h2>
      <p><strong>{room.room_code}</strong><br/>{buildingName}</p>
      {isDemoRoom(room) && <p className="rooms-demo-qr-label">DEMO ONLY · fictional local inventory, not verified operational inventory</p>}
      {image ? <img className="rooms-qr-image" src={image} alt={`QR code for room ${room.room_code}`} /> : <p role={error ? "alert" : "status"}>{error || "Generating QR code…"}</p>}
      <p>Payload: <code>{buildCampusRoomQrPayload(room.room_code)}</code></p>
      <div className="rooms-qr-actions">
        <a href={image || undefined} download={`${room.room_code}-room-qr.png`} aria-disabled={!image}><Download size={16}/> Download PNG</a>
        <button type="button" disabled={!image} onClick={() => window.print()}><Printer size={16}/> Print</button>
      </div>
    </section>
  </div>;
}

export default function Rooms() {
  const demoMode = useDemoMode();
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
  const [qrRoom, setQrRoom] = useState(null);
  const [inventory, setInventory] = useState({ status: "loading", rooms: [], bookings: [], error: "" });
  const [inventoryFilters, setInventoryFilters] = useState({ building: "", type: "", capacity: "", availability: "" });
  const [selectedInventoryRoom, setSelectedInventoryRoom] = useState(null);
  const [availabilityTime, setAvailabilityTime] = useState(0);

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
    let active = true;
    Promise.all([fetchRooms(), fetchAdminBookings()])
      .then(([rooms, bookings]) => { if (active) setInventory({ status: "ready", rooms, bookings, error: "" }); })
      .catch((error) => { if (active) setInventory({ status: "error", rooms: [], bookings: [], error: error.message || "Could not load room inventory." }); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const refreshTime = () => setAvailabilityTime(Date.now());
    refreshTime();
    const timer = window.setInterval(refreshTime, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const inventoryRooms = useMemo(() => inventory.rooms.filter((room) => {
    return (!inventoryFilters.building || String(room.building_id) === inventoryFilters.building)
      && (!inventoryFilters.type || room.room_type === inventoryFilters.type)
      && (!inventoryFilters.capacity || Number(room.capacity) >= Number(inventoryFilters.capacity))
      && (!inventoryFilters.availability || roomAvailability(room, inventory.bookings, availabilityTime) === inventoryFilters.availability);
  }), [inventory.rooms, inventory.bookings, inventoryFilters, availabilityTime]);

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
    <section className="rooms-live-inventory" aria-labelledby="rooms-inventory-title">
      <div><h2 id="rooms-inventory-title">Room inventory</h2><p>Live records from the authenticated CampusSphere API. Availability is derived from bookings active now.</p></div>
      <div className="rooms-inventory-filters">
        <label>Building<select value={inventoryFilters.building} onChange={(event) => setInventoryFilters((value) => ({ ...value, building: event.target.value }))}><option value="">All buildings</option>{databaseBuildings.map((building) => <option key={building.id} value={building.id}>{building.name} · {building.building_code}</option>)}</select></label>
        <label>Room type<select value={inventoryFilters.type} onChange={(event) => setInventoryFilters((value) => ({ ...value, type: event.target.value }))}><option value="">All types</option>{[...new Set(inventory.rooms.map((room) => room.room_type))].sort().map((type) => <option key={type}>{type}</option>)}</select></label>
        <label>Minimum capacity<input type="number" min="0" value={inventoryFilters.capacity} onChange={(event) => setInventoryFilters((value) => ({ ...value, capacity: event.target.value }))}/></label>
        <label>Availability<select value={inventoryFilters.availability} onChange={(event) => setInventoryFilters((value) => ({ ...value, availability: event.target.value }))}><option value="">Any</option><option>Available</option><option>Occupied</option></select></label>
      </div>
      {inventory.status === "loading" && <p role="status">Loading room records…</p>}
      {inventory.status === "error" && <p className="rooms-api-error" role="alert">{inventory.error}</p>}
      {inventory.status === "ready" && !inventoryRooms.length && <p role="status">No rooms match these filters.</p>}
      {inventory.status === "ready" && inventoryRooms.length > 0 && <div className="rooms-inventory-table-wrap"><table className="rooms-inventory-table"><thead><tr><th>Room</th><th>Building</th><th>Floor</th><th>Type</th><th>Capacity</th><th>Availability</th></tr></thead><tbody>{inventoryRooms.map((room) => <tr key={room.id}><td><button type="button" className="rooms-inventory-select" onClick={() => setSelectedInventoryRoom(room)}>{room.room_name || room.room_code}</button>{room.room_code.startsWith("DEMO-") && <small>Sample</small>}</td><td>{databaseBuildings.find((item) => item.id === room.building_id)?.name || "Building unavailable"}</td><td>{room.floor_number}</td><td>{room.room_type}</td><td>{room.capacity}</td><td>{roomAvailability(room, inventory.bookings, availabilityTime)}</td></tr>)}</tbody></table></div>}
      {selectedInventoryRoom && <aside className="rooms-inventory-detail"><h3>{selectedInventoryRoom.room_name || selectedInventoryRoom.room_code}</h3><p>{databaseBuildings.find((item) => item.id === selectedInventoryRoom.building_id)?.name || "Building unavailable"} · Room {selectedInventoryRoom.room_code} · Floor {selectedInventoryRoom.floor_number} · Capacity {selectedInventoryRoom.capacity} · {roomAvailability(selectedInventoryRoom, inventory.bookings, availabilityTime)}</p><button type="button" onClick={() => setSelectedInventoryRoom(null)}>Close details</button></aside>}
    </section>
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
            {!labelsLoading && !labelsError && <div className="rooms-database-labels"><h3>Floor labels stored in the database</h3><p>These records are imported floor annotations, not verified room records.</p>{floorLabels.length ? <ul>{floorLabels.map((item, index) => <li key={`${item.floor_number}-${item.label}-${index}`}>{item.label}{isDemoFloorLabel(item) && <strong> · Demo only</strong>}</li>)}</ul> : <p>No database floor labels are recorded for this floor.</p>}</div>}
            {roomsLoading && <p role="status">Loading verified room records…</p>}
            {roomsError && <p className="rooms-api-error" role="alert">{roomsError}</p>}
            {!roomsLoading && !roomsError && <div className="rooms-verified-records"><h3>Database room records</h3>{roomsOnFloor.length ? <div className="rooms-record-list">{roomsOnFloor.map((room) => <article className="directory-row" key={room.id}><DoorOpen size={18}/><div className="directory-name"><h3>{room.room_name || room.room_code}{isDemoRoom(room) && <strong> · Demo only · not verified</strong>}</h3><p>Room code {room.room_code} · {room.room_type} · capacity {room.capacity}</p></div>{(!isDemoRoom(room) || demoMode) && <button type="button" className="rooms-qr-open" onClick={() => setQrRoom(room)} aria-label={`Open QR code for ${room.room_code}`}>{isDemoRoom(room) ? <><QrCode size={16}/> Demo QR</> : <><QrCode size={16}/> Room QR</>}</button>}</article>)}</div> : <p>No database room records are available for this floor.</p>}</div>}
            {!roomsLoading && (databaseBuilding.is_demo || databaseBuilding.building_code.toUpperCase().startsWith("DEMO-")
              ? <p className="rooms-demo-inventory-note">DEMO ONLY: this fictional room inventory is fixed for the local preview and is not editable as verified inventory.</p>
              : <RoomCreateForm buildingCode={selectedId} floorOptions={selectedId === "BU-002" ? mainBuildingFloors : null} onCreated={handleRoomCreated}/>)}
            {allBuildingPlans[selectedId] && <Link className="rooms-plan-link" to={`/building-explorer/${encodeURIComponent(selectedId)}`}><ExternalLink size={15}/> View this building’s source plan and annotations</Link>}
          </section>
      {qrRoom && <RoomQrDialog room={qrRoom} buildingName={databaseBuilding?.name || "Building unavailable"} onClose={() => setQrRoom(null)} />}
          {selectedId === "BU-002" && <MainBuildingInteriorPrototype embedded floor={activeMainFloor?.name || "Ground Floor"} onFloorChange={handleViewerFloorChange} />}
        </>}
  </div>;
}
