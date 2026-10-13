import { useMemo, useState } from "react";
import { Activity, ArrowDownToLine, CalendarDays, Check, ChevronDown, CircleAlert, Plus, Search, Zap } from "lucide-react";
import { useSearchParams } from "react-router-dom";

const pages = {
  occupancy: { title: "Occupancy", subtitle: "Live people count and space utilization across campus", action: "Download Report", stats: [["People on campus", "8,426"], ["Average occupancy", "64.2%"], ["High traffic areas", "7"], ["Sensors online", "98.6%"]], columns: ["Location", "Building", "People", "Capacity", "Utilization", "Status"], rows: [["CSE Lecture Hall 1", "CSE Building", "54", "60", "90%", "Busy"], ["Central Reading Hall", "Central Library", "126", "220", "57%", "Normal"], ["ME Workshop", "Mechanical Block", "31", "36", "86%", "Busy"], ["Main Cafeteria", "Student Center", "208", "300", "69%", "Normal"], ["Admin Conference Room", "Admin Block", "4", "24", "17%", "Quiet"]], filters: ["All areas", "Busy", "Normal", "Quiet"] },
  energy: { title: "Energy", subtitle: "Monitor campus consumption and building efficiency", action: "Export Data", stats: [["Current demand", "2,840 kW"], ["Today's usage", "18.6 MWh"], ["This month", "426 MWh"], ["vs. last month", "âˆ’8.4%"]], columns: ["Building", "Current demand", "Today", "Efficiency", "Trend", "Status"], rows: [["CSE Building", "342 kW", "2.4 MWh", "A", "âˆ’6.2%", "Normal"], ["Mechanical Block", "418 kW", "3.1 MWh", "C", "+12.8%", "High usage"], ["Central Library", "186 kW", "1.7 MWh", "A", "âˆ’4.1%", "Normal"], ["Admin Block", "154 kW", "1.2 MWh", "B", "âˆ’2.3%", "Normal"], ["Electrical Engineering", "291 kW", "2.0 MWh", "B", "+1.4%", "Normal"]], filters: ["All buildings", "Normal", "High usage"] },
  maintenance: { title: "Maintenance", subtitle: "Track work orders and keep campus facilities running", action: "New Work Order", stats: [["Open work orders", "18"], ["In progress", "7"], ["Completed this month", "42"], ["Avg. resolution", "3.2 days"]], columns: ["Work order", "Location", "Issue", "Priority", "Assigned to", "Status"], rows: [["WO-2481", "ME Block Â· Floor 2", "HVAC filter replacement", "Medium", "Facilities team", "In progress"], ["WO-2479", "CSE Building Â· Lab 3", "Projector not responding", "High", "IT support", "Open"], ["WO-2476", "Library Â· Floor 1", "Lighting inspection", "Low", "Electrical team", "Scheduled"], ["WO-2472", "Admin Block Â· Room 204", "Water leak reported", "Urgent", "Plumbing team", "In progress"]], filters: ["All requests", "Open", "In progress", "Completed"] },
  booking: { title: "Room Booking", subtitle: "Manage room reservations and find available spaces", action: "Book a Room", stats: [["Today's bookings", "36"], ["Rooms available", "124"], ["Pending requests", "4"], ["Utilization today", "72%"]], columns: ["Room", "Purpose", "Requested by", "Date & time", "Attendees", "Status"], rows: [["CSE-204", "Project review", "A. Patil", "Today Â· 10:00 AM", "24", "Confirmed"], ["ADM-202", "Faculty meeting", "S. Joshi", "Today Â· 1:30 PM", "12", "Confirmed"], ["LIB-301", "Study group", "R. Kulkarni", "Today Â· 3:00 PM", "8", "Pending"], ["ME-105", "Design workshop", "P. Desai", "Tomorrow Â· 9:00 AM", "20", "Confirmed"]], filters: ["All bookings", "Confirmed", "Pending"] },
  emergency: { title: "Emergency", subtitle: "Campus safety status and incident coordination", action: "Report Incident", stats: [["Campus status", "All clear"], ["Active incidents", "0"], ["Response teams", "6 ready"], ["Safety systems", "Online"]], columns: ["Incident", "Location", "Reported", "Severity", "Response team", "Status"], rows: [["Fire alarm test", "CSE Building", "Today Â· 9:00 AM", "Low", "Safety team A", "Resolved"], ["First aid request", "Sports Complex", "Yesterday Â· 4:42 PM", "Medium", "Medical team", "Resolved"], ["Power interruption", "Workshop", "Sep 26 Â· 11:15 AM", "Medium", "Electrical team", "Resolved"]], filters: ["All incidents", "Active", "Resolved"] },
  analytics: { title: "Analytics", subtitle: "Campus performance at a glance", action: "Export Report", stats: [["Avg. occupancy", "64.2%"], ["Energy this month", "426 MWh"], ["Room utilization", "72%"], ["Open work orders", "18"]], columns: ["Metric", "Current period", "Previous period", "Change", "Target", "Performance"], rows: [["Campus occupancy", "64.2%", "59.8%", "+7.4%", "70%", "On track"], ["Energy consumption", "426 MWh", "465 MWh", "âˆ’8.4%", "âˆ’10%", "On track"], ["Room utilization", "72%", "68%", "+5.9%", "75%", "On track"], ["Maintenance response", "3.2 days", "4.1 days", "âˆ’22%", "2 days", "Improving"]], filters: ["This week", "This month", "This year"] },
  predictions: { title: "Predictions", subtitle: "AI-assisted forecasts for campus planning", action: "Refresh Forecast", stats: [["Forecast confidence", "94.2%"], ["Peak occupancy", "82%"], ["Energy outlook", "âˆ’6.8%"], ["Forecast horizon", "30 days"]], columns: ["Forecast", "Area", "Prediction", "Expected", "Confidence", "Recommendation"], rows: [["Peak occupancy", "CSE Building", "High traffic expected", "Oct 02 Â· 11 AM", "96%", "Open overflow rooms"], ["Energy demand", "Mechanical Block", "+14% vs average", "Oct 03 Â· 2 PM", "91%", "Review HVAC schedule"], ["Room availability", "Central Library", "Limited study spaces", "Oct 05 Â· All day", "89%", "Extend reading hall hours"], ["Maintenance risk", "Admin Block HVAC", "Service likely needed", "Next 14 days", "82%", "Schedule inspection"]], filters: ["Next 7 days", "Next 30 days", "Next 90 days"] },
  scenarioLab: { title: "Scenario Lab", subtitle: "Explore campus what-if scenarios and operational plans", action: "New Scenario", stats: [["Saved scenarios", "12"], ["Ready to run", "4"], ["Active models", "8"], ["Last simulation", "2 hrs ago"]], columns: ["Scenario", "Area", "Change modeled", "Time horizon", "Owner", "Status"], rows: [["Exam week capacity", "Campus-wide", "+18% occupancy", "Next 7 days", "Admin team", "Ready"], ["HVAC schedule update", "Mechanical Block", "âˆ’12% energy", "Next 30 days", "Facilities", "Draft"], ["Library extended hours", "Central Library", "+24% room use", "Next 14 days", "Library team", "Ready"]], filters: ["All scenarios", "Ready", "Draft"] },
  users: { title: "Users", subtitle: "Manage campus platform access and roles", action: "Add User", stats: [["Total users", "248"], ["Administrators", "12"], ["Facility teams", "38"], ["Active today", "176"]], columns: ["Name", "Email", "Role", "Department", "Last active", "Status"], rows: [["Aarav Patil", "aarav.patil@wce.edu", "Administrator", "IT Services", "Now", "Active"], ["Sana Joshi", "sana.joshi@wce.edu", "Facilities Manager", "Facilities", "12 min ago", "Active"], ["Rohan Kulkarni", "rohan.k@wce.edu", "Faculty", "Computer Science", "1 hr ago", "Active"]], filters: ["All users", "Active", "Inactive"] },
  settings: { title: "Settings", subtitle: "Configure campus information and platform preferences", action: "Save Changes", stats: [["Campus", "Walchand College"], ["Timezone", "Asia/Kolkata"], ["Data refresh", "Every 15 sec"], ["Notifications", "Enabled"]], columns: ["Configuration", "Current value", "Category", "Last updated", "Updated by", "Status"], rows: [["Campus name", "Walchand College of Engineering", "General", "Sep 30, 2026", "Admin", "Active"], ["Timezone", "Asia/Kolkata", "Regional", "Sep 30, 2026", "Admin", "Active"], ["Sensor refresh interval", "15 seconds", "Data", "Sep 28, 2026", "System", "Active"]], filters: ["All settings", "General", "Data"] },
  alerts: { title: "Alerts", subtitle: "Review sensor events and campus notifications", action: "Mark all read", stats: [["Unread alerts", "3"], ["Critical", "0"], ["Warnings", "2"], ["Info", "12"]], columns: ["Alert", "Location", "Time", "Category", "Details", "Status"], rows: [["Energy usage above threshold", "Mechanical Block", "4 min ago", "Energy", "418 kW Â· 18% above baseline", "Unread"], ["Room occupancy near capacity", "CSE Building Â· Hall 1", "18 min ago", "Occupancy", "54 of 60 seats occupied", "Unread"], ["Sensor connection restored", "Central Library", "1 hour ago", "System", "Occupancy sensor is back online", "Read"], ["Maintenance due soon", "Admin Block", "Yesterday", "Maintenance", "HVAC inspection scheduled this week", "Read"]], filters: ["All alerts", "Unread", "Read"] },
};

