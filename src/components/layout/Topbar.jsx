import { Search, ChevronDown, Bell } from "lucide-react";

function Topbar() {
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

        <div className="profile">
          <div className="avatar">A</div>
          <span>Admin</span>
        </div>

      </div>
    </header>
  );
}

export default Topbar;