import { Bell, Search, UserCircle } from "lucide-react";
import { useLocation } from "react-router-dom";

function StudentTopbar() {
  const location = useLocation();

  const pageTitles = {
    "/student-dashboard": "Dashboard",
    "/student-map": "Campus Map",
    "/student-buildings": "Buildings",
    "/student-rooms": "Floors & Rooms",
    "/student-booking": "Room Booking",
    "/student-maintenance": "Maintenance",
    "/student-events": "Events & Notices",
    "/student-emergency": "Emergency",
    "/student-profile": "My Profile",
  };

  const currentTitle =
    pageTitles[location.pathname] || "Student Portal";

  return (
    <header className="student-topbar">
      <div className="student-topbar-left">
        <h2>{currentTitle}</h2>
      </div>

      <div className="student-topbar-right">
        <div className="student-search">
          <Search size={17} />

          <input
            type="text"
            placeholder="Search campus..."
          />
        </div>

        <button className="student-notification-button">
          <Bell size={19} />
          <span className="notification-dot"></span>
        </button>

        <div className="student-user">
          <UserCircle size={30} />

          <div>
            <strong>Student</strong>
            <span>Student Portal</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default StudentTopbar;