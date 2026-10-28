import { useEffect, useState } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";
import { fetchAdminBookings, updateAdminBookingStatus } from "../../api/admin";
import { fetchRooms, fetchBuildings } from "../../api/buildings";
import "./RoomBooking.css";

function RoomBooking() {
  const [bookings, setBookings] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [roomNames, setRoomNames] = useState({ rooms: [], buildings: [] });

  useEffect(() => {
    let active = true;
    Promise.all([fetchAdminBookings(), fetchRooms(), fetchBuildings()]).then(([rows, rooms, buildings]) => { if (active) { setBookings(rows); setRoomNames({ rooms, buildings }); setStatus("ready"); setError(""); } })
      .catch((reason) => { if (active) { setStatus("error"); setError(reason.message); } });
    return () => { active = false; };
  }, [retryKey]);

  async function review(bookingId, nextStatus) {
    setBusyId(bookingId); setError(""); setMessage("");
    try {
      const updated = await updateAdminBookingStatus(bookingId, nextStatus);
      setBookings((items) => items.map((item) => item.id === bookingId ? updated : item));
      setMessage(`Booking #${bookingId} ${nextStatus.toLowerCase()}.`);
    } catch (reason) { setError(reason.message); }
    finally { setBusyId(null); }
  }

  return <div className="booking-page">
    <header className="booking-heading"><h1>Room Booking</h1><p>Review database-backed booking requests submitted by students.</p></header>
    <div className="workspace-demo-note">Records shown here are stored in the booking database. Admins may approve or reject pending requests. Source is marked per record; availability is not inferred from an empty booking list.</div>
    {status === "loading" && <p role="status">Loading booking records…</p>}
    {status === "error" && <div role="alert"><span>{error}</span><button type="button" onClick={() => setRetryKey((key) => key + 1)}><RefreshCw size={15} /> Retry</button></div>}
    {message && <p role="status">{message}</p>}
    {status === "ready" && bookings.length === 0 && <div className="booking-no-rooms"><CalendarDays size={26}/><strong>No booking records</strong><span>No student booking requests have been recorded.</span></div>}
    {status === "ready" && bookings.length > 0 && <div className="booking-content-grid"><section className="booking-results"><div className="booking-room-grid">{bookings.map((booking) => <article className="booking-room-card" key={booking.id}>
      <div className="booking-room-card-top"><strong>{booking.room_code}{booking.is_demo && <small> · DEMO ONLY</small>}</strong><span className="booking-room-available">{booking.status}</span></div>
      <p className="booking-room-building">{booking.room_name || roomNames.rooms.find((room) => room.id === booking.room_id)?.room_name || booking.room_code} · {roomNames.buildings.find((building) => building.building_code === booking.building_code)?.name || booking.building_code || "Building unavailable"}</p><p>{booking.purpose}</p>
      <p>{new Date(booking.start_time).toLocaleString()} – {new Date(booking.end_time).toLocaleString()}</p><small>Student user #{booking.user_id} · {booking.source}</small>
      {booking.status.toUpperCase() === "PENDING" && <div className="admin-booking-actions"><button type="button" disabled={busyId === booking.id} onClick={() => review(booking.id, "APPROVED")}>Approve</button><button type="button" disabled={busyId === booking.id} onClick={() => review(booking.id, "REJECTED")}>Reject</button></div>}
    </article>)}</div></section></div>}
  </div>;
}

export default RoomBooking;
