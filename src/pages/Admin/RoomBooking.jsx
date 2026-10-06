import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, DoorOpen, Users, X } from "lucide-react";
import "./RoomBooking.css";

const rooms = [
  { id: "CSE-102", building: "CSE", floor: 1, capacity: 30, type: "Lab", slots: ["9:00–11:00", "11:00–13:00", "14:00–16:00", "16:00–18:00"] },
  { id: "CSE-202", building: "CSE", floor: 2, capacity: 120, type: "Seminar Hall", slots: ["9:00–11:00", "11:00–13:00", "14:00–16:00", "16:00–18:00"] },
  { id: "ADMIN-201", building: "Admin Block", floor: 2, capacity: 30, type: "Conference Room", slots: ["9:00–11:00", "11:00–13:00", "14:00–16:00", "16:00–18:00"] },
];
const defaultBookings = [
  { room: "CSE-301", time: "09:00–11:00", owner: "Dr. R. Sharma" },
  { room: "CSE-202", time: "14:00–16:00", owner: "Prof. K. Mehta" },
  { room: "ADMIN-201", time: "11:00–12:00", owner: "Dean's Office" },
  { room: "CSE-401", time: "15:00–17:00", owner: "Research Committee" },
];
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function RoomBooking() {
  const [month, setMonth] = useState(7);
  const [year, setYear] = useState(2026);
  const [selectedDay, setSelectedDay] = useState(20);
  const [buildingFilter, setBuildingFilter] = useState("All Buildings");
  const [timeFilter, setTimeFilter] = useState("");
  const [capacityFilter, setCapacityFilter] = useState("");
  const [selectedSlots, setSelectedSlots] = useState({});
  const [bookedSlots, setBookedSlots] = useState([]);
  const [bookings, setBookings] = useState(defaultBookings);
  const [dialogRoom, setDialogRoom] = useState(null);

  const monthName = new Date(year, month, 1).toLocaleString("en-US", { month: "long" });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const calendarCells = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  while (calendarCells.length % 7) calendarCells.push(null);
  const availableRooms = useMemo(() => rooms.filter((room) => {
    const buildingMatch = buildingFilter === "All Buildings" || room.building === buildingFilter;
    const capacityMatch = !capacityFilter || room.capacity >= Number(capacityFilter);
    const timeMatch = !timeFilter || room.slots.some((slot) => {
      const [start, end] = slot.split("–").map((part) => {
        const [hour, minute] = part.split(":").map(Number);
        return hour * 60 + minute;
      });
      const [hour, minute] = timeFilter.split(":").map(Number);
      const requestedTime = hour * 60 + minute;
      return requestedTime >= start && requestedTime < end;
    });
    return buildingMatch && capacityMatch && timeMatch;
  }), [buildingFilter, capacityFilter, timeFilter]);

  function moveMonth(amount) {
    const date = new Date(year, month + amount, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth());
    setSelectedDay((day) => Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  }

  function confirmBooking(event) {
    event.preventDefault();
    const slot = dialogRoom.slot;
    setBookedSlots((items) => [...items, `${dialogRoom.room.id}-${slot}-${selectedDay}-${month}-${year}`]);
    setBookings((items) => [{ room: dialogRoom.room.id, time: slot.replace("–", "–"), owner: new FormData(event.currentTarget).get("purpose") || "New booking" }, ...items]);
    setSelectedSlots((items) => ({ ...items, [dialogRoom.room.id]: "" }));
    setDialogRoom(null);
  }

  const dayLabel = `${selectedDay} ${monthName}`;

  return (
    <div className="booking-page">
      <header className="booking-heading"><h1>Room Booking</h1><p>Reserve rooms and manage campus space allocation</p></header>

      <section className="booking-filters" aria-label="Find available rooms">
        <label className="booking-building-filter"><span className="sr-only">Building</span><select value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}><option>All Buildings</option><option>CSE</option><option>Admin Block</option></select></label>
        <label className="booking-time-filter"><span className="sr-only">Start time</span><input type="time" value={timeFilter} onChange={(event) => setTimeFilter(event.target.value)} /></label>
        <label className="booking-capacity-filter"><span className="sr-only">Minimum capacity</span><input type="number" min="1" placeholder="Min capacity" value={capacityFilter} onChange={(event) => setCapacityFilter(event.target.value)} /></label>
      </section>

      <div className="booking-content-grid">
        <aside className="booking-calendar-panel">
          <header className="booking-calendar-heading"><button aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft size={20}/></button><h2>{monthName} {year}</h2><button aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={20}/></button></header>
          <div className="booking-calendar-grid">
            {weekDays.map((day) => <span className="booking-weekday" key={day}>{day}</span>)}
            {calendarCells.map((day, index) => day ? <button key={`${year}-${month}-${day}`} className={`booking-day ${day === selectedDay ? "selected" : ""}`} aria-pressed={day === selectedDay} onClick={() => setSelectedDay(day)}>{day}</button> : <span className="booking-day-empty" key={`empty-${index}`} />)}
          </div>
          <section className="booking-today-list"><h3>Today's Bookings</h3>{bookings.map((booking, index) => <article className="booking-agenda-item" key={`${booking.room}-${index}`}><Clock3 size={15}/><div><strong>{booking.room}</strong><span>{booking.time}</span><small>{booking.owner}</small></div></article>)}</section>
        </aside>

        <section className="booking-results">
          <h2>Available Rooms — {dayLabel}</h2>
          <div className="booking-room-grid">
            {availableRooms.map((room) => {
              const freeSlots = room.slots.filter((slot) => !bookedSlots.includes(`${room.id}-${slot}-${selectedDay}-${month}-${year}`));
              return <article className="booking-room-card" key={room.id}>
                <div className="booking-room-card-top"><strong>{room.id}</strong><span className="booking-room-available">Available</span></div>
                <p className="booking-room-building">{room.building} · Floor {room.floor}</p>
                <p className="booking-room-capacity"><Users size={14}/> Capacity: {room.capacity}</p>
                <p className="booking-room-type">{room.type} · Available all day</p>
                <div className="booking-slots">{freeSlots.map((slot) => <button className={selectedSlots[room.id] === slot ? "selected" : ""} key={slot} onClick={() => setSelectedSlots((items) => ({ ...items, [room.id]: slot }))}>{slot}</button>)}{freeSlots.length === 0 && <span className="booking-no-slots">No times available</span>}</div>
                <button className="booking-room-submit" disabled={freeSlots.length === 0} onClick={() => setDialogRoom({ room, slot: selectedSlots[room.id] || freeSlots[0] })}>Book Room</button>
              </article>;
            })}
            {availableRooms.length === 0 && <div className="booking-no-rooms"><DoorOpen size={25}/><strong>No available rooms</strong><span>Try changing the building, time, or capacity filters.</span></div>}
          </div>
        </section>
      </div>

      {dialogRoom && <div className="booking-overlay" onMouseDown={(event) => event.target === event.currentTarget && setDialogRoom(null)}><form className="booking-dialog" onSubmit={confirmBooking}>
        <button className="booking-dialog-close" type="button" aria-label="Close" onClick={() => setDialogRoom(null)}><X size={18}/></button><span className="booking-dialog-icon"><CalendarDays size={19}/></span><h2>Confirm Room Booking</h2><p>Review the booking details before confirming.</p>
        <div className="booking-confirm-details"><div><span>Room</span><strong>{dialogRoom.room.id}</strong></div><div><span>Date</span><strong>{dayLabel}, {year}</strong></div><div><span>Time</span><strong>{dialogRoom.slot}</strong></div><div><span>Capacity</span><strong>{dialogRoom.room.capacity} people</strong></div></div>
        <label>Booking purpose<input name="purpose" required placeholder="e.g. Project review"/></label><div className="booking-dialog-actions"><button type="button" onClick={() => setDialogRoom(null)}>Cancel</button><button type="submit">Confirm Booking</button></div>
      </form></div>}
    </div>
  );
}

export default RoomBooking;
