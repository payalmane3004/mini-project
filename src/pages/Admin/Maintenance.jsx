import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Building2, CheckCircle2, ChevronRight, Clock3, MapPin, QrCode, RefreshCw, Search, Wrench, X } from "lucide-react";
import {
  fetchAdminMaintenanceRequests,
  updateMaintenanceRequestStatus,
} from "../../api/maintenance";
import { fetchBuildings, fetchRooms } from "../../api/buildings";
import { filterOperationalRooms } from "../../api/demoData.js";
import { findVerifiedRoomByCode, parseCampusRoomQrPayload } from "../../api/roomQr.js";
import CampusQrScanner from "../../components/CampusQrScanner";

const filters = ["All", "Open", "In Progress", "Resolved"];
const statusValues = ["OPEN", "IN_PROGRESS", "RESOLVED"];

function statusLabel(status) {
  return ({ OPEN: "Open", IN_PROGRESS: "In Progress", RESOLVED: "Resolved" })[status] || status;
}

function statusClass(status) {
  return status.toLowerCase().replaceAll("_", "-");
}

function formatTimestamp(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

function Maintenance() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updating, setUpdating] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [roomInventory, setRoomInventory] = useState({ status: "idle", rooms: [], buildings: [], error: "" });
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [scannerError, setScannerError] = useState("");
  const [matchedRoom, setMatchedRoom] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const scanLoadId = useRef(0);

  useEffect(() => {
    let active = true;
    fetchAdminMaintenanceRequests().then((rows) => {
      if (!active) return;
      setRequests(rows);
      setError("");
      setLoading(false);
    }).catch((requestError) => {
      if (!active) return;
      setError(requestError.message || "Could not load maintenance requests.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [retryKey]);

  const filteredRequests = useMemo(() => requests.filter((request) => (
    (!selectedRoom || request.room_id === selectedRoom.id)
    && (filter === "All" || statusLabel(request.status) === filter)
  )), [requests, filter, selectedRoom]);
  const counts = useMemo(() => ({
    total: requests.length,
    open: requests.filter(({ status }) => status === "OPEN").length,
    progress: requests.filter(({ status }) => status === "IN_PROGRESS").length,
    resolved: requests.filter(({ status }) => status === "RESOLVED").length,
  }), [requests]);

  async function saveStatus(status) {
    if (!selected || updating || status === selected.status) return;
    setUpdating(true);
    setError("");
    setSuccess("");
    try {
      const updated = await updateMaintenanceRequestStatus(selected.id, status);
      setRequests((current) => current.map((request) => request.id === updated.id ? updated : request));
      setSelected(updated);
      setSuccess(`Request #${updated.id} is now ${statusLabel(updated.status).toLowerCase()}.`);
      try {
        const refreshed = await fetchAdminMaintenanceRequests();
        setRequests(refreshed);
        setSelected(refreshed.find(({ id }) => id === updated.id) || updated);
      } catch (refreshError) {
        setError(`Status was saved, but the request list could not be refreshed: ${refreshError.message}`);
      }
    } catch (updateError) {
      setError(updateError.message || "Could not update the request status.");
    } finally {
      setUpdating(false);
    }
  }

  function openRoomScanner() {
    setScannerOpen(true);
    setRoomCodeInput("");
    setScannerError("");
    setMatchedRoom(null);
    setRoomInventory({ status: "loading", rooms: [], buildings: [], error: "" });
    const loadId = ++scanLoadId.current;
    Promise.all([fetchRooms(), fetchBuildings()]).then(([rooms, buildings]) => {
      if (scanLoadId.current === loadId) setRoomInventory({ status: "ready", rooms: filterOperationalRooms(rooms), buildings, error: "" });
    }).catch((loadError) => {
      if (scanLoadId.current === loadId) setRoomInventory({ status: "error", rooms: [], buildings: [], error: loadError.message || "Could not load verified room records." });
    });
  }

  function closeRoomScanner() {
    scanLoadId.current += 1;
    setScannerOpen(false);
  }

  function resolveRoomCode(code) {
    if (!code?.trim()) {
      setMatchedRoom(null);
      setScannerError("Enter or scan a room code to look it up.");
      return false;
    }
    const room = findVerifiedRoomByCode(roomInventory.rooms, code);
    if (!room) {
      setMatchedRoom(null);
      setScannerError(`Room code “${code}” is not in the verified room directory.`);
      return false;
    }
    setMatchedRoom(room);
    setScannerError("");
    return true;
  }

  function handleQrScan(payload) {
    const parsed = parseCampusRoomQrPayload(payload);
    if (!parsed.ok) {
      setScannerError(parsed.error);
      return false;
    }
    return resolveRoomCode(parsed.roomCode);
  }

  function handleManualRoomLookup(event) {
    event.preventDefault();
    resolveRoomCode(roomCodeInput);
  }

  function chooseMatchedRoom() {
    if (!matchedRoom) return;
    setSelectedRoom(matchedRoom);
    closeRoomScanner();
  }

  const matchedBuilding = matchedRoom
    ? roomInventory.buildings.find(({ id }) => id === matchedRoom.building_id)
    : null;

  return (
    <div className="maintenance-page">
      <header className="maintenance-heading">
        <div><h1>Smart Maintenance</h1><p>Campus requests submitted by students</p></div>
        <div className="maintenance-actions">
          <button className="maintenance-scan-button" type="button" onClick={openRoomScanner}><QrCode size={17} /> Scan Room QR</button>
        </div>
      </header>

      {selectedRoom && <section className="maintenance-selected-room" aria-label="Selected verified room">
        <div><MapPin size={18}/><span><strong>{selectedRoom.room_code}{selectedRoom.room_name ? ` · ${selectedRoom.room_name}` : ""}</strong><small>{roomInventory.buildings.find(({ id }) => id === selectedRoom.building_id)?.name || "Building unavailable"} · Room ID {selectedRoom.id} · {requests.filter(({ room_id }) => room_id === selectedRoom.id).length} saved requests</small></span></div>
        <button type="button" onClick={() => setSelectedRoom(null)}>Clear room selection</button>
      </section>}

      {success && <p role="status">{success}</p>}
      {error && <div className="maintenance-api-error" role="alert"><span>{error}</span><button type="button" onClick={() => { setLoading(true); setError(""); setRetryKey((key) => key + 1); }}><RefreshCw size={15} /> Retry</button></div>}

      <section className="maintenance-stats" aria-label="Maintenance request summary">
        <article className="maintenance-stat"><span className="maintenance-stat-title">TOTAL REQUESTS</span><span className="maintenance-stat-icon cyan"><Wrench size={19}/></span><strong>{loading ? "…" : counts.total}</strong><small>Persisted requests</small></article>
        <article className="maintenance-stat"><span className="maintenance-stat-title">OPEN</span><span className="maintenance-stat-icon amber"><AlertCircle size={19}/></span><strong>{loading ? "…" : counts.open}</strong><small>Needs attention</small></article>
        <article className="maintenance-stat"><span className="maintenance-stat-title">IN PROGRESS</span><span className="maintenance-stat-icon blue"><Clock3 size={19}/></span><strong>{loading ? "…" : counts.progress}</strong><small>Being handled</small></article>
        <article className="maintenance-stat"><span className="maintenance-stat-title">RESOLVED</span><span className="maintenance-stat-icon green"><CheckCircle2 size={19}/></span><strong>{loading ? "…" : counts.resolved}</strong><small>Marked resolved</small></article>
      </section>

      <div className="maintenance-list-controls">
        <div className="maintenance-filters" role="tablist" aria-label="Filter maintenance requests">
          {filters.map((item) => <button key={item} role="tab" aria-selected={filter === item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
        </div>
        <span>{loading ? "Loading…" : `${filteredRequests.length} requests`}</span>
      </div>

      <section className="maintenance-table-panel" aria-label="Maintenance requests">
        <div className="maintenance-table-scroll"><table className="maintenance-table"><thead><tr><th>REQUEST</th><th>ROOM / BUILDING</th><th>PRIORITY</th><th>REPORTED</th><th>REPORTED BY</th><th>STATUS</th><th aria-label="Details"/></tr></thead><tbody>
          {!loading && filteredRequests.map((request) => <tr key={request.id} onClick={() => setSelected(request)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && setSelected(request)}>
            <td><strong>{request.title}{request.is_demo && <small> · DEMO ONLY</small>}</strong><small>#{request.id}</small></td>
            <td className="maintenance-location">{request.room_code}{request.is_demo && " · demo-only"}{request.building_name ? ` · ${request.building_name}` : ""}</td>
            <td><span className={`maintenance-pill priority-${request.priority.toLowerCase()}`}>{request.priority.toLowerCase()}</span></td>
            <td className="maintenance-reported">{formatTimestamp(request.created_at)}</td>
            <td>{request.reporter_name || "Student account unavailable"}</td>
            <td><span className={`maintenance-pill status-${statusClass(request.status)}`}>{statusLabel(request.status)}</span></td>
            <td className="maintenance-row-arrow"><ChevronRight size={17}/></td>
          </tr>)}
        </tbody></table>
          {loading && <div className="maintenance-empty" role="status">Loading saved maintenance requests…</div>}
          {!loading && !error && filteredRequests.length === 0 && <div className="maintenance-empty" role="status">No persisted requests match this filter.</div>}
        </div>
      </section>

      {selected && <div className="maintenance-overlay" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><section className="maintenance-dialog maintenance-detail-dialog" aria-labelledby="maintenance-detail-title" aria-modal="true" role="dialog">
        <button className="maintenance-dialog-close" type="button" aria-label="Close request details" onClick={() => setSelected(null)}>×</button>
        <span className="maintenance-dialog-id">Request #{selected.id}{selected.is_demo && " · DEMO ONLY"}</span><h2 id="maintenance-detail-title">{selected.title}</h2>
        <span className={`maintenance-pill status-${statusClass(selected.status)}`}>{statusLabel(selected.status)}</span>
        <p>{selected.description || "No description provided."}</p>
        <dl>
          <div><dt>Room</dt><dd>{selected.room_code}{selected.room_name ? ` · ${selected.room_name}` : ""}</dd></div>
          <div><dt>Building</dt><dd>{selected.building_name ? `${selected.building_name}${selected.building_code ? ` (${selected.building_code})` : ""}` : "Unavailable"}</dd></div>
          <div><dt>Priority</dt><dd>{selected.priority.toLowerCase()}</dd></div>
          <div><dt>Reported by</dt><dd>{selected.reporter_name || "Student account unavailable"}</dd></div>
          <div><dt>Created</dt><dd>{formatTimestamp(selected.created_at)}</dd></div>
          <div><dt>Resolved</dt><dd>{selected.resolved_at ? formatTimestamp(selected.resolved_at) : "Not resolved"}</dd></div>
        </dl>
        <label className="maintenance-status-control">Update status
          <select aria-label="Request status" value={selected.status} onChange={(event) => saveStatus(event.target.value)} disabled={updating || selected.is_demo}>
            {statusValues.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </select>
          {selected.is_demo && <small>Sample record is read-only and cannot change operational maintenance status.</small>}
        </label>
        {updating && <p role="status">Saving status…</p>}
        <div className="maintenance-dialog-actions"><button type="button" onClick={() => setSelected(null)}>Close</button></div>
      </section></div>}

      {scannerOpen && <div className="maintenance-overlay" onMouseDown={(event) => event.target === event.currentTarget && closeRoomScanner()}><section className="maintenance-dialog maintenance-room-scanner-dialog" aria-labelledby="maintenance-room-scanner-title" aria-modal="true" role="dialog">
        <button className="maintenance-dialog-close" type="button" aria-label="Close room scanner" onClick={closeRoomScanner}><X size={18}/></button>
        <span className="maintenance-dialog-icon"><QrCode size={20}/></span>
        <h2 id="maintenance-room-scanner-title">Scan a non-demo room</h2>
        <p>Scan a supported campus QR code or enter a room code to look it up. This lookup does not create or modify room records.</p>

        {roomInventory.status === "loading" && <p role="status">Loading database rooms and buildings…</p>}
        {roomInventory.status === "error" && <p role="alert">{roomInventory.error}</p>}
        {roomInventory.status === "ready" && roomInventory.rooms.length === 0 && <p role="status">No verified room records are in the database. Add official room details through <Link className="maintenance-room-management-link" to="/rooms">Admin → Floors &amp; Rooms</Link> before matching a room. The scanner remains available, but scanned codes cannot match until a room record exists.</p>}
        <CampusQrScanner onScan={handleQrScan} label="Admin room QR scanner" />

        <form className="maintenance-manual-room-lookup" onSubmit={handleManualRoomLookup}>
          <label htmlFor="admin-room-code-lookup">Manual room-code lookup</label>
          <div><input id="admin-room-code-lookup" value={roomCodeInput} onChange={(event) => setRoomCodeInput(event.target.value)} placeholder="Enter an exact database room code" disabled={roomInventory.status !== "ready" || roomInventory.rooms.length === 0} /><button type="submit" disabled={roomInventory.status !== "ready" || roomInventory.rooms.length === 0}><Search size={15}/> Find room</button></div>
        </form>
        {scannerError && <p className="maintenance-qr-error" role="alert">{scannerError}</p>}

        {matchedRoom && <article className="maintenance-matched-room" aria-live="polite">
          <h3><Building2 size={17}/> Matched verified database room</h3>
          <dl>
            <div><dt>Room code</dt><dd>{matchedRoom.room_code}</dd></div>
            <div><dt>Room name</dt><dd>{matchedRoom.room_name || "Name unavailable"}</dd></div>
            <div><dt>Building</dt><dd>{matchedBuilding?.name || "Building unavailable"}{matchedBuilding?.building_code ? ` (${matchedBuilding.building_code})` : ""}</dd></div>
            <div><dt>Room ID</dt><dd>{matchedRoom.id}</dd></div>
          </dl>
          <button type="button" className="maintenance-new-button" onClick={chooseMatchedRoom}>Select this room</button>
        </article>}
      </section></div>}
    </div>
  );
}

export default Maintenance;
