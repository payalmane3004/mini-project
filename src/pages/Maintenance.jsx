import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, Clock3, QrCode, Plus, Wrench, X } from "lucide-react";

const initialRequests = [
  { id: "MNT-001", request: "AC not cooling", location: "CSE-204", category: "HVAC", priority: "High", reported: "18 min ago", assigned: "Maintenance Team A", status: "In Progress" },
  { id: "MNT-002", request: "Projector failure", location: "MECH-101", category: "AV Equipment", priority: "Medium", reported: "2 hrs ago", assigned: "Maintenance Team B", status: "Pending" },
  { id: "MNT-003", request: "Water leakage", location: "LIB-201", category: "Plumbing", priority: "Critical", reported: "34 min ago", assigned: "Facilities Team", status: "In Progress" },
  { id: "MNT-004", request: "Elevator malfunction", location: "Admin Block", category: "Elevator", priority: "Critical", reported: "1 hr ago", assigned: "Elevator Services", status: "Pending" },
  { id: "MNT-005", request: "Power fluctuation", location: "MECH-202", category: "Electrical", priority: "High", reported: "3 hrs ago", assigned: "Electrical Team", status: "Pending" },
  { id: "MNT-006", request: "Door lock broken", location: "CSE-302", category: "Security", priority: "Low", reported: "5 hrs ago", assigned: "Security Team", status: "Resolved" },
  { id: "MNT-007", request: "HVAC fan noise", location: "Hostel A – Floor 3", category: "HVAC", priority: "Medium", reported: "1 day ago", assigned: "Maintenance Team A", status: "Resolved" },
  { id: "MNT-008", request: "Network outage", location: "CSE-Lab 2", category: "IT", priority: "High", reported: "45 min ago", assigned: "IT Support", status: "In Progress" },
];

const filters = ["All", "Pending", "In Progress", "Resolved"];

function statusClass(status) {
  return status.toLowerCase().replace(" ", "-");
}

