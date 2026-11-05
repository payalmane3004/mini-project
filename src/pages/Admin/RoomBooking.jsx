import { useEffect, useState } from "react";
import { CalendarDays, Clock3, RefreshCw } from "lucide-react";
import { fetchAdminBookings, updateAdminBookingStatus } from "../../api/admin";
import { fetchRooms, fetchBuildings } from "../../api/buildings";
import { useDemoMode } from "../../components/layout/useDemoMode.js";
import "./RoomBooking.css";

const BOOKING_FILTERS = ["All", "Pending", "Approved", "Rejected", "Cancelled"];

function statusLabel(status) {
  return status ? `${status[0]}${status.slice(1).toLowerCase()}` : "Unknown";
}

function bookingDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function bookingTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function roomLabel(roomName, roomCode) {
  const code = String(roomCode || "");
  const aliases = {
    "Sample classroom": "Classroom",
    "Sample computer lab": "Computer Laboratory",
    "Sample seminar room": "Seminar Room",
    "Sample study and meeting room": "Student Discussion Room",
  };
  const normalized = aliases[String(roomName || "")] || roomName;
  return normalized || (/^DEMO-/i.test(code) ? "Campus room" : "Room name unavailable");
}

function roomNumberLabel(roomCode) {
  const code = String(roomCode || "");
  if (!/^DEMO-/i.test(code)) return code || "Room number unavailable";
  const number = code.match(/ROOM-(\d+)/i)?.[1];
  return number ? `Room ${number}` : "Room number unavailable";
}