function WorkspacePage({ page }) {
  const config = pages[page];
  const [searchParams] = useSearchParams();
  const buildingId = searchParams.get("building");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(config.filters[0]);
  const [rows, setRows] = useState(config.rows);
  const [modal, setModal] = useState(false);
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => rows.filter((row) => row.join(" ").toLowerCase().includes(query.toLowerCase()) && (filter === config.filters[0] || row.includes(filter))), [rows, query, filter, config]);

  function exportRows() {
    const csv = [config.columns, ...filtered].map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `${page}-report.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    setNotice("Report downloaded");
  }

  function handleAction() {
    if (["Download Report", "Export Data", "Export Report"].includes(config.action)) return exportRows();
    if (config.action === "Mark all read") {
      setRows((items) => items.map((row) => row.map((cell) => cell === "Unread" ? "Read" : cell)));
      setNotice("All alerts marked as read");
      return;
    }
    if (config.action === "Refresh Forecast") {
      setNotice("Forecast refreshed just now");
      return;
    }
    setModal(true);
  }

  function saveEntry(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const vals = config.columns.map((_, index) => index === 0 ? (form.get("name") || "New request") : index === 1 ? (form.get("location") || "Campus") : index === config.columns.length - 1 ? "Open" : "â€”");
    setRows((items) => [vals, ...items]);
    setModal(false);
    setNotice("Added successfully");
  }

  return <div className="workspace-page">
    <div className="page-header"><div><div className="workspace-eyebrow"><Activity size={14}/> CAMPUS OPERATIONS</div><h1>{config.title}</h1><p>{config.subtitle}</p></div><div className="page-actions"><button onClick={exportRows}><ArrowDownToLine size={15}/> Export</button><button className="primary-button" onClick={handleAction}>{config.action === "Book a Room" ? <CalendarDays size={15}/> : config.action === "New Work Order" || config.action === "Add Room" ? <Plus size={16}/> : <Zap size={15}/>} {config.action}</button></div></div>
    <div className="workspace-demo-note">Demonstration records Â· changes are held in this page session only; no campus service is connected.</div>
    {page === "rooms" && buildingId && <p className="workspace-eyebrow">Building: {buildingId}</p>}
    {notice && <div className="workspace-notice"><Check size={15}/>{notice}<button onClick={() => setNotice("")}>Dismiss</button></div>}
    <div className="workspace-stats">{config.stats.map(([label, value], index) => <article className="workspace-stat" key={label}><span className={`workspace-stat-icon tone-${index}`}><Activity size={17}/></span><div><span>{label}</span><strong>{value}</strong></div><ChevronDown size={15} className="stat-caret"/></article>)}</div>
    <section className="workspace-panel"><header className="workspace-panel-header"><div><h2>{page === "alerts" ? "Recent notifications" : page === "predictions" ? "Forecast overview" : page === "analytics" ? "Performance summary" : page === "emergency" ? "Recent incidents" : page === "booking" ? "Upcoming bookings" : page === "maintenance" ? "Work orders" : page === "rooms" ? "Room directory" : page === "energy" ? "Building consumption" : "Location status"}</h2><p>Sample dataset Â· not refreshed from a live source</p></div><span className="workspace-sample-tag">DEMO DATA</span></header>
      <div className="workspace-toolbar"><div className="workspace-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${config.title.toLowerCase()}...`}/></div><div className="workspace-filters">{config.filters.map((item) => <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
      <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr>{config.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{filtered.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cellIndex === row.length - 1 || (page === "maintenance" && cellIndex === 3) ? <span className={`workspace-badge ${/urgent|high|busy|unread/i.test(cell) ? "attention" : /open|pending|progress/i.test(cell) ? "pending" : "good"}`}><i/>{cell}</span> : cell}</td>)}</tr>)}</tbody></table>{filtered.length === 0 && <div className="workspace-empty"><CircleAlert size={22}/><span>No results found</span><small>Try adjusting your search or filters.</small></div>}</div>
      <footer className="workspace-table-footer"><span>Showing {filtered.length ? 1 : 0}â€“{filtered.length} of {filtered.length} entries</span><div><button disabled>Previous</button><button className="current">1</button><button disabled>Next</button></div></footer>
    </section>
    {modal && <div className="workspace-modal-backdrop" onClick={(event) => event.target === event.currentTarget && setModal(false)}><form className="workspace-modal" onSubmit={saveEntry}><button type="button" className="modal-close" onClick={() => setModal(false)} aria-label="Close">Ã—</button><div className="modal-icon"><Plus size={18}/></div><h2>{config.action}</h2><p>Enter the details to add this to campus operations.</p><label>{config.columns[0]}<input name="name" required placeholder={`e.g. ${config.columns[0]}`} autoFocus/></label><label>Location<input name="location" placeholder="Building or campus area"/></label><label>Notes<textarea name="notes" placeholder="Add any useful details" rows="3"/></label><div className="modal-actions"><button type="button" onClick={() => setModal(false)}>Cancel</button><button className="primary-button" type="submit">Save</button></div></form></div>}
  </div>;
}

export default WorkspacePage;
