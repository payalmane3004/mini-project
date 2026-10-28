import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, QrCode, RefreshCw, ShieldCheck } from "lucide-react";
import CampusQrScanner from "../../components/CampusQrScanner";
import { fetchBuildings, fetchRooms } from "../../api/buildings";
import { filterOperationalRooms, isDemoRoom } from "../../api/demoData.js";
import { fetchDemoModeStatus } from "../../api/demoMode.js";
import { findVerifiedRoomByCode, maintenanceRequestPathForRoomCode, parseCampusRoomQrPayload } from "../../api/roomQr.js";

function StudentQRComplaint() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roomError, setRoomError] = useState("");
  const [buildingError, setBuildingError] = useState("");
  const [scanError, setScanError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [scannerKey, setScannerKey] = useState(0);
  const [manualRoomCode, setManualRoomCode] = useState("");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [scanComplete, setScanComplete] = useState(false);
  const [selectionSource, setSelectionSource] = useState("");

  useEffect(() => {
    let active = true;
    Promise.allSettled([fetchRooms(), fetchBuildings(), fetchDemoModeStatus()]).then(([roomResult, buildingResult, demoResult]) => {
      if (!active) return;
      if (roomResult.status === "fulfilled") {
        setRooms(roomResult.value);
        setRoomError("");
      } else {
        setRoomError(roomResult.reason?.message || "Could not load verified room records.");
      }
      if (buildingResult.status === "fulfilled") {
        setBuildings(buildingResult.value);
        setBuildingError("");
      } else {
        setBuildingError(buildingResult.reason?.message || "Building names are unavailable.");
      }
      setDemoMode(demoResult.status === "fulfilled" && demoResult.value === true);
      setLoading(false);
    });
    return () => { active = false; };
  }, [retryKey]);

  const buildingById = useMemo(() => new Map(buildings.map((building) => [building.id, building.name])), [buildings]);
  const eligibleRooms = useMemo(() => demoMode ? rooms : filterOperationalRooms(rooms), [demoMode, rooms]);

  function validateScan(decodedText) {
    const parsed = parseCampusRoomQrPayload(decodedText);
    if (!parsed.ok) {
      setScanError(parsed.error);
      return false;
    }
    const room = findVerifiedRoomByCode(rooms, parsed.roomCode, { allowDemo: demoMode });
    if (!room) {
      const existing = findVerifiedRoomByCode(rooms, parsed.roomCode, { allowDemo: true });
      setScanError(existing && isDemoRoom(existing) ? `Room code ${parsed.roomCode} is demo-only and unavailable outside the approved local demo.` : `Room code ${parsed.roomCode} was not found in the authenticated room directory.`);
      return false;
    }
    setSelectedRoom(room);
    setSelectionSource("qr");
    setScanError("");
    return true;
  }

  function handleManualLookup(event) {
    event.preventDefault();
    const room = findVerifiedRoomByCode(rooms, manualRoomCode, { allowDemo: demoMode });
    if (!room) {
      setSelectedRoom(null);
      setScanComplete(false);
      setSelectionSource("");
      const existing = findVerifiedRoomByCode(rooms, manualRoomCode, { allowDemo: true });
      setScanError(existing && isDemoRoom(existing) ? `Room code ${manualRoomCode.trim()} is demo-only and unavailable outside the approved local demo.` : `Room code ${manualRoomCode.trim() || "(empty)"} was not found in the authenticated room directory.`);
      return;
    }
    setSelectedRoom(room);
    setScanComplete(true);
    setSelectionSource("manual");
    setScanError("");
  }

  function openMaintenanceForm() {
    if (!selectedRoom) return;
    navigate(maintenanceRequestPathForRoomCode(selectedRoom.room_code));
  }

  function scanAnotherRoom() {
    setSelectedRoom(null);
    setScanComplete(false);
    setSelectionSource("");
    setManualRoomCode("");
    setScanError("");
    setScannerKey((key) => key + 1);
  }

  return (
    <div className="student-maintenance-page">
      <div className="student-page-header">
        <div>
          <p className="page-label">{demoMode ? "LOCAL DEMO · ROOM LOOKUP" : "QUICK REPORT"}</p>
          <h1>QR Complaint</h1>
          <p>Scan a room QR code, or enter its code manually, to verify the room before opening the existing issue form.</p>
        </div>
      </div>

      <section className="maintenance-form-card">
        <div className="student-panel-header">
          <div>
            <h2>Scan Campus Room QR Code</h2>
            <p>Supported formats: <code>SCAMPUS:ROOM:&lt;room-code&gt;</code> or an HTTP(S) campus link containing <code>?location=&lt;room-code&gt;</code> or <code>?room=&lt;room-code&gt;</code>.</p>
          </div>
          <QrCode size={28} />
        </div>

        {loading && <p role="status">Loading verified rooms…</p>}
        {!loading && roomError && <div role="alert" className="maintenance-room-empty">
          <strong>Room verification is unavailable.</strong>
          <p>{roomError} Scanned or manually entered room codes cannot be verified until the room directory is available.</p>
          <button type="button" onClick={() => { setLoading(true); setRoomError(""); setRetryKey((key) => key + 1); }}><RefreshCw size={15} /> Retry room lookup</button>
        </div>}
        {!loading && !roomError && eligibleRooms.length === 0 && <div role="status" className="maintenance-room-empty">
          <strong>No eligible room records are available.</strong>
          <p>{demoMode ? "The authenticated room directory contains no rooms for this local demo." : "An administrator must confirm official room details and add them in Admin → Floors & Rooms. Demo-only rooms are available only in the approved local demo."}</p>
        </div>}
        {!loading && !roomError && eligibleRooms.length > 0 && !selectedRoom && <CampusQrScanner key={scannerKey} onScan={validateScan} onAccepted={() => setScanComplete(true)} onDuplicate={() => setScanError("This QR was already recognized. Continue with the confirmed room or choose Scan another code.")} />}

        {!loading && !roomError && !selectedRoom && <form className="maintenance-qr-manual-form" onSubmit={handleManualLookup}>
          <label htmlFor="maintenance-qr-room-code">Or enter the room code manually</label>
          <div>
            <input id="maintenance-qr-room-code" value={manualRoomCode} onChange={(event) => setManualRoomCode(event.target.value)} maxLength={30} autoComplete="off" required disabled={eligibleRooms.length === 0} />
            <button type="submit" className="secondary-student-button" disabled={eligibleRooms.length === 0}>Find room</button>
          </div>
          {buildingError && <small role="status">{buildingError} The room code can still be verified; the issue form will show the building if available.</small>}
        </form>}
        {scanError && <p className="maintenance-qr-error" role="alert">{scanError}</p>}

        {selectedRoom && <section className="maintenance-qr-result" aria-live="polite">
          <CheckCircle2 size={20} aria-hidden="true" />
          <div className="maintenance-qr-result-copy">
            <strong>{selectionSource === "qr" && scanComplete ? "Room QR recognized" : selectionSource === "manual" ? "Room found by code" : "Checking scanned room…"}</strong>
            {isDemoRoom(selectedRoom) && <small className="maintenance-qr-demo-label">DEMO ONLY - local preview inventory; not verified operational inventory</small>}
            <p>{selectedRoom.room_name ? `${selectedRoom.room_name} · ` : ""}{selectedRoom.room_code} · {buildingById.get(selectedRoom.building_id) || `Building ID ${selectedRoom.building_id}`} · Floor {selectedRoom.floor_number}</p>
          </div>
          <button type="button" className="primary-student-button" onClick={openMaintenanceForm}>Continue to Report an Issue</button>
          <button type="button" className="secondary-student-button" onClick={scanAnotherRoom}>Scan another code</button>
        </section>}

        <div className="maintenance-qr-guidance">
          <ShieldCheck size={22} />
          <p>A matched room is checked against the authenticated room directory. Demo-only rooms are available only in the approved local demo and remain visibly labelled. No maintenance request is created until you submit the existing issue form.</p>
        </div>

        <button type="button" className="secondary-student-button" onClick={() => navigate("/student-dashboard")} style={{ marginTop: 20 }}>
          <ArrowLeft size={18} /> Back to Dashboard
        </button>
      </section>
    </div>
  );
}

export default StudentQRComplaint;
