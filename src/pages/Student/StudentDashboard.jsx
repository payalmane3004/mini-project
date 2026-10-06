import {
  Building2,
  CalendarDays,
  ClipboardList,
  AlertTriangle,
  Map,
  Clock3,
  ChevronRight,
} from "lucide-react";

const upcomingBookings = [
  {
    room: "CSE-204",
    purpose: "Project Meeting",
    date: "Today",
    time: "2:00 PM - 3:00 PM",
  },
  {
    room: "LAB-102",
    purpose: "Practical Session",
    date: "Tomorrow",
    time: "10:00 AM - 12:00 PM",
  },
];

const notices = [
  {
    title: "Library maintenance scheduled",
    description: "The central library will have maintenance this weekend.",
    time: "2 hours ago",
  },
  {
    title: "Project room availability",
    description: "New project rooms are now available for booking.",
    time: "Yesterday",
  },
];

function StudentDashboard() {
  return (
    <div className="student-dashboard">
      <div className="student-header">
        <div>
          <p className="page-label">STUDENT PORTAL</p>
          <h1>Welcome back, Student 👋</h1>
          <p>
            Explore your campus, manage bookings and stay updated.
          </p>
        </div>
      </div>

      <div className="student-stats">
        <div className="student-stat-card">
          <div className="student-stat-icon">
            <Building2 size={22} />
          </div>

          <div>
            <span>Buildings</span>
            <strong>12</strong>
          </div>
        </div>

        <div className="student-stat-card">
          <div className="student-stat-icon">
            <CalendarDays size={22} />
          </div>

          <div>
            <span>My Bookings</span>
            <strong>3</strong>
          </div>
        </div>

        <div className="student-stat-card">
          <div className="student-stat-icon">
            <ClipboardList size={22} />
          </div>

          <div>
            <span>Maintenance Requests</span>
            <strong>2</strong>
          </div>
        </div>

        <div className="student-stat-card">
          <div className="student-stat-icon">
            <AlertTriangle size={22} />
          </div>

          <div>
            <span>Active Alerts</span>
            <strong>1</strong>
          </div>
        </div>
      </div>

      <div className="student-dashboard-grid">
        <section className="student-panel">
          <div className="student-panel-header">
            <div>
              <h2>Upcoming Bookings</h2>
              <p>Your upcoming room reservations</p>
            </div>

            <CalendarDays size={20} />
          </div>

          <div className="student-booking-list">
            {upcomingBookings.map((booking, index) => (
              <div className="student-booking-item" key={index}>
                <div className="booking-room">
                  <strong>{booking.room}</strong>
                  <span>{booking.purpose}</span>
                </div>

                <div className="booking-time">
                  <span>{booking.date}</span>
                  <strong>{booking.time}</strong>
                </div>
              </div>
            ))}
          </div>

          <button className="student-link-button">
            View all bookings
            <ChevronRight size={17} />
          </button>
        </section>

        <section className="student-panel">
          <div className="student-panel-header">
            <div>
              <h2>Campus Quick Access</h2>
              <p>Find what you need quickly</p>
            </div>

            <Map size={20} />
          </div>

          <div className="student-quick-actions">
            <button>
              <Map size={20} />
              <span>Campus Map</span>
            </button>

            <button>
              <Building2 size={20} />
              <span>Find a Room</span>
            </button>

            <button>
              <CalendarDays size={20} />
              <span>Book a Room</span>
            </button>

            <button>
              <ClipboardList size={20} />
              <span>Report Issue</span>
            </button>
          </div>
        </section>
      </div>

      <section className="student-panel">
        <div className="student-panel-header">
          <div>
            <h2>Campus Notices</h2>
            <p>Latest announcements and updates</p>
          </div>

          <Clock3 size={20} />
        </div>

        <div className="student-notice-list">
          {notices.map((notice, index) => (
            <div className="student-notice" key={index}>
              <div>
                <strong>{notice.title}</strong>
                <p>{notice.description}</p>
              </div>

              <span>{notice.time}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default StudentDashboard;