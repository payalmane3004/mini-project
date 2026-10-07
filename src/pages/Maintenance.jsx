import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, Clock3, QrCode, Plus, Wrench, X, MapPin, Building2, CalendarDays, Upload, Camera, ArrowLeft, Check, Printer, Download, ClipboardList, ShieldCheck } from "lucide-react";

const assetDirectory = [
  { code: "ASSET-CSE-LAB2-PROJ02", building: "CSE Department", floor: "2", room: "Computer Lab 2", roomNumber: "CSE-204", equipment: "Projector #02", status: "Operational", lastMaintenance: "12 Aug 2026", qrId: "QR-CSE-204-P02" },
  { code: "ASSET-MECH-101-PROJ01", building: "Mechanical Block", floor: "1", room: "Seminar Room", roomNumber: "MECH-101", equipment: "Projector #01", status: "Operational", lastMaintenance: "04 Sep 2026", qrId: "QR-MECH-101-P01" },
  { code: "ASSET-LIB-201-AC01", building: "Central Library", floor: "2", room: "Reading Room", roomNumber: "LIB-201", equipment: "Air Conditioner #01", status: "Needs inspection", lastMaintenance: "28 Jul 2026", qrId: "QR-LIB-201-AC01" },
];

const initialRequests = [
  { id: "MNT-001", request: "AC not cooling", location: "CSE-204", equipment: "Air Conditioner #04", category: "HVAC", priority: "High", reported: "18 min ago", assigned: "Maintenance Team A", status: "In Progress", reporter: "Facilities Desk", notes: "" },
  { id: "MNT-002", request: "Projector failure", location: "MECH-101", equipment: "Projector #01", category: "Equipment", priority: "Medium", reported: "2 hrs ago", assigned: "Maintenance Team B", status: "Pending", reporter: "A. Patil", notes: "" },
  { id: "MNT-003", request: "Water leakage", location: "LIB-201", equipment: "Water line", category: "Plumbing", priority: "High", reported: "34 min ago", assigned: "Facilities Team", status: "In Progress", reporter: "Library Staff", notes: "" },
  { id: "MNT-004", request: "Elevator malfunction", location: "Admin Block", equipment: "Elevator #01", category: "Equipment", priority: "High", reported: "1 hr ago", assigned: "Unassigned", status: "Pending", reporter: "Security Desk", notes: "" },
  { id: "MNT-005", request: "Power fluctuation", location: "MECH-202", equipment: "Power panel", category: "Electrical", priority: "High", reported: "3 hrs ago", assigned: "Electrical Team", status: "Assigned", reporter: "R. Joshi", notes: "" },
  { id: "MNT-006", request: "Door lock broken", location: "CSE-302", equipment: "Door lock", category: "Equipment", priority: "Low", reported: "5 hrs ago", assigned: "Security Team", status: "Resolved", reporter: "S. Kulkarni", notes: "Lock replaced." },
  { id: "MNT-007", request: "HVAC fan noise", location: "Hostel A – Floor 3", equipment: "HVAC unit", category: "Equipment", priority: "Medium", reported: "1 day ago", assigned: "Maintenance Team A", status: "Resolved", reporter: "Hostel Warden", notes: "Fan bearing replaced." },
  { id: "MNT-008", request: "Network outage", location: "CSE-Lab 2", equipment: "Network access point", category: "Network", priority: "High", reported: "45 min ago", assigned: "IT Support", status: "In Progress", reporter: "IT Desk", notes: "" },
];

const filters = ["All", "Pending", "Assigned", "In Progress", "Resolved"];
const teams = ["Maintenance Team A", "Maintenance Team B", "Facilities Team", "Electrical Team", "IT Support"];
function statusClass(status) { return status.toLowerCase().replaceAll(" ", "-"); }

