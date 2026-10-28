import { useEffect, useMemo, useState } from "react";
import { DoorOpen, RefreshCw, Users } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { fetchBuildings, fetchRooms } from "../../api/buildings";
import { findUniqueBuildingMatch, roomsForBuilding } from "../../api/buildingMatching";
import { isDemoRoom } from "../../api/demoData.js";

function StudentRooms() {
  const [searchParams] = useSearchParams();
  const [buildings, setBuildings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState("");
  const [selectedFloor, setSelectedFloor] = useState("");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([fetchBuildings(), fetchRooms()]).then(([buildingRows, roomRows]) => {
      if (!active) return;
      setBuildings(buildingRows); setRooms(roomRows);
      const requestedCode = searchParams.get("building");
      const requestedMatch = requestedCode ? findUniqueBuildingMatch(requestedCode, buildingRows) : null;
      const initial = requestedCode ? requestedMatch?.building?.id ?? "" : buildingRows[0]?.id ?? "";
      setSelectedBuilding(String(initial)); setStatus("ready"); setError(requestedMatch?.status === "ambiguous" ? "Multiple database buildings match this code; no building was selected." : "");
    }).catch((reason) => { if (active) { setStatus("error"); setError(reason.message); } });
    return () => { active = false; };
  }, [retryKey, searchParams]);

  const building = buildings.find((item) => String(item.id) === selectedBuilding);
  const requestedCode = searchParams.get("building");
  const requestedMatch = requestedCode ? findUniqueBuildingMatch(requestedCode, buildings) : null;
  const requestedBuildingNotFound = status === "ready"
    && Boolean(requestedCode)
    && buildings.length > 0
    && requestedMatch?.status !== "matched";
  const buildingRooms = roomsForBuilding(rooms, building?.id);
  const nonDemoBuildingRooms = buildingRooms.filter((room) => !isDemoRoom(room));
  const demoBuildingRooms = buildingRooms.filter(isDemoRoom);
  const floors = useMemo(() => [...new Set(buildingRooms.map((room) => room.floor_number))].sort((a, b) => a - b), [buildingRooms]);
  const floor = floors.includes(Number(selectedFloor)) ? Number(selectedFloor) : floors[0];
  const filteredRooms = buildingRooms.filter((room) => room.floor_number === floor);

  return <div className="student-rooms-page">
    <div className="student-page-header"><div><h1>Floors &amp; Rooms</h1><p>Explore database room records. Demo records are marked and are not operational inventory.</p></div></div>
    {status === "loading" && <p role="status">Loading buildings and room records…</p>}
    {status === "error" && <div className="student-dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={() => setRetryKey((key) => key + 1)}><RefreshCw size={15} /> Retry</button></div>}
    {requestedBuildingNotFound && <div className="events-empty-state" role="status"><h2>{requestedMatch?.status === "ambiguous" ? "Building match is ambiguous" : "Building not found"}</h2><p>{requestedMatch?.status === "ambiguous" ? `Multiple database records match “${requestedCode}”; none was selected.` : `No database building matches “${requestedCode}”. Choose a building from the directory.`}</p></div>}
    {status === "ready" && !requestedBuildingNotFound && buildings.length > 0 && <section className="student-room-controls"><div className="room-building-select"><label htmlFor="student-building">Select Building</label><div className="select-wrapper"><select id="student-building" value={selectedBuilding} onChange={(event) => { setSelectedBuilding(event.target.value); setSelectedFloor(""); setSelectedRoom(null); }}>{buildings.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.building_code})</option>)}</select></div></div><div className="room-building-info"><span>{building?.building_code}</span><strong>{building?.name}</strong><small>{nonDemoBuildingRooms.length} non-demo room records{demoBuildingRooms.length > 0 ? ` · ${demoBuildingRooms.length} demo-only` : ""}</small></div></section>}
    {status === "ready" && buildings.length === 0 && <div className="events-empty-state"><h2>No building records</h2><p>Rooms cannot be browsed until building records are available.</p></div>}
    {status === "ready" && !requestedBuildingNotFound && building && buildingRooms.length === 0 && <div className="events-empty-state"><DoorOpen size={30} /><h2>No room records</h2><p>This building currently has no room records. CAD labels may appear in the Digital Twin, but they are not database room records.</p></div>}
    {status === "ready" && !requestedBuildingNotFound && floors.length > 0 && <>
      <section className="student-floor-tabs" aria-label="Floors">{floors.map((floorNumber) => {
        const floorRooms = buildingRooms.filter((room) => room.floor_number === floorNumber);
        const demoCount = floorRooms.filter(isDemoRoom).length;
        return <button key={floorNumber} className={floor === floorNumber ? "active" : ""} aria-pressed={floor === floorNumber} onClick={() => { setSelectedFloor(String(floorNumber)); setSelectedRoom(null); }}><span>Floor {floorNumber}</span><small>{floorRooms.length} records{demoCount > 0 ? ` · ${demoCount} demo` : ""}</small></button>;
      })}</section>
      <section className="student-rooms-section"><div className="rooms-section-heading"><div><h2>Database rooms</h2><p>{building?.name} · Floor {floor}</p></div><div className="room-count">{filteredRooms.filter((room) => !isDemoRoom(room)).length} non-demo · {filteredRooms.filter(isDemoRoom).length} demo</div></div>
        <div className="student-room-grid">{filteredRooms.map((room) => {
          const demoRoom = isDemoRoom(room);
          return <button key={room.id} className={`student-room-card ${selectedRoom?.id === room.id ? "selected" : ""}`} onClick={() => setSelectedRoom(room)}><div className="room-card-top"><div className="room-icon"><DoorOpen size={20} /></div><span className="room-status">{demoRoom ? "Demo only · not verified" : "Database room record"}</span></div><h3>{room.room_code}</h3><p>{room.room_name || room.room_type}</p><div className="room-occupancy"><Users size={15} /><span>{room.capacity ?? "Not recorded"}</span><small>capacity</small></div></button>;
        })}</div>
      </section>
      {selectedRoom && <section className="room-details-panel"><div className="room-details-header"><div><span className="room-detail-code">{isDemoRoom(selectedRoom) ? "Demo only · not verified" : selectedRoom.room_type}</span><h2>{selectedRoom.room_code}</h2><p>{building?.name} · Floor {selectedRoom.floor_number}</p></div></div><div className="room-detail-grid"><div className="room-detail-item"><Users size={19} /><div><span>{isDemoRoom(selectedRoom) ? "Demo capacity" : "Recorded capacity"}</span><strong>{selectedRoom.capacity ?? "Not recorded"}</strong></div></div></div></section>}
    </>}
    <p className="student-dashboard-data-note">This page uses database room records only. CAD annotations are separate and do not indicate verified room boundaries, room availability, occupancy, or equipment status.</p>
  </div>;
}

export default StudentRooms;
