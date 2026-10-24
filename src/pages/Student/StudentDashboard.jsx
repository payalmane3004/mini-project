import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Bell, Box, Building2, CalendarDays, Clock3, DoorOpen,
  Map as MapIcon, RefreshCw, Search, Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { fetchBuildings, fetchRooms } from "../../api/buildings";
import { fetchMyBookings, fetchPublishedEmergencyAlerts, fetchPublishedNotices } from "../../api/student";
import { dashboardListState, dashboardLoadingState } from "./dashboardData";
import "./StudentDashboard.css";

const quickLinks = [
  { label: "Buildings", description: "Browse the campus directory", to: "/student-buildings", icon: Building2 },
  { label: "Rooms", description: "Explore verified room records", to: "/student-rooms", icon: DoorOpen },
  { label: "Digital Twin", description: "Explore CAD building footprints", to: "/student-digital-twin", icon: Box },
  { label: "Campus map", description: "Open the illustrative map", to: "/student-map", icon: MapIcon },
  { label: "Room booking", description: "View or request bookings", to: "/student-booking", icon: CalendarDays },
  { label: "Events & notices", description: "Read published notices", to: "/student-events", icon: Bell },
  { label: "Emergency", description: "View published safety alerts", to: "/student-emergency", icon: AlertTriangle },
];

const initialData = {
  buildings: dashboardLoadingState(), rooms: dashboardLoadingState(), bookings: dashboardLoadingState(),
  notices: dashboardLoadingState(), alerts: dashboardLoadingState(),
};
const numberFormat = new Intl.NumberFormat();

function InventoryStat({ icon: Icon, label, state, emptyText }) {
  return <article className="student-stat-card" aria-live="polite">
    <div className="student-stat-icon"><Icon size={21} aria-hidden="true" /></div>
    <div><span>{label}</span>
      <strong>{state.status === "loading" ? "…" : state.status === "error" ? "Unavailable" : numberFormat.format(state.data.length)}</strong>
      <small className="student-stat-detail">{state.status === "loading" ? "Loading records…" : state.status === "error" ? state.error : state.data.length ? "Current database records" : emptyText}</small>
    </div>
  </article>;
}

function StudentDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(initialData);
  const [retryKey, setRetryKey] = useState(0);
  const [query, setQuery] = useState("");
  const firstName = user?.full_name?.trim().split(/\s+/)[0] || "there";

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      fetchBuildings(), fetchRooms(), fetchMyBookings(), fetchPublishedNotices(), fetchPublishedEmergencyAlerts(),
    ]).then(([buildings, rooms, bookings, notices, alerts]) => {
      if (!active) return;
      setData({
        buildings: dashboardListState(buildings, "buildings"), rooms: dashboardListState(rooms, "rooms"),
        bookings: dashboardListState(bookings, "your bookings"), notices: dashboardListState(notices, "published notices"),
        alerts: dashboardListState(alerts, "emergency alerts"),
      });
    });
    return () => { active = false; };
  }, [retryKey]);

  const buildings = data.buildings.data;
  const rooms = data.rooms.data;
  const buildingById = useMemo(() => new Map(buildings.map((building) => [building.id, building])), [buildings]);
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    const buildingMatches = buildings.filter((building) => `${building.name || ""} ${building.building_code || ""} ${building.description || ""}`.toLocaleLowerCase().includes(normalized))
      .map((building) => ({ kind: "Building", key: `building-${building.id}`, title: building.name, detail: building.building_code || "Building code unavailable", to: `/student-buildings` }));
    const roomMatches = rooms.filter((room) => {
      const building = buildingById.get(room.building_id);
      return `${room.room_code || ""} ${room.name || ""} ${room.room_type || ""} ${building?.name || ""} ${building?.building_code || ""}`.toLocaleLowerCase().includes(normalized);
    }).map((room) => {
      const building = buildingById.get(room.building_id);
      const params = building?.building_code ? `?building=${encodeURIComponent(building.building_code)}` : "";
      return { kind: "Room", key: `room-${room.id}`, title: room.room_name || room.name || room.room_code, detail: `${room.room_code}${building ? ` · ${building.name}` : " · Building information unavailable"} · Floor ${room.floor_number}`, to: `/student-rooms${params}` };
    });
    return [...buildingMatches, ...roomMatches].slice(0, 8);
  }, [buildings, buildingById, query, rooms]);

  const activeBookings = useMemo(() => data.bookings.data
    .filter((booking) => ["PENDING", "APPROVED"].includes(String(booking.status).toUpperCase()) && new Date(booking.end_time) >= new Date())
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time)), [data.bookings.data]);
  const errors = Object.values(data).filter((item) => item.status === "error");
  const readyForSearch = data.buildings.status === "ready" && data.rooms.status === "ready";

  return <main className="student-dashboard student-dashboard-upgrade">
    <header className="student-header student-dashboard-hero">
      <div><p className="page-label">STUDENT PORTAL</p><h1>Welcome, {firstName}</h1><p>Your campus overview, updates, and shortcuts in one place.</p></div>
      <Link className="student-dashboard-emergency-link" to="/student-emergency"><AlertTriangle size={17} /> Safety information</Link>
    </header>

    <section className="student-stats" aria-label="Your campus snapshot">
      <InventoryStat icon={Building2} label="Buildings" state={data.buildings} emptyText="No building records found" />
      <InventoryStat icon={DoorOpen} label="Verified rooms" state={data.rooms} emptyText="No verified room records yet" />
      <InventoryStat icon={CalendarDays} label="My upcoming bookings" state={data.bookings.status === "ready" ? { ...data.bookings, data: activeBookings } : data.bookings} emptyText="No upcoming bookings" />
      <InventoryStat icon={Bell} label="Published notices" state={data.notices} emptyText="No current published notices" />
    </section>

    {errors.length > 0 && <div className="student-dashboard-error" role="alert">
      <div><strong>Some dashboard information could not be loaded.</strong><span>{errors.map((item) => item.error).join(" ")}</span></div>
      <button type="button" onClick={() => { setData(initialData); setRetryKey((key) => key + 1); }}><RefreshCw size={15} /> Retry</button>
    </div>}

    <section className="student-panel student-dashboard-finder">
      <div className="student-panel-header"><div><h2>Find a building or room</h2><p>Search the current database directory.</p></div><Search size={20} aria-hidden="true" /></div>
      <label className="student-finder-input"><span className="sr-only">Search buildings and verified rooms</span><Search size={17} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try a building name, code, or room code" /></label>
      {!readyForSearch && <p className="student-dashboard-muted" role="status">Directory search becomes available when building and room records load.</p>}
      {readyForSearch && query.trim() && matches.length === 0 && <p className="student-dashboard-muted">No matching building or verified room records.</p>}
      {readyForSearch && matches.length > 0 && <ul className="student-finder-results">{matches.map((match) => <li key={match.key}><Link to={match.to}><span className="student-finder-kind">{match.kind}</span><span><strong>{match.title || "Name unavailable"}</strong><small>{match.detail}</small></span><span aria-hidden="true">›</span></Link></li>)}</ul>}
      {readyForSearch && !query.trim() && <p className="student-dashboard-muted">Search results use database records. CAD annotations are not room inventory.</p>}
    </section>

    <section className="student-panel student-campus-links">
      <div className="student-panel-header"><div><h2>Campus quick access</h2><p>Open a student page for common campus tasks.</p></div><MapIcon size={20} aria-hidden="true" /></div>
      <nav className="student-quick-actions" aria-label="Campus quick access">
        {quickLinks.map(({ label, description, to, icon: Icon }) => <Link to={to} key={to}><Icon size={20} aria-hidden="true" /><span><strong>{label}</strong><small>{description}</small></span></Link>)}
      </nav>
    </section>

    <div className="student-dashboard-grid student-dashboard-content-grid">
      <section className="student-panel"><div className="student-panel-header"><div><h2>My next bookings</h2><p>Pending and approved bookings from your account.</p></div><CalendarDays size={20} aria-hidden="true" /></div>
        {data.bookings.status === "loading" && <p role="status">Loading your bookings…</p>}
        {data.bookings.status === "error" && <p className="student-dashboard-muted">Your booking list is unavailable right now.</p>}
        {data.bookings.status === "ready" && activeBookings.length === 0 && <p className="student-dashboard-muted">You have no upcoming pending or approved bookings.</p>}
        {data.bookings.status === "ready" && activeBookings.slice(0, 3).map((booking) => <article className="student-dashboard-list-item" key={booking.id}><div><strong>{booking.room_code || "Room unavailable"}</strong><small>{booking.building_code || "Building unavailable"} · {String(booking.status).toLowerCase()}</small></div><span><Clock3 size={14} />{new Date(booking.start_time).toLocaleString()}</span></article>)}
        <Link className="student-link-button" to="/student-booking">Open Room Booking</Link>
      </section>
      <section className="student-panel"><div className="student-panel-header"><div><h2>Campus notices</h2><p>Currently published notices</p></div><Bell size={20} aria-hidden="true" /></div>
        {data.notices.status === "loading" && <p role="status">Loading published notices…</p>}
        {data.notices.status === "error" && <p className="student-dashboard-muted">Published notices are unavailable right now.</p>}
        {data.notices.status === "ready" && data.notices.data.length === 0 && <p className="student-dashboard-muted">There are no current published notices.</p>}
        {data.notices.status === "ready" && data.notices.data.slice(0, 3).map((notice) => <article className="student-dashboard-list-item" key={notice.id}><div><strong>{notice.title}</strong><small>{notice.created_at ? `Notice created ${new Date(notice.created_at).toLocaleDateString()}` : "Date unavailable"}</small></div></article>)}
        <Link className="student-link-button" to="/student-events">Open Events &amp; Notices</Link>
      </section>
      <section className="student-panel"><div className="student-panel-header"><div><h2>Emergency alerts</h2><p>Active published alerts</p></div><AlertTriangle size={20} aria-hidden="true" /></div>
        {data.alerts.status === "loading" && <p role="status">Loading published alerts…</p>}
        {data.alerts.status === "error" && <p className="student-dashboard-muted">Published alerts are unavailable right now.</p>}
        {data.alerts.status === "ready" && data.alerts.data.length === 0 && <p className="student-dashboard-muted">No active published alerts.</p>}
        {data.alerts.status === "ready" && data.alerts.data.slice(0, 2).map((alert) => <article className="student-dashboard-list-item" key={alert.id}><div><strong>{alert.title}</strong><small>{alert.severity} · active published alert</small></div></article>)}
        <Link className="student-link-button" to="/student-emergency">View safety information</Link>
      </section>
      <section className="student-panel student-dashboard-data-limits"><div className="student-panel-header"><div><h2>Live campus data</h2><p>Availability and usage indicators</p></div><Zap size={20} aria-hidden="true" /></div>
        <p><strong>Room availability</strong><span>Unavailable: there is no reliable live availability feed.</span></p>
        <p><strong>Occupancy and energy</strong><span>Unavailable to student accounts. Existing data endpoints require admin access.</span></p>
        <p><strong>Events</strong><span>No separate event schedule source is configured; published notices are shown above.</span></p>
      </section>
    </div>
    <p className="student-dashboard-data-note">Counts, notices, alerts, and your bookings come from authenticated APIs. The campus map is illustrative; room search uses database room records only. Emergency contacts still require college verification.</p>
  </main>;
}

export default StudentDashboard;
