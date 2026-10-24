import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronDown, Bell } from "lucide-react";
import { DemoModeIndicator } from "./DemoModeContext.jsx";

function Topbar() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  function submitSearch(event) {
    event.preventDefault();
    navigate(`/buildings${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
  }
  return <header className="topbar">
    <div className="college-info"><div><h2>Walchand College of Engineering</h2><p>Sangli, Maharashtra</p></div><ChevronDown size={17}/></div>
    <form className="search-box" onSubmit={submitSearch} role="search"><Search size={18}/><input type="search" aria-label="Search the building directory" placeholder="Search building directory..." value={query} onChange={(event) => setQuery(event.target.value)}/><button className="shortcut" type="submit" aria-label="Search">↵</button></form>
    <div className="topbar-right">
      <DemoModeIndicator />
      <button className="notification" type="button" aria-label="Open alerts" onClick={() => navigate("/alerts")}><Bell size={20}/></button>
      <div className="profile"><div className="avatar">A</div><span>Admin</span></div>
    </div>
  </header>;
}

export default Topbar;
