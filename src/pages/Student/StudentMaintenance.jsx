import { useEffect, useRef, useState } from "react";
import {
  ClipboardList,
  Plus,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Wrench,
  QrCode,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchBuildings, fetchRooms } from "../../api/buildings";
import { fetchDemoModeStatus } from "../../api/demoMode.js";
import { createMyMaintenanceRequest, fetchMyMaintenanceRequests } from "../../api/maintenance";
import { isNewMaintenanceRequestSearch, maintenanceRoomCodeFromSearch, maintenanceRoomPrefillFromSearch } from "../../api/roomQr.js";
import { filterOperationalRooms } from "../../api/demoData.js";
import { useDemoMode } from "../../components/layout/useDemoMode";

function statusLabel(status) {
  return ({ OPEN: "Open", IN_PROGRESS: "In Progress", RESOLVED: "Resolved" })[status] || status;
}

function formatTimestamp(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

function StudentMaintenance() {
  const contextDemoMode = useDemoMode();
  const [verifiedDemoMode, setVerifiedDemoMode] = useState(null);
  const demoMode = verifiedDemoMode ?? contextDemoMode;
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [requestsState, setRequestsState] = useState("loading");
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState("");
  const [buildingsError, setBuildingsError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [showForm, setShowForm] = useState(() => (
    isNewMaintenanceRequestSearch(window.location.search)
  ));

  const [formData, setFormData] = useState(() => {
    return {
      title: "",
      building_id: "",
      location: maintenanceRoomCodeFromSearch(window.location.search),
      description: "",
      priority: "Medium",
    };
  });

  useEffect(() => {
    let active = true;
    Promise.allSettled([fetchMyMaintenanceRequests(), fetchRooms(), fetchBuildings(), fetchDemoModeStatus()]).then(([requestResult, roomResult, buildingResult, demoResult]) => {
      if (!active) return;
      setVerifiedDemoMode(demoResult.status === "fulfilled" && demoResult.value === true);
      if (requestResult.status === "fulfilled") {
        setRequests(requestResult.value);
        setRequestsState("ready");
        setLoadError("");
      } else {
        setRequestsState("error");
        setLoadError(requestResult.reason?.message || "Could not load your maintenance requests.");
      }
      if (roomResult.status === "fulfilled") {
        setRooms(roomResult.value);
        setRoomsError("");
        setFormData((current) => {
          const scannedRoom = maintenanceRoomPrefillFromSearch(window.location.search, roomResult.value, { allowDemo: demoResult.status === "fulfilled" && demoResult.value === true });
          if (scannedRoom) {
            return { ...current, location: scannedRoom.roomCode, building_id: String(scannedRoom.buildingId) };
          }
          const selectedRoom = roomResult.value.find(({ room_code }) => room_code === current.location);
          return selectedRoom ? { ...current, building_id: String(selectedRoom.building_id) } : current;
        });
      } else {
        setRoomsError(roomResult.reason?.message || "Could not load eligible rooms.");
      }
      if (buildingResult.status === "fulfilled") {
        setBuildings(buildingResult.value);
        setBuildingsError("");
      } else {
        setBuildingsError(buildingResult.reason?.message || "Could not load buildings.");
      }
      setRoomsLoading(false);
    });
    return () => { active = false; };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
      ...(name === "building_id" ? { location: "" } : {}),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!formData.title.trim() || !formData.description.trim()) {
      setSubmitError("Enter a title and description for the issue.");
      setSubmitSuccess("");
      return;
    }
    const room = operationalRooms.find(({ room_code }) => room_code === formData.location);
    if (!room || String(room.building_id) !== formData.building_id) {
      setSubmitError("Choose a building and a room from that building. Demo-only room records cannot be used outside the isolated local demo.");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");
    try {
      const created = await createMyMaintenanceRequest({
        room_id: room.id,
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority.toUpperCase(),
      });
      setRequests((current) => [created, ...current]);
      setRequestsState("ready");
      setFormData({ title: "", building_id: "", location: "", description: "", priority: "Medium" });
      setShowForm(false);
      setSubmitSuccess("Your maintenance request was submitted.");
    } catch (error) {
      setSubmitError(error.message || "Could not submit your maintenance request.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const inProgressCount = requests.filter(({ status }) => status === "IN_PROGRESS").length;
  const resolvedCount = requests.filter(({ status }) => status === "RESOLVED").length;
  const operationalRooms = demoMode ? rooms : filterOperationalRooms(rooms);
  const operationalBuildings = buildings.filter((building) => operationalRooms.some(
    (room) => room.building_id === building.id,
  ));
  const selectedBuildingRooms = operationalRooms.filter(
    (room) => String(room.building_id) === formData.building_id,
  );

  return (
    <div className="student-maintenance-page">
      <div className="student-page-header">
        <div>
          <p className="page-label">MAINTENANCE</p>
          <h1>Maintenance & Complaints</h1>
          <p>
            Report campus issues and track your maintenance requests.
          </p>
        </div>

        <div className="student-maintenance-header-actions">
          <button
            type="button"
            className="secondary-student-button student-scan-room-button"
            onClick={() => navigate("/student-qr-complaint")}
          >
            <QrCode size={18} />
            Scan Room QR
          </button>
          <button
            type="button"
            className="primary-student-button"
            aria-expanded={showForm}
            aria-controls="student-maintenance-report-form"
            onClick={() => setShowForm((visible) => !visible)}
          >
            <Plus size={18} />
            Report an Issue
          </button>
        </div>
      </div>

      {showForm && (
        <section className="maintenance-form-card" id="student-maintenance-report-form" aria-labelledby="student-maintenance-report-heading">
          <div className="student-panel-header">
            <div>
              <h2 id="student-maintenance-report-heading">Report a New Issue</h2>
              <p>Provide details about the problem.</p>
            </div>

            <Wrench size={20} />
          </div>

          <form onSubmit={handleSubmit}>
            <div className="maintenance-form-grid">
              <div className="form-group">
                <label htmlFor="maintenance-title">Issue Title</label>

                <input
                  type="text"
                  id="maintenance-title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. AC not working"
                  required
                  maxLength={150}
                />
              </div>

              <div className="form-group">
                <label htmlFor="maintenance-building">Building</label>
                <select
                  id="maintenance-building"
                  name="building_id"
                  value={formData.building_id}
                  onChange={handleChange}
                  required
                  disabled={roomsLoading || operationalBuildings.length === 0}
                >
                  <option value="">{roomsLoading ? "Loading buildings…" : "Choose a building"}</option>
                  {operationalBuildings.map((building) => <option value={building.id} key={building.id}>
                    {building.is_demo ? "DEMO ONLY · " : ""}{building.name} ({building.building_code})
                  </option>)}
                </select>
                {buildingsError && <small role="alert">{buildingsError}</small>}
              </div>

              <div className="form-group">
                <label htmlFor="maintenance-location">Room</label>

                <select
                  id="maintenance-location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  required
                  disabled={roomsLoading || selectedBuildingRooms.length === 0}
                >
                  <option value="">{roomsLoading ? "Loading rooms…" : roomsError ? "Rooms unavailable" : selectedBuildingRooms.length ? "Choose a room" : "Choose a building first"}</option>
                  {selectedBuildingRooms.map((room) => <option value={room.room_code} key={room.id}>{demoMode && room.room_code.toUpperCase().startsWith("DEMO-") ? "DEMO ONLY · " : ""}{room.room_code}{room.room_name ? ` · ${room.room_name}` : ""}</option>)}
                </select>
                {roomsLoading && <small role="status">Loading campus room records…</small>}
                {!roomsLoading && !roomsError && operationalRooms.length === 0 && <small role="status">No eligible rooms are available. Demo-only room records cannot be used for maintenance requests outside the isolated local demo.</small>}
                {!roomsLoading && !roomsError && operationalRooms.length > 0 && operationalRooms.length < rooms.length && <small>Demo-only rooms are excluded from maintenance requests outside the isolated local demo.</small>}
                {demoMode && <small>LOCAL DEMO: any DEMO-only request is fictional and stored only in this isolated SQLite database.</small>}
                {roomsError && <small role="alert">{roomsError}</small>}
                {formData.location && !operationalRooms.some(({ room_code }) => room_code === formData.location) && !roomsError && <small role="alert">The selected location is not eligible. Choose another room before submitting.</small>}
              </div>

              <div className="form-group">
                <label htmlFor="maintenance-priority">Priority</label>

                <select
                  id="maintenance-priority"
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div className="form-group full-width">
                <label htmlFor="maintenance-description">Description</label>

                <textarea
                  id="maintenance-description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe the issue..."
                  rows="5"
                  required
                  maxLength={5000}
                />
              </div>
            </div>

            {submitError && <p role="alert">{submitError}</p>}

            <div className="form-actions">
              <button
                type="button"
                className="secondary-student-button"
                onClick={() => { setShowForm(false); setSubmitError(""); }}
                disabled={submitting}
              >
                Cancel
              </button>

              <button type="submit" className="primary-student-button" disabled={submitting || operationalRooms.length === 0}>
                {submitting ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </form>
        </section>
      )}

      {submitSuccess && <p role="status">{submitSuccess}</p>}
      {loadError && <div role="alert"><p>{loadError}</p><button type="button" onClick={() => window.location.reload()}>Retry</button></div>}

      <section className="maintenance-summary">
        <div className="maintenance-summary-card">
          <ClipboardList size={20} />
          <div>
            <span>Total Requests</span>
            <strong>{requestsState === "loading" ? "…" : requests.length}</strong>
          </div>
        </div>

        <div className="maintenance-summary-card">
          <Clock size={20} />
          <div>
            <span>In Progress</span>
            <strong>{requestsState === "loading" ? "…" : inProgressCount}</strong>
          </div>
        </div>

        <div className="maintenance-summary-card">
          <CheckCircle2 size={20} />
          <div>
            <span>Resolved</span>
            <strong>{requestsState === "loading" ? "…" : resolvedCount}</strong>
          </div>
        </div>
      </section>

      <section className="maintenance-requests">
        <div className="student-panel-header">
          <div>
            <h2>My Maintenance Requests</h2>
            <p>Track the issues you have reported.</p>
          </div>
        </div>

        <div className="maintenance-request-list">
          {requestsState === "loading" && <p role="status">Loading your maintenance requests…</p>}
          {requestsState === "error" && <p role="status">Your saved requests are unavailable until the API can be reached.</p>}
          {requestsState === "ready" && requests.length === 0 && <p role="status">No maintenance requests have been submitted.</p>}
          {requestsState === "ready" && requests.map((request) => (
            <div className="maintenance-request-card" key={request.id}>
              <div className="maintenance-request-top">
                <div>
                  <span className="request-id">Request #{request.id}</span>
                  <h3>{request.title}{request.is_demo && <small> · DEMO ONLY · fictional</small>}</h3>
                </div>

                <span
                  className={`request-status ${request.status.toLowerCase().replaceAll("_", "-")}`}
                >
                  {statusLabel(request.status)}
                </span>
              </div>

              <p>{request.description}</p>

              <div className="maintenance-request-meta">
                <span>
                  <MapPin size={15} />
                  {request.room_code}{request.building_name ? ` · ${request.building_name}` : ""}
                </span>

                <span>
                  <AlertCircle size={15} />
                  {request.priority.toLowerCase()}
                </span>

                <span>
                  <Clock size={15} />
                  {formatTimestamp(request.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default StudentMaintenance;