function Maintenance() {
  const [requests, setRequests] = useState(initialRequests);
  const [filter, setFilter] = useState("All");
  const [dialog, setDialog] = useState(null);
  const [selected, setSelected] = useState(null);
  const filteredRequests = useMemo(() => requests.filter((request) => filter === "All" || request.status === filter), [requests, filter]);
  const counts = useMemo(() => ({ total: requests.length, pending: requests.filter(({ status }) => status === "Pending").length, progress: requests.filter(({ status }) => status === "In Progress").length, resolved: requests.filter(({ status }) => status === "Resolved").length }), [requests]);

  function createRequest(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const entry = {
      id: `MNT-${String(requests.length + 1).padStart(3, "0")}`,
      request: form.get("request"),
      location: form.get("location"),
      category: form.get("category"),
      priority: form.get("priority"),
      reported: "Just now",
      assigned: "Unassigned",
      status: "Pending",
    };
    setRequests((items) => [entry, ...items]);
    setFilter("All");
    setDialog(null);
  }

  return (
    <div className="maintenance-page">
      <header className="maintenance-heading">
        <div><h1>Smart Maintenance</h1><p>QR-based campus maintenance operations</p></div>
        <div className="maintenance-actions">
          <button className="maintenance-scan-button" onClick={() => setDialog("scan")}><QrCode size={17} /> Scan QR Code</button>
          <button className="maintenance-new-button" onClick={() => setDialog("new")}><Plus size={17} /> New Request</button>
        </div>
      </header>

      <section className="maintenance-stats" aria-label="Maintenance request summary">
        <article className="maintenance-stat"><span className="maintenance-stat-title">TOTAL REQUESTS</span><span className="maintenance-stat-icon cyan"><Wrench size={19}/></span><strong>{counts.total}</strong><small>All time</small></article>
        <article className="maintenance-stat"><span className="maintenance-stat-title">PENDING</span><span className="maintenance-stat-icon amber"><AlertCircle size={19}/></span><strong>{counts.pending}</strong><small>Needs attention</small></article>
        <article className="maintenance-stat"><span className="maintenance-stat-title">IN PROGRESS</span><span className="maintenance-stat-icon blue"><Clock3 size={19}/></span><strong>{counts.progress}</strong><small>Being handled</small></article>
        <article className="maintenance-stat"><span className="maintenance-stat-title">RESOLVED</span><span className="maintenance-stat-icon green"><CheckCircle2 size={19}/></span><strong>{counts.resolved}</strong><small>This week</small></article>
      </section>

      <button className="maintenance-qr-banner" onClick={() => setDialog("scan")}>
        <span className="maintenance-qr-icon"><QrCode size={22}/></span>
        <span className="maintenance-qr-copy"><strong>QR-Based Maintenance Entry</strong><small>Scan the QR code on any room or equipment to access its digital twin and report issues.</small></span>
        <ChevronRight className="maintenance-banner-arrow" size={19}/>
      </button>

      <div className="maintenance-list-controls">
        <div className="maintenance-filters" role="tablist" aria-label="Filter maintenance requests">
          {filters.map((item) => <button key={item} role="tab" aria-selected={filter === item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
        </div>
        <span>{filteredRequests.length} requests</span>
      </div>

      <section className="maintenance-table-panel" aria-label="Maintenance requests">
        <div className="maintenance-table-scroll"><table className="maintenance-table"><thead><tr><th>REQUEST</th><th>LOCATION</th><th>CATEGORY</th><th>PRIORITY</th><th>REPORTED</th><th>ASSIGNED TO</th><th>STATUS</th><th aria-label="Details"/></tr></thead><tbody>
          {filteredRequests.map((request) => <tr key={request.id} onClick={() => setSelected(request)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && setSelected(request)}>
            <td><strong>{request.request}</strong><small>{request.id}</small></td>
            <td className="maintenance-location">{request.location}</td>
            <td>{request.category}</td>
            <td><span className={`maintenance-pill priority-${request.priority.toLowerCase()}`}>{request.priority}</span></td>
            <td className="maintenance-reported">{request.reported}</td>
            <td>{request.assigned}</td>
            <td><span className={`maintenance-pill status-${statusClass(request.status)}`}>{request.status}</span></td>
            <td className="maintenance-row-arrow"><ChevronRight size={17}/></td>
          </tr>)}
        </tbody></table>{filteredRequests.length === 0 && <div className="maintenance-empty">No maintenance requests in this category.</div>}</div>
      </section>

      {dialog === "new" && <div className="maintenance-overlay" onMouseDown={(event) => event.target === event.currentTarget && setDialog(null)}><form className="maintenance-dialog" onSubmit={createRequest}>
        <button className="maintenance-dialog-close" type="button" aria-label="Close" onClick={() => setDialog(null)}><X size={18}/></button><span className="maintenance-dialog-icon"><Wrench size={19}/></span><h2>New Maintenance Request</h2><p>Tell us what needs attention and where.</p>
        <label>Request title<input name="request" required placeholder="e.g. AC not cooling"/></label>
        <label>Location<input name="location" required placeholder="Building and room"/></label>
        <div className="maintenance-form-row"><label>Category<select name="category" defaultValue="HVAC"><option>HVAC</option><option>Electrical</option><option>Plumbing</option><option>IT</option><option>AV Equipment</option><option>Security</option><option>Other</option></select></label><label>Priority<select name="priority" defaultValue="Medium"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label></div>
        <div className="maintenance-dialog-actions"><button type="button" onClick={() => setDialog(null)}>Cancel</button><button type="submit">Submit Request</button></div>
      </form></div>}

      {dialog === "scan" && <div className="maintenance-overlay" onMouseDown={(event) => event.target === event.currentTarget && setDialog(null)}><div className="maintenance-dialog maintenance-scan-dialog">
        <button className="maintenance-dialog-close" type="button" aria-label="Close" onClick={() => setDialog(null)}><X size={18}/></button><span className="maintenance-dialog-icon"><QrCode size={20}/></span><h2>Scan QR Code</h2><p>Point your camera at a room or equipment QR code to start a maintenance request.</p><div className="maintenance-scanner"><span className="scanner-corner top-left"/><span className="scanner-corner top-right"/><span className="scanner-corner bottom-left"/><span className="scanner-corner bottom-right"/><QrCode size={68} strokeWidth={1.2}/><i/></div><button className="maintenance-scan-fallback" onClick={() => setDialog("new")}>Enter a request manually</button>
      </div></div>}

      {selected && <div className="maintenance-overlay" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><div className="maintenance-dialog maintenance-detail-dialog">
        <button className="maintenance-dialog-close" type="button" aria-label="Close" onClick={() => setSelected(null)}><X size={18}/></button><span className="maintenance-dialog-id">{selected.id}</span><h2>{selected.request}</h2><span className={`maintenance-pill status-${statusClass(selected.status)}`}>{selected.status}</span><dl><div><dt>Location</dt><dd>{selected.location}</dd></div><div><dt>Category</dt><dd>{selected.category}</dd></div><div><dt>Priority</dt><dd>{selected.priority}</dd></div><div><dt>Reported</dt><dd>{selected.reported}</dd></div><div><dt>Assigned to</dt><dd>{selected.assigned}</dd></div></dl><div className="maintenance-dialog-actions"><button onClick={() => setSelected(null)}>Close</button></div>
      </div></div>}
    </div>
  );
}

export default Maintenance;
