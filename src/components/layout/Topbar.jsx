import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronDown, Bell, LogOut, UserRound } from "lucide-react";
import { useAuth } from "../../auth/useAuth";

function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  function signOut() { logout(); navigate("/login", { replace: true }); }
  return (
    <header className="topbar">

      {/* College */}
      <div className="college-info">
        <div>
          <h2>Walchand College of Engineering</h2>
          <p>Sangli, Maharashtra</p>
        </div>

        <ChevronDown size={17} />
      </div>

      {/* Search */}
      <div className="search-box">
        <Search size={18} />

        <input
          type="text"
          placeholder="Search buildings, rooms, sensors..."
        />

        <span className="shortcut">⌘K</span>
      </div>

      {/* Right section */}
      <div className="topbar-right">

        <div className="live-status">
          <span className="live-dot"></span>

          <div>
            <strong>Live</strong>
            <small>Updated 12s ago</small>
          </div>
        </div>

        <div className="notification">
          <Bell size={20} />

          <span className="notification-count">3</span>
        </div>

        <div className="admin-profile-menu">
          <button className="profile" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen}>
            <div className="avatar">{(user?.role === "ADMIN" ? "A" : user?.name || "A").slice(0, 1).toUpperCase()}</div>
            <span>{user?.role === "ADMIN" ? "Admin" : user?.name || "Admin"}<small>Administrator</small></span>
            <ChevronDown size={14}/>
          </button>
          {profileOpen && <div className="admin-profile-dropdown"><span><UserRound size={15}/>{user?.email}</span><button onClick={signOut}><LogOut size={15}/>Sign out</button></div>}
        </div>

      </div>
    </header>
  );
}

export default Topbar;
