import {
  LayoutDashboard,
  Map,
  Building2,
  DoorOpen,
  CalendarDays,
  Wrench,
  Bell,
  Siren,
  UserCircle,
  LogOut,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

function StudentSidebar() {
  const navigate = useNavigate();

  const menuItems = [
    {
      name: "Dashboard",
      path: "/student-dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Campus Map",
      path: "/student-map",
      icon: Map,
    },
    {
      name: "Buildings",
      path: "/student-buildings",
      icon: Building2,
    },
    {
      name: "Floors & Rooms",
      path: "/student-rooms",
      icon: DoorOpen,
    },
    {
      name: "Room Booking",
      path: "/student-booking",
      icon: CalendarDays,
    },
    {
      name: "Maintenance",
      path: "/student-maintenance",
      icon: Wrench,
    },
    {
      name: "Events & Notices",
      path: "/student-events",
      icon: Bell,
    },
    {
      name: "Emergency",
      path: "/student-emergency",
      icon: Siren,
    },
  ];

  return (
    <aside className="student-sidebar">
      <div className="student-sidebar-logo">
        <div className="student-logo-icon">
          <Building2 size={22} />
        </div>

        <div>
          <h2>Smart Campus</h2>
          <span>Student Portal</span>
        </div>
      </div>

      <nav className="student-sidebar-nav">
        <p className="student-nav-label">CAMPUS</p>

        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `student-nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={19} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="student-sidebar-bottom">
        <NavLink
          to="/student-profile"
          className={({ isActive }) =>
            `student-nav-item ${isActive ? "active" : ""}`
          }
        >
          <UserCircle size={19} />
          <span>Profile</span>
        </NavLink>

        <button
          className="student-logout"
          onClick={() => navigate("/login")}
        >
          <LogOut size={19} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default StudentSidebar;