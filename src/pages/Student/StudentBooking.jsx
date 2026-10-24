import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, MapPin, RefreshCw, XCircle } from "lucide-react";
import { fetchBuildings, fetchRooms } from "../../api/buildings";
import { cancelMyBooking, createMyBooking, fetchMyBookings } from "../../api/student";

const emptyForm = { room_id: "", start_time: "", end_time: "", purpose: "" };

function StudentBooking() {
  const [buildings, setBuildings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([fetchBuildings(), fetchRooms(), fetchMyBookings()]).then(([buildingRows, roomRows, bookingRows]) => {
      if (!active) return;
      setBuildings(buildingRows);
      setRooms(roomRows);
      setBookings(bookingRows);
      setForm((current) => ({ ...current, room_id: current.room_id || String(roomRows[0]?.id || "") }));
      setStatus("ready");
      setError("");
    }).catch((reason) => {
      if (!active) return;
      setStatus("error");
      setError(reason.message);
    });
    return () => { active = false; };
  }, [retryKey]);

  const buildingById = useMemo(() => new Map(buildings.map((building) => [building.id, building.name])), [buildings]);

  async function submit(event) {
    event.preventDefault();
    setError(""); setMessage("");
    const start = new Date(form.start_time);
    const end = new Date(form.end_time);
    if (!form.room_id || !form.purpose.trim() || Number.isNaN(+start) || Number.isNaN(+end) || start <= new Date() || start >= end) {
      setError("Choose a verified room, a future start and end time, and enter a purpose.");
      return;
    }
    setBusy(true);
    try {
      const created = await createMyBooking({ room_id: Number(form.room_id), purpose: form.purpose.trim(), start_time: start.toISOString(), end_time: end.toISOString() });
      setBookings((current) => [...current, created].sort((a, b) => new Date(a.start_time) - new Date(b.start_time)));
      setForm((current) => ({ ...emptyForm, room_id: current.room_id }));
      setMessage("Booking request submitted. Its status is pending.");
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function cancel(bookingId) {
    setBusy(true); setError(""); setMessage("");
    try {
      await cancelMyBooking(bookingId);
      setBookings((current) => current.map((booking) => booking.id === bookingId ? { ...booking, status: "CANCELLED" } : booking));
      setMessage("Booking cancelled.");
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  return <div className="student-booking-page">
    <div className="student-page-header"><div><h1>Room Booking</h1><p>Submit a request for a room in the verified database inventory.</p></div></div>
    {status === "loading" && <p role="status">Loading room inventory and your bookings…</p>}
    {status === "error" && <div className="student-dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={() => setRetryKey((key) => key + 1)}><RefreshCw size={15} /> Retry</button></div>}
    {status === "ready" && <div className="student-booking-layout">
      <section className="booking-form-panel"><div className="booking-panel-heading"><div><h2>Request a room</h2><p>Requests are checked against existing bookings when submitted.</p></div></div>
        {rooms.length === 0 ? <div className="events-empty-state"><h3>Booking unavailable</h3><p>No verified rooms are currently in the database. Room booking will be available after the room inventory is confirmed and entered.</p></div> : <form onSubmit={submit}>
          <div className="booking-field"><label htmlFor="booking-room">Room</label><select id="booking-room" value={form.room_id} onChange={(event) => setForm({ ...form, room_id: event.target.value })}>{rooms.map((room) => <option key={room.id} value={room.id}>{room.room_code} · {buildingById.get(room.building_id) || "Building record"} · Floor {room.floor_number}</option>)}</select></div>
          <div className="booking-time-row"><div className="booking-field"><label htmlFor="booking-start">Start</label><input id="booking-start" type="datetime-local" required value={form.start_time} onChange={(event) => setForm({ ...form, start_time: event.target.value })} /></div><div className="booking-field"><label htmlFor="booking-end">End</label><input id="booking-end" type="datetime-local" required value={form.end_time} onChange={(event) => setForm({ ...form, end_time: event.target.value })} /></div></div>
          <div className="booking-field"><label htmlFor="booking-purpose">Purpose</label><textarea id="booking-purpose" maxLength={255} required value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} rows="3" /></div>
          <button className="booking-submit-button" type="submit" disabled={busy}> <CalendarDays size={17} /> Submit booking request</button>
        </form>}
      </section>
      <section className="my-bookings-panel"><div className="booking-panel-heading"><div><h2>My Bookings</h2><p>Bookings associated with your authenticated account.</p></div><span className="booking-total">{bookings.length} bookings</span></div>
        {bookings.length === 0 ? <div className="events-empty-state"><CalendarDays size={28} /><h3>No bookings yet</h3><p>Submitted requests will appear here.</p></div> : <div className="student-bookings-list">{bookings.map((booking) => <article className="student-booking-card" key={booking.id}>
          <div className="booking-card-top"><div><span className="booking-id">#{booking.id}</span><h3>{booking.room_code}</h3></div><span className={`booking-status ${booking.status.toLowerCase()}`}>{booking.status}</span></div>
          <div className="booking-card-info"><div><CalendarDays size={15} />{new Date(booking.start_time).toLocaleDateString()}</div><div><Clock size={15} />{new Date(booking.start_time).toLocaleTimeString()} – {new Date(booking.end_time).toLocaleTimeString()}</div><div><MapPin size={15} />{booking.building_code || "Building unavailable"}</div></div>
          <p className="booking-purpose">{booking.purpose}</p>
          {["PENDING", "APPROVED"].includes(booking.status.toUpperCase()) && <button className="cancel-booking-button" type="button" disabled={busy} onClick={() => cancel(booking.id)}><XCircle size={15} /> Cancel booking</button>}
        </article>)}</div>}
      </section>
    </div>}
    {(error || message) && <p className={error ? "student-dashboard-error" : "student-success-message"} role={error ? "alert" : "status"}>{error || message}</p>}
  </div>;
}

export default StudentBooking;
