import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, RefreshCw, Search } from "lucide-react";
import { fetchPublishedNotices } from "../../api/student";

function StudentEvents() {
  const [notices, setNotices] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetchPublishedNotices().then((items) => {
      if (!active) return;
      setNotices(Array.isArray(items) ? items : []);
      setStatus("ready");
      setError("");
    }).catch((reason) => {
      if (!active) return;
      setStatus("error");
      setError(reason.message);
    });
    return () => { active = false; };
  }, [retryKey]);

  const filteredNotices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return notices.filter((notice) => !query || `${notice.title} ${notice.content}`.toLowerCase().includes(query));
  }, [notices, search]);

  return <div className="student-events-page">
    <div className="student-page-header"><div><h1>Events &amp; Notices</h1><p>Published campus notices from the college notice feed.</p></div></div>
    <label className="events-search"><Search size={17} /><span className="sr-only">Search notices</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search published notices" /></label>
    {status === "loading" && <p role="status">Loading published notices…</p>}
    {status === "error" && <div className="student-dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={() => setRetryKey((key) => key + 1)}><RefreshCw size={15} /> Retry</button></div>}
    {status === "ready" && filteredNotices.length === 0 && <div className="events-empty-state"><Bell size={30} /><h2>{notices.length ? "No matching notices" : "No published notices"}</h2><p>{notices.length ? "Try a different search." : "There are no current published notices in the database."}</p></div>}
    {status === "ready" && filteredNotices.length > 0 && <section className="student-live-notices" aria-label="Published notices">
      {filteredNotices.map((notice) => <article className="student-live-notice" key={notice.id}>
        <div><Bell size={18} /><span>Published notice</span></div>
        <h2>{notice.title}</h2><p>{notice.content}</p>
        <small><CalendarDays size={14} /> Notice created {notice.created_at ? new Date(notice.created_at).toLocaleString() : "date unavailable"}</small>
      </article>)}
    </section>}
    <p className="student-dashboard-data-note">The existing database has notices but no separate event schedule model. Event listings will appear after an event source is implemented.</p>
  </div>;
}

export default StudentEvents;
