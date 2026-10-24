import {
  LayoutDashboard,
  Box,
  Building2,
  DoorOpen,
  Users,
  Zap,
  Wrench,
  CalendarDays,
  TriangleAlert,
  BarChart3,
  FlaskConical,
  Brain,
  Bell,
  MessageSquareText,
  Wifi,
  Settings,
  LogOut,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";

const menuGroups = [
  {
    title: "OVERVIEW",
    items: [
      { name: "Dashboard", icon: LayoutDashboard, path: "/" },
      { name: "Digital Twin", icon: Box, path: "/digital-twin" },
    ],
  },
  {
    title: "CAMPUS",
    items: [
      { name: "Buildings", icon: Building2, path: "/buildings" },
      { name: "Floors & Rooms", icon: DoorOpen, path: "/rooms" },
      { name: "Occupancy", icon: Users, path: "/occupancy" },
      { name: "Energy", icon: Zap, path: "/energy" },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      { name: "Maintenance", icon: Wrench, path: "/maintenance" },
      { name: "Room Booking", icon: CalendarDays, path: "/booking" },
      { name: "Emergency", icon: TriangleAlert, path: "/emergency" },
    ],
  },
  {
    title: "INTELLIGENCE",
    items: [
      { name: "Analytics", icon: BarChart3, path: "/analytics" },
      { name: "Scenario Lab", icon: FlaskConical, path: "/scenario-lab" },
      { name: "Predictions", icon: Brain, path: "/predictions" },
      { name: "Alerts", icon: Bell, path: "/alerts" },
      { name: "Notices", icon: MessageSquareText, path: "/notices" },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { name: "Users", icon: Users, path: "/users" },
      { name: "Settings", icon: Settings, path: "/settings" },
    ],
  },
];

function Sidebar() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon"><Wifi size={22} strokeWidth={2.2} /></div>

        <div>
          <h1>SMART CAMPUS</h1>
          <p>Digital Twin Platform</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {menuGroups.map((group) => (
          <div className="nav-group" key={group.title}>
            <div className="nav-title">{group.title}</div>

            {group.items.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  to={item.path}
                  end={item.path === "/"}
                  className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                  aria-label={item.name}
                  key={item.name}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom status */}
      <div className="sidebar-footer">
        <div className="online-dot"></div>

        <span>Local demo</span>

        <span className="version">v2.4.1</span>

        <button className="sidebar-logout" type="button" onClick={handleLogout} aria-label="Logout">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
