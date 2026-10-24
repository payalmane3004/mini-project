import { Bell, Search, UserCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { DemoModeIndicator } from "./DemoModeContext.jsx";

function StudentTopbar() {
  const location = useLocation();
  const { user } = useAuth();

  const pageTitles = {
    "/student-dashboard": "Dashboard",
    "/student-map": "Campus Map",
    "/student-digital-twin": "Digital Twin",
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
        <DemoModeIndicator />
        <Link className="student-search" to="/student-buildings" aria-label="Browse campus buildings">
          <Search size={17} aria-hidden="true" />
          <span>Browse campus</span>
        </Link>

        <Link className="student-notification-button" to="/student-emergency" aria-label="View emergency information">
          <Bell size={19} aria-hidden="true" />
        </Link>

        <div className="student-user">
          <UserCircle size={30} />

          <div>
            <strong>{user?.full_name || "Student"}</strong>
            <span>Student Portal</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default StudentTopbar;