function RoomBooking() {
  const demoMode = useDemoMode();
  const [bookings, setBookings] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [filter, setFilter] = useState("All");
  const [roomNames, setRoomNames] = useState({ rooms: [], buildings: [] });
  const [rejecting, setRejecting] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    let active = true;
    const refresh = async (initial = false) => {
      if (document.visibilityState === "hidden") return;
      const [bookingResult, roomResult, buildingResult] = await Promise.allSettled([
        fetchAdminBookings(), fetchRooms(), fetchBuildings(),
      ]);
      if (!active) return;

      if (bookingResult.status === "fulfilled") {
        setBookings(bookingResult.value);
        setStatus("ready");
        setError("");
      } else if (initial) {
        setStatus("error");
        setError(bookingResult.reason?.message || "Could not load bookings.");
      } else {
        setError(`Could not refresh bookings: ${bookingResult.reason?.message || "Request failed."}`);
      }

      const resourceErrors = [roomResult, buildingResult]
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason?.message || "Request failed.");
      if (roomResult.status === "fulfilled" || buildingResult.status === "fulfilled") {
        setRoomNames((current) => ({
          rooms: roomResult.status === "fulfilled" ? roomResult.value : current.rooms,
          buildings: buildingResult.status === "fulfilled" ? buildingResult.value : current.buildings,
        }));
      }
      if (bookingResult.status === "fulfilled" && resourceErrors.length) {
        setError(`Bookings loaded, but room details could not refresh: ${resourceErrors.join(" ")}`);
      }
    };
    const refreshVisible = () => { void refresh(); };
    void refresh(true);
    const interval = window.setInterval(refreshVisible, 30_000);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [retryKey]);

  async function review(bookingId, nextStatus, reason = "") {
    setBusyId(bookingId); setError(""); setMessage("");
    try {
      const updated = await updateAdminBookingStatus(bookingId, nextStatus, reason);
      if (updated?.id === bookingId) {
        setBookings((current) => current.map((booking) => booking.id === bookingId ? updated : booking));
      } else {
        setBookings((current) => current.map((booking) => booking.id === bookingId
          ? { ...booking, status: nextStatus, rejection_reason: nextStatus === "REJECTED" ? reason.trim() : null }
          : booking));
      }
      setRejecting(null); setRejectionReason("");
      setMessage(`Booking ${nextStatus.toLowerCase()}.`);
      try {
        const refreshed = await fetchAdminBookings();
        setBookings(refreshed);
      } catch (refreshError) {
        setError(`Booking ${nextStatus.toLowerCase()}, but the admin list could not refresh: ${refreshError.message}`);
      }
    } catch (reason) { setError(reason.message); }
    finally { setBusyId(null); }
  }

  const visibleBookings = bookings.filter((booking) => filter === "All" || statusLabel(booking.status).toLowerCase() === filter.toLowerCase());
  const roomById = new Map(roomNames.rooms.map((room) => [room.id, room]));
  const buildingByCode = new Map(roomNames.buildings.map((building) => [building.building_code, building]));

  return <div className="booking-page">
    <header className="booking-heading"><div><h1>Room Booking</h1><p>Review and manage campus room reservations.</p></div><button className="booking-refresh" type="button" onClick={() => setRetryKey((key) => key + 1)} disabled={status === "loading"}><RefreshCw size={15}/> Refresh</button></header>
    {status === "loading" && <p role="status">Loading booking records…</p>}
    {status === "error" && <div role="alert"><span>{error}</span><button type="button" onClick={() => setRetryKey((key) => key + 1)}><RefreshCw size={15} /> Retry</button></div>}
    {message && <p role="status">{message}</p>}
    {status === "ready" && bookings.length === 0 && <div className="booking-no-rooms"><CalendarDays size={26}/><strong>No booking records</strong><span>No student booking requests have been recorded.</span></div>}
    {status === "ready" && bookings.length > 0 && <>
      <nav className="booking-status-filters" aria-label="Filter bookings by status">{BOOKING_FILTERS.map((item) => <button type="button" key={item} aria-pressed={filter === item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}<span>{item === "All" ? bookings.length : bookings.filter((booking) => statusLabel(booking.status).toLowerCase() === item.toLowerCase()).length}</span></button>)}</nav>
      {visibleBookings.length === 0 ? <div className="booking-no-rooms"><CalendarDays size={26}/><strong>No {filter.toLowerCase()} bookings</strong><span>There are no reservations in this status.</span></div> : <section className="booking-room-grid" aria-label={`${filter} bookings`}>
        {visibleBookings.map((booking) => {
          const room = roomById.get(booking.room_id);
          const building = buildingByCode.get(booking.building_code) || roomNames.buildings.find(({ id }) => id === room?.building_id);
          const displayStatus = statusLabel(booking.status);
          const title = booking.purpose.replace(/^DEMO\s*[|·:-]?\s*/i, "");
          const displayRoom = roomLabel(booking.room_name || room?.room_name, booking.room_code);
          const canReview = booking.status.toUpperCase() === "PENDING" && (!booking.is_demo || demoMode);
          return <article className="booking-room-card" key={booking.id}>
            <div className="booking-room-card-top"><div className="booking-room-title"><h2>{title}</h2><span>{displayRoom} <span aria-hidden="true">·</span> {roomNumberLabel(booking.room_code)}</span></div><span className={`booking-status-badge status-${displayStatus.toLowerCase()}`}>{displayStatus}</span></div>
            <p className="booking-room-building">{building?.name || "Building unavailable"}</p>
            <div className="booking-card-details"><div><CalendarDays size={16}/><span><small>Booking date</small><strong>{bookingDate(booking.start_time)}</strong></span></div><div><Clock3 size={16}/><span><small>Time</small><strong>{bookingTime(booking.start_time)} – {bookingTime(booking.end_time)}</strong></span></div><div><span className="booking-requester-avatar" aria-hidden="true">{(booking.requester_name || "U").trim().charAt(0).toUpperCase()}</span><span><small>Requester</small><strong>{booking.requester_name || "Account unavailable"}</strong></span></div></div>
            {canReview && <div className="admin-booking-actions"><button type="button" disabled={busyId === booking.id} onClick={() => review(booking.id, "APPROVED")}>Approve</button><button type="button" disabled={busyId === booking.id} onClick={() => { setRejecting(booking.id); setRejectionReason(""); }}>Reject</button></div>}
            {booking.status.toUpperCase() === "REJECTED" && booking.rejection_reason && <p>Reason: {booking.rejection_reason}</p>}
          </article>;
        })}
      </section>}
    </>}
    {rejecting != null && <div className="booking-review-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-rejection-title"><h2 id="booking-rejection-title">Reject booking</h2><label htmlFor="booking-rejection-reason">Reason</label><textarea id="booking-rejection-reason" maxLength={1000} required value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} /><button type="button" disabled={!rejectionReason.trim() || busyId === rejecting} onClick={() => review(rejecting, "REJECTED", rejectionReason)}>Confirm rejection</button><button type="button" onClick={() => setRejecting(null)}>Cancel</button></div>}
  </div>;
}

export default RoomBooking;