function Maintenance() {
  const [requests, setRequests] = useState(initialRequests);
  const [filter, setFilter] = useState("All");
  const [dialog, setDialog] = useState(null);
  const [selected, setSelected] = useState(null);
  const [asset, setAsset] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const [manualCode, setManualCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [generated, setGenerated] = useState({});
  const filteredRequests = useMemo(() => requests.filter((request) => filter === "All" || request.status === filter), [requests, filter]);
  const counts = useMemo(() => ({ total: requests.length, pending: requests.filter(({ status }) => status === "Pending").length, progress: requests.filter(({ status }) => status === "In Progress" || status === "Assigned").length, resolved: requests.filter(({ status }) => status === "Resolved").length }), [requests]);

  function openEntry() { setAsset(null); setSubmitted(null); setCodeError(""); setManualCode(""); setDialog("entry"); }
  function identifyAsset(match = assetDirectory[0]) { setAsset(match); setDialog("asset"); }
  function findAsset(event) {
    event.preventDefault();
    const match = assetDirectory.find((item) => item.code.toLowerCase() === manualCode.trim().toLowerCase() || item.qrId.toLowerCase() === manualCode.trim().toLowerCase() || item.roomNumber.toLowerCase() === manualCode.trim().toLowerCase());
    if (!match) { setCodeError("We couldn’t find that code. Check the QR label and try again."); return; }
    setCodeError(""); identifyAsset(match);
  }
  function createRequest(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("description")).trim();
    const entry = {
      id: `MNT-${String(requests.length + 1).padStart(3, "0")}`, request: title.length > 50 ? `${title.slice(0, 47)}…` : title,
      description: title, location: asset?.roomNumber || String(form.get("location")), equipment: asset?.equipment || String(form.get("equipment")),
      category: String(form.get("category")), priority: String(form.get("priority")), reported: "Just now", submittedAt: new Date().toLocaleString(),
      assigned: "Unassigned", status: "Pending", reporter: String(form.get("reporter")), notes: "", imageName: form.get("image")?.name || "",
    };
    setRequests((items) => [entry, ...items]); setFilter("All"); setSubmitted(entry); setDialog("success");
  }
  function updateSelected(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const assignment = String(form.get("assigned"));
    const status = String(form.get("status"));
    const updated = { ...selected, assigned: assignment || selected.assigned, status, notes: String(form.get("notes") || "") };
    setRequests((items) => items.map((item) => item.id === updated.id ? updated : item)); setSelected(updated);
  }
  function startReport() { setDialog("report"); }
  function viewSubmitted() { setSelected(submitted); setDialog(null); }
  function downloadAsset(assetItem) {
    const data = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="white"/><text x="120" y="110" text-anchor="middle" font-family="sans-serif" font-size="18">${assetItem.qrId}</text><text x="120" y="140" text-anchor="middle" font-family="sans-serif" font-size="12">${assetItem.code}</text></svg>`;
    const url = URL.createObjectURL(new Blob([data], { type: "image/svg+xml" })); const link = document.createElement("a"); link.href = url; link.download = `${assetItem.qrId}.svg`; link.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="maintenance-page">
      <header className="maintenance-heading">
        <div><h1>Smart Maintenance</h1><p>QR-based campus maintenance operations</p></div>
        <div className="maintenance-actions"><button className="maintenance-scan-button" onClick={openEntry}><QrCode size={17} /> QR Maintenance</button><button className="maintenance-new-button" onClick={() => { setAsset(null); setDialog("new"); }}><Plus size={17} /> New Request</button></div>
      </header>

      <section className="maintenance-stats" aria-label="Maintenance request summary">
        <article className="maintenance-stat"><span className="maintenance-stat-title">TOTAL REQUESTS</span><span className="maintenance-stat-icon cyan"><Wrench size={19}/></span><strong>{counts.total}</strong><small>All time</small></article>
        <article className="maintenance-stat"><span className="maintenance-stat-title">PENDING</span><span className="maintenance-stat-icon amber"><AlertCircle size={19}/></span><strong>{counts.pending}</strong><small>Needs attention</small></article>
        <article className="maintenance-stat"><span className="maintenance-stat-title">IN PROGRESS</span><span className="maintenance-stat-icon blue"><Clock3 size={19}/></span><strong>{counts.progress}</strong><small>Being handled</small></article>
        <article className="maintenance-stat"><span className="maintenance-stat-title">RESOLVED</span><span className="maintenance-stat-icon green"><CheckCircle2 size={19}/></span><strong>{counts.resolved}</strong><small>This week</small></article>
      </section>

      <button className="maintenance-qr-banner" onClick={openEntry}><span className="maintenance-qr-icon"><QrCode size={22}/></span><span className="maintenance-qr-copy"><strong>QR-Based Maintenance Entry</strong><small>Scan the QR code attached to a room or equipment to report an issue.</small></span><ChevronRight className="maintenance-banner-arrow" size={19}/></button>

      <div className="maintenance-list-controls"><div className="maintenance-filters" role="tablist" aria-label="Filter maintenance requests">{filters.map((item) => <button key={item} role="tab" aria-selected={filter === item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><span>{filteredRequests.length} requests</span></div>

      <section className="maintenance-table-panel" aria-label="Maintenance staff requests"><div className="maintenance-table-scroll"><table className="maintenance-table"><thead><tr><th>REQUEST</th><th>LOCATION</th><th>EQUIPMENT</th><th>PRIORITY</th><th>REPORTED</th><th>ASSIGNED TO</th><th>STATUS</th><th aria-label="Details"/></tr></thead><tbody>
        {filteredRequests.map((request) => <tr key={request.id} onClick={() => setSelected(request)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && setSelected(request)}><td><strong>{request.request}</strong><small>{request.id}</small></td><td className="maintenance-location">{request.location}</td><td>{request.equipment}</td><td><span className={`maintenance-pill priority-${request.priority.toLowerCase()}`}>{request.priority}</span></td><td className="maintenance-reported">{request.reported}</td><td>{request.assigned}</td><td><span className={`maintenance-pill status-${statusClass(request.status)}`}>{request.status}</span></td><td className="maintenance-row-arrow"><ChevronRight size={17}/></td></tr>)}
      </tbody></table>{filteredRequests.length === 0 && <div className="maintenance-empty">No maintenance requests in this category.</div>}</div></section>

      <section className="maintenance-assets-panel"><header className="maintenance-assets-heading"><div><h2><QrCode size={18}/> Asset QR Codes</h2><p>Room and equipment labels connected to their Digital Twin records</p></div><span>ADMIN</span></header><div className="maintenance-asset-grid">{assetDirectory.map((item) => <article className="maintenance-asset-card" key={item.qrId}><div className="maintenance-asset-preview"><QrCode size={48} strokeWidth={1.4}/><small>{item.qrId}</small></div><div className="maintenance-asset-info"><strong>{item.equipment}</strong><span>{item.building} · Floor {item.floor}</span><span>{item.room} · {item.roomNumber}</span><small>QR Code ID: <b>{item.qrId}</b></small></div><div className="maintenance-asset-actions"><button onClick={() => setGenerated((value) => ({ ...value, [item.qrId]: true }))}><QrCode size={14}/>{generated[item.qrId] ? "Generated" : "Generate"}</button><button onClick={() => downloadAsset(item)}><Download size={14}/>Download</button><button onClick={() => window.print()}><Printer size={14}/>Print</button></div></article>)}</div></section>

      {dialog && <div className="maintenance-overlay" onMouseDown={(event) => event.target === event.currentTarget && setDialog(null)}>
        {dialog === "entry" && <section className="maintenance-dialog maintenance-flow-dialog"><button className="maintenance-dialog-close" aria-label="Close" onClick={() => setDialog(null)}><X size={18}/></button><span className="maintenance-dialog-icon"><QrCode size={20}/></span><h2>QR Maintenance</h2><p>Scan the QR code attached to a room or equipment to report an issue.</p><div className="maintenance-entry-actions"><button className="maintenance-primary-action" onClick={() => setDialog("scan")}><Camera size={18}/>Scan QR Code</button><button onClick={() => setDialog("manual")}><ClipboardList size={18}/>Enter / Upload QR Code</button></div><div className="maintenance-entry-note"><Building2 size={17}/><span>Each campus QR code opens the matching room and equipment in the Digital Twin.</span></div></section>}

        {dialog === "scan" && <section className="maintenance-dialog maintenance-scan-dialog maintenance-flow-dialog"><button className="maintenance-dialog-close" aria-label="Close" onClick={() => setDialog(null)}><X size={18}/></button><button className="maintenance-back-button" onClick={() => setDialog("entry")}><ArrowLeft size={15}/> QR Maintenance</button><span className="maintenance-dialog-icon"><QrCode size={20}/></span><h2>Scan QR Code</h2><p>Point your camera at the QR code attached to the room or equipment.</p><div className="maintenance-scanner"><span className="scanner-corner top-left"/><span className="scanner-corner top-right"/><span className="scanner-corner bottom-left"/><span className="scanner-corner bottom-right"/><div className="maintenance-camera-placeholder"><Camera size={31}/><span>Camera preview</span></div><i/></div><div className="maintenance-scan-actions"><button className="maintenance-primary-action" onClick={() => identifyAsset()}>Scan Demo QR Code</button><button onClick={() => setDialog("manual")}>Manual Code Entry</button><button onClick={() => setDialog(null)}>Cancel</button></div></section>}

        {dialog === "manual" && <section className="maintenance-dialog maintenance-flow-dialog"><button className="maintenance-dialog-close" aria-label="Close" onClick={() => setDialog(null)}><X size={18}/></button><button className="maintenance-back-button" onClick={() => setDialog("entry")}><ArrowLeft size={15}/> QR Maintenance</button><span className="maintenance-dialog-icon"><Upload size={19}/></span><h2>Enter QR Code</h2><p>Enter the code printed below the QR label, or upload an image of the code.</p><form onSubmit={findAsset}><label>QR code or asset ID<input value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="e.g. QR-CSE-204-P02" autoFocus/></label><label className="maintenance-upload-field"><Upload size={16}/>Upload QR image<input type="file" accept="image/*" onChange={() => identifyAsset()} /></label>{codeError && <span className="maintenance-code-error">{codeError}</span>}<div className="maintenance-dialog-actions"><button type="button" onClick={() => setDialog("scan")}>Back to scanner</button><button type="submit">Identify Asset</button></div></form></section>}

        {dialog === "asset" && asset && <section className="maintenance-dialog maintenance-flow-dialog"><button className="maintenance-dialog-close" aria-label="Close" onClick={() => setDialog(null)}><X size={18}/></button><span className="maintenance-dialog-icon"><Check size={20}/></span><h2>Asset Identified</h2><p className="maintenance-success-message">QR code successfully scanned. You are reporting an issue for this location/equipment.</p><div className="maintenance-asset-detail"><div><Building2 size={16}/><span>Building<strong>{asset.building}</strong></span></div><div><MapPin size={16}/><span>Floor / room<strong>Floor {asset.floor} · {asset.room} ({asset.roomNumber})</strong></span></div><div><Wrench size={16}/><span>Equipment<strong>{asset.equipment}</strong></span></div><div><ShieldCheck size={16}/><span>Current maintenance status<strong>{asset.status}</strong></span></div><div><CalendarDays size={16}/><span>Last maintenance<strong>{asset.lastMaintenance}</strong></span></div></div><div className="maintenance-dialog-actions"><button onClick={() => setDialog("manual")}>Change code</button><button type="button" onClick={startReport}>Report an Issue</button></div></section>}

        {(dialog === "report" || dialog === "new") && <form className="maintenance-dialog maintenance-flow-dialog" onSubmit={createRequest}><button className="maintenance-dialog-close" type="button" aria-label="Close" onClick={() => setDialog(null)}><X size={18}/></button><button className="maintenance-back-button" type="button" onClick={() => setDialog(asset ? "asset" : "entry")}><ArrowLeft size={15}/> Back</button><span className="maintenance-dialog-icon"><Wrench size={19}/></span><h2>Report Maintenance Issue</h2><p>Share a few details so the campus team can help.</p>{asset ? <div className="maintenance-readonly-asset"><MapPin size={15}/><span>{asset.roomNumber} · {asset.equipment}</span><small>Identified from QR code</small></div> : <div className="maintenance-form-row"><label>Location<input name="location" required placeholder="Building / room"/></label><label>Equipment<input name="equipment" placeholder="Room or equipment"/></label></div>}<label>Issue category<select name="category" defaultValue="Equipment"><option>Electrical</option><option>Furniture</option><option>Network</option><option>Equipment</option><option>Cleanliness</option><option>Other</option></select></label><label>Issue description<textarea name="description" required rows="3" placeholder="Briefly describe what needs attention"/></label><label>Priority<select name="priority" defaultValue="Medium"><option>Low</option><option>Medium</option><option>High</option></select></label><label>Optional image<input name="image" type="file" accept="image/*"/></label><label>Reporter name<input name="reporter" required defaultValue="Campus User"/></label><div className="maintenance-dialog-actions"><button type="button" onClick={() => setDialog(null)}>Cancel</button><button type="submit">Submit Report</button></div></form>}

        {dialog === "success" && submitted && <section className="maintenance-dialog maintenance-flow-dialog"><button className="maintenance-dialog-close" aria-label="Close" onClick={() => setDialog(null)}><X size={18}/></button><span className="maintenance-dialog-icon"><CheckCircle2 size={21}/></span><h2>Maintenance request submitted successfully.</h2><p>Your report is now in the campus maintenance queue.</p><dl className="maintenance-submission-summary"><div><dt>Request ID</dt><dd>{submitted.id}</dd></div><div><dt>Location</dt><dd>{submitted.location}</dd></div><div><dt>Equipment</dt><dd>{submitted.equipment}</dd></div><div><dt>Issue</dt><dd>{submitted.description}</dd></div><div><dt>Priority</dt><dd>{submitted.priority}</dd></div><div><dt>Submitted time</dt><dd>{submitted.submittedAt}</dd></div><div><dt>Current status</dt><dd><span className="maintenance-pill status-pending">Pending</span></dd></div></dl><div className="maintenance-dialog-actions"><button onClick={() => setDialog(null)}>Back to Maintenance</button><button type="button" onClick={viewSubmitted}>View Request</button></div></section>}
      </div>}

      {selected && <div className="maintenance-overlay" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><form className="maintenance-dialog maintenance-detail-dialog maintenance-staff-dialog" onSubmit={updateSelected}><button className="maintenance-dialog-close" type="button" aria-label="Close" onClick={() => setSelected(null)}><X size={18}/></button><span className="maintenance-dialog-id">{selected.id}</span><h2>{selected.request}</h2><span className={`maintenance-pill status-${statusClass(selected.status)}`}>{selected.status}</span><dl><div><dt>Location</dt><dd>{selected.location}</dd></div><div><dt>Equipment</dt><dd>{selected.equipment}</dd></div><div><dt>Category / issue</dt><dd>{selected.category}{selected.description ? ` · ${selected.description}` : ""}</dd></div><div><dt>Priority</dt><dd>{selected.priority}</dd></div><div><dt>Reported</dt><dd>{selected.reported}</dd></div><div><dt>Reporter</dt><dd>{selected.reporter}</dd></div></dl><h3>Staff actions</h3><label>Assign request<select name="assigned" defaultValue={selected.assigned}><option value="Unassigned">Unassigned</option>{teams.map((team) => <option key={team}>{team}</option>)}</select></label><label>Update status<select name="status" defaultValue={selected.status}>{["Pending", "Assigned", "In Progress", "Resolved"].map((status) => <option key={status}>{status}</option>)}</select></label><label>Resolution notes<textarea name="notes" rows="2" defaultValue={selected.notes} placeholder="Add work completed or resolution details"/></label><div className="maintenance-dialog-actions"><button type="button" onClick={() => setSelected(null)}>Close</button><button type="submit">Save Update</button><button type="button" onClick={() => { const done = { ...selected, status: "Resolved" }; setRequests((items) => items.map((item) => item.id === done.id ? done : item)); setSelected(done); }}>Mark Resolved</button></div></form></div>}
    </div>
  );
}

export default Maintenance;
