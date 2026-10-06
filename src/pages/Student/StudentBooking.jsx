import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const rooms = [
  {
    id: 101,
    building: "CSE Building",
    room: "CSE-101",
    type: "Classroom",
    capacity: 60,
  },
  {
    id: 102,
    building: "CSE Building",
    room: "CSE-102",
    type: "Classroom",
    capacity: 60,
  },
  {
    id: 103,
    building: "CSE Building",
    room: "CSE-103",
    type: "Computer Lab",
    capacity: 40,
  },
  {
    id: 201,
    building: "CSE Building",
    room: "CSE-201",
    type: "Classroom",
    capacity: 70,
  },
  {
    id: 301,
    building: "CSE Building",
    room: "CSE-301",
    type: "Project Room",
    capacity: 20,
  },
  {
    id: 401,
    building: "CSE Building",
    room: "CSE-401",
    type: "Seminar Hall",
    capacity: 100,
  },
  {
    id: 501,
    building: "Central Library",
    room: "LIB-101",
    type: "Reading Hall",
    capacity: 120,
  },
];

const initialBookings = [
  {
    id: "BK-001",
    room: "CSE-301",
    building: "CSE Building",
    date: "2026-10-07",
    startTime: "10:00",
    endTime: "11:00",
    purpose: "Mini Project Discussion",
    status: "Confirmed",
  },
  {
    id: "BK-002",
    room: "CSE-102",
    building: "CSE Building",
    date: "2026-10-10",
    startTime: "14:00",
    endTime: "15:00",
    purpose: "Group Study",
    status: "Pending",
  },
];

function StudentBooking() {
  const [bookings, setBookings] = useState(initialBookings);

  const [form, setForm] = useState({
    roomId: 101,
    date: "",
    startTime: "",
    endTime: "",
    purpose: "",
  });

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === Number(form.roomId)),
    [form.roomId]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (
      !form.date ||
      !form.startTime ||
      !form.endTime ||
      !form.purpose.trim()
    ) {
      return;
    }

    const newBooking = {
      id: `BK-${String(bookings.length + 1).padStart(3, "0")}`,
      room: selectedRoom.room,
      building: selectedRoom.building,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      purpose: form.purpose,
      status: "Pending",
    };

    setBookings((previous) => [newBooking, ...previous]);

    setForm({
      roomId: 101,
      date: "",
      startTime: "",
      endTime: "",
      purpose: "",
    });
  };

  const cancelBooking = (bookingId) => {
    setBookings((previous) =>
      previous.map((booking) =>
        booking.id === bookingId
          ? { ...booking, status: "Cancelled" }
          : booking
      )
    );
  };

  return (
    <div className="student-booking-page">
      <div className="student-page-header">
        <div>
          <h1>Room Booking</h1>
          <p>Book campus rooms for meetings, projects and study sessions.</p>
        </div>
      </div>

      <div className="student-booking-layout">
        {/* Booking form */}
        <section className="booking-form-panel">
          <div className="booking-panel-heading">
            <div>
              <h2>Book a Room</h2>
              <p>Select a room and booking time.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="booking-field">
              <label>Room</label>

              <select
                name="roomId"
                value={form.roomId}
                onChange={handleChange}
              >
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.room} — {room.type}
                  </option>
                ))}
              </select>
            </div>

            {selectedRoom && (
              <div className="selected-room-preview">
                <div>
                  <strong>{selectedRoom.room}</strong>
                  <span>{selectedRoom.type}</span>
                </div>

                <div>
                  <MapPin size={15} />
                  {selectedRoom.building}
                </div>

                <div>
                  <Users size={15} />
                  Capacity: {selectedRoom.capacity}
                </div>
              </div>
            )}

            <div className="booking-field">
              <label>Date</label>

              <div className="input-with-icon">
                <CalendarDays size={17} />

                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="booking-time-row">
              <div className="booking-field">
                <label>Start Time</label>

                <div className="input-with-icon">
                  <Clock size={17} />

                  <input
                    type="time"
                    name="startTime"
                    value={form.startTime}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="booking-field">
                <label>End Time</label>

                <div className="input-with-icon">
                  <Clock size={17} />

                  <input
                    type="time"
                    name="endTime"
                    value={form.endTime}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="booking-field">
              <label>Purpose</label>

              <textarea
                name="purpose"
                value={form.purpose}
                onChange={handleChange}
                placeholder="e.g. Project discussion, group study..."
                rows="4"
              />
            </div>

            <button className="booking-submit-button" type="submit">
              <CalendarDays size={17} />
              Request Booking
            </button>
          </form>
        </section>

        {/* My bookings */}
        <section className="my-bookings-panel">
          <div className="booking-panel-heading">
            <div>
              <h2>My Bookings</h2>
              <p>Your recent room booking requests.</p>
            </div>

            <span className="booking-total">
              {bookings.length} bookings
            </span>
          </div>

          <div className="student-bookings-list">
            {bookings.map((booking) => (
              <div className="student-booking-card" key={booking.id}>
                <div className="booking-card-top">
                  <div>
                    <span className="booking-id">{booking.id}</span>
                    <h3>{booking.room}</h3>
                  </div>

                  <span
                    className={`booking-status ${booking.status.toLowerCase()}`}
                  >
                    {booking.status}
                  </span>
                </div>

                <div className="booking-card-info">
                  <div>
                    <CalendarDays size={15} />
                    {booking.date}
                  </div>

                  <div>
                    <Clock size={15} />
                    {booking.startTime} – {booking.endTime}
                  </div>

                  <div>
                    <MapPin size={15} />
                    {booking.building}
                  </div>
                </div>

                <p className="booking-purpose">
                  {booking.purpose}
                </p>

                {booking.status !== "Cancelled" && (
                  <button
                    className="cancel-booking-button"
                    onClick={() => cancelBooking(booking.id)}
                  >
                    <XCircle size={15} />
                    Cancel Booking
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default StudentBooking;