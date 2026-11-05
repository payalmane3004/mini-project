import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, MapPin, RefreshCw, XCircle } from "lucide-react";
import { fetchBuildings, fetchRooms } from "../../api/buildings";
import { cancelMyBooking, checkBookingAvailability, createMyBooking, fetchMyBookings } from "../../api/student";
import { getBookableRooms, reconcileBookableRoomId, validateBookingForm } from "../../api/bookingEligibility.js";
import { useDemoMode } from "../../components/layout/useDemoMode";
import { availabilityFailureMessage, bookingFailureMessage } from "./bookingErrors.js";

const emptyForm = { room_id: "", start_time: "", end_time: "", purpose: "" };

function StudentBooking() {
  const demoMode = useDemoMode();
  const [buildings, setBuildings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [buildingId, setBuildingId] = useState("");
  const [availabilityResult, setAvailabilityResult] = useState({ key: "", state: "idle", error: "" });
  const [availabilityRefreshKey, setAvailabilityRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.allSettled([fetchBuildings(), fetchRooms(), fetchMyBookings()]).then((results) => {
      if (!active) return;
      const setters = [setBuildings, setRooms, setBookings];
      const labels = ["Buildings (/buildings)", "Rooms (/rooms)", "My Bookings (/bookings)"];
      let loaded = 0;
      const failures = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          setters[index](result.value);
          loaded += 1;
        } else {
          failures.push(`${labels[index]}: ${result.reason?.message || "Request failed."}`);
        }
      });
      setStatus(loaded ? "ready" : "error");
      setError(failures.join(" "));
    });
    return () => { active = false; };
  }, [retryKey]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const latestBookings = await fetchMyBookings();
        if (active) setBookings(latestBookings);
      } catch (reason) {
        if (active) setError(`Could not refresh your bookings: ${reason.message}`);
      }
      if (active) setAvailabilityRefreshKey((key) => key + 1);
    };
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const eligibleRooms = useMemo(() => getBookableRooms(rooms, demoMode), [rooms, demoMode]);
  const bookableRooms = useMemo(() => eligibleRooms.filter((room) => buildingId && String(room.building_id) === buildingId), [eligibleRooms, buildingId]);
  const selectedRoomId = reconcileBookableRoomId(form.room_id, bookableRooms);
  const start = form.start_time ? new Date(form.start_time) : null;
  const end = form.end_time ? new Date(form.end_time) : null;
  const validAvailabilityRange = Boolean(
    selectedRoomId && start && end
      && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())
      && start > new Date() && start < end,
  );
  const availabilityStartTime = validAvailabilityRange ? start.toISOString() : "";
  const availabilityEndTime = validAvailabilityRange ? end.toISOString() : "";
  const availabilityKey = validAvailabilityRange
    ? `${selectedRoomId}|${availabilityStartTime}|${availabilityEndTime}|${availabilityRefreshKey}`
    : "";
  const availability = availabilityKey
    ? availabilityResult.key === availabilityKey ? availabilityResult.state : "checking"
    : "idle";
  const availabilityError = availability === "error" ? availabilityResult.error : "";

  useEffect(() => {
    if (!availabilityKey) return undefined;

    let active = true;
    const timer = window.setTimeout(() => {
      checkBookingAvailability({ room_id: Number(selectedRoomId), start_time: availabilityStartTime, end_time: availabilityEndTime })
        .then((available) => {
          if (active) setAvailabilityResult({ key: availabilityKey, state: available ? "available" : "unavailable", error: "" });
        })
        .catch((reason) => {
          if (active) setAvailabilityResult({ key: availabilityKey, state: "error", error: availabilityFailureMessage(reason) });
        });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [availabilityKey, availabilityStartTime, availabilityEndTime, selectedRoomId]);

  async function submit(event) {
    event.preventDefault();
    setError(""); setMessage("");
    const validationError = validateBookingForm({ ...form, room_id: selectedRoomId }, bookableRooms);
    if (validationError) { setError(validationError); return; }
    setBusy(true);
    let availabilityChecked = false;
    try {
      const available = await checkBookingAvailability({ room_id: Number(selectedRoomId), start_time: start.toISOString(), end_time: end.toISOString() });
      availabilityChecked = true;
      if (!available) {
        setAvailabilityResult({ key: availabilityKey, state: "unavailable", error: "" });
        setError("This room is unavailable for the selected time. Please choose another time.");
        return;
      }
      setAvailabilityResult({ key: availabilityKey, state: "available", error: "" });
      const created = await createMyBooking({ room_id: Number(selectedRoomId), purpose: form.purpose.trim(), start_time: start.toISOString(), end_time: end.toISOString() });
      setBookings((current) => [...current.filter((booking) => booking.id !== created.id), created].sort((a, b) => new Date(a.start_time) - new Date(b.start_time)));
      setForm((current) => ({ ...emptyForm, room_id: current.room_id }));
      setMessage("Booking request submitted. Its status is pending.");
      try {
        setBookings(await fetchMyBookings());
      } catch (refreshError) {
        setError(`The booking was submitted, but My Bookings could not refresh: ${refreshError.message}`);
      }
    } catch (reason) {
      if (!availabilityChecked) {
        const friendlyError = availabilityFailureMessage(reason);
        setAvailabilityResult({ key: availabilityKey, state: "error", error: friendlyError });
        setError(friendlyError);
      } else if (reason.status === 409) {
        setAvailabilityResult({ key: availabilityKey, state: "unavailable", error: "" });
        setError("This room is unavailable for the selected time. Please choose another time.");
      } else {
        setError(bookingFailureMessage(reason));
      }
    }
    finally { setBusy(false); }
  }

  async function cancel(bookingId) {
    setBusy(true); setError(""); setMessage("");
    try {
      await cancelMyBooking(bookingId);
      setBookings((current) => current.map((booking) => booking.id === bookingId ? { ...booking, status: "CANCELLED" } : booking));
      setMessage("Booking cancelled.");
      try {
        setBookings(await fetchMyBookings());
      } catch (refreshError) {
        setError(`Booking cancelled, but My Bookings could not refresh: ${refreshError.message}`);
      }
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  return <div className="student-booking-page">
    <div className="student-page-header"><div><h1>Room Booking</h1><p>Submit a request for an available campus room.</p></div></div>
    {status === "loading" && <p role="status">Loading room inventory and your bookings…</p>}
    {status === "ready" && <div className="student-booking-layout">
      <section className="booking-form-panel"><div className="booking-panel-heading"><div><h2>Request a room</h2><p>Requests are checked against existing bookings when submitted.</p></div></div>
        {eligibleRooms.length === 0 ? <div className="events-empty-state"><h3>Booking unavailable</h3><p>{demoMode ? "No rooms are present in the local dataset." : "No eligible room records are available. Local rooms can be booked only through the local dataset."}</p></div> : <form onSubmit={submit}>
          <div className="booking-field"><label htmlFor="booking-building">Building</label><select id="booking-building" required value={buildingId} onChange={(event) => { setBuildingId(event.target.value); setForm((current) => ({ ...current, room_id: "" })); }}><option value="">Choose a building</option>{buildings.filter((building) => eligibleRooms.some((room) => String(room.building_id) === String(building.id))).map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}</select></div>
          <div className="booking-field"><label htmlFor="booking-room">Room</label><select id="booking-room" required disabled={!buildingId} value={selectedRoomId} onChange={(event) => setForm((current) => ({ ...current, room_id: event.target.value }))}><option value="">Choose a room</option>{bookableRooms.map((room) => { const number = room.room_code.match(/ROOM-(\d+)/i)?.[1]; return <option key={room.id} value={room.id}>{number ? `Room ${number}` : room.room_code} · Floor {room.floor_number}</option>; })}</select></div>
          <div className="booking-time-row"><div className="booking-field"><label htmlFor="booking-start">Start</label><input id="booking-start" type="datetime-local" required value={form.start_time} onChange={(event) => setForm({ ...form, start_time: event.target.value })} /></div><div className="booking-field"><label htmlFor="booking-end">End</label><input id="booking-end" type="datetime-local" required value={form.end_time} onChange={(event) => setForm({ ...form, end_time: event.target.value })} /></div></div>
          <div className="booking-field"><label htmlFor="booking-purpose">Purpose</label><textarea id="booking-purpose" maxLength={255} required value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} rows="3" /></div>
          {availability === "checking" && <p role="status">Checking room availability…</p>}
          {availability === "available" && <p role="status">This room is available for the selected time.</p>}
          {availability === "unavailable" && <p role="alert">This room is unavailable for the selected time. Please choose another time.</p>}
          {availabilityError && <p role="alert">Could not check availability: {availabilityError}</p>}
          {availability === "error" && <button className="booking-retry-button" type="button" disabled={busy} onClick={() => setAvailabilityRefreshKey((key) => key + 1)}>Retry availability check</button>}
          <button className="booking-submit-button" type="submit" disabled={busy || availability === "checking" || availability === "unavailable" || availability === "error"}> <CalendarDays size={17} /> Submit booking request</button>
        </form>}
      </section>
      <section className="my-bookings-panel"><div className="booking-panel-heading"><div><h2>My Bookings</h2><p>Bookings associated with your authenticated account.</p></div><span className="booking-total">{bookings.length} bookings</span></div>
        {bookings.length === 0 ? <div className="events-empty-state"><CalendarDays size={28} /><h3>No bookings yet</h3><p>Submitted requests will appear here.</p></div> : <div className="student-bookings-list">{bookings.map((booking) => <article className="student-booking-card" key={booking.id}>
          <div className="booking-card-top"><div><h3>{booking.room_code.match(/ROOM-(\d+)/i)?.[1] ? `Room ${booking.room_code.match(/ROOM-(\d+)/i)[1]}` : booking.room_code}</h3></div><span className={`booking-status ${booking.status.toLowerCase()}`}>{booking.status}</span></div>
          <div className="booking-card-info"><div><CalendarDays size={15} />{new Date(booking.start_time).toLocaleDateString()}</div><div><Clock size={15} />{new Date(booking.start_time).toLocaleTimeString()} – {new Date(booking.end_time).toLocaleTimeString()}</div><div><MapPin size={15} />{buildings.find(({ building_code }) => building_code === booking.building_code)?.name || "Building unavailable"}</div></div>
          <p className="booking-purpose">{booking.purpose.replace(/^DEMO\s*[|·:-]?\s*/i, "")}</p>
          {booking.status.toUpperCase() === "REJECTED" && booking.rejection_reason && <p className="booking-purpose">Reason: {booking.rejection_reason}</p>}
          {["PENDING", "APPROVED"].includes(booking.status.toUpperCase()) && <button className="cancel-booking-button" type="button" disabled={busy} onClick={() => cancel(booking.id)}><XCircle size={15} /> Cancel booking</button>}
        </article>)}</div>}
      </section>
    </div>}
    {error && <div className="student-dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={() => { setError(""); setStatus("loading"); setRetryKey((key) => key + 1); }}><RefreshCw size={15} /> Retry</button></div>}
    {message && <p className="student-success-message" role="status">{message}</p>}
  </div>;
}

export default StudentBooking;
