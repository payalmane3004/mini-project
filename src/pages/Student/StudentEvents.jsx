import { useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  Clock,
  MapPin,
  Search,
  Megaphone,
  GraduationCap,
  Wrench,
  Users,
  ChevronRight,
  X,
} from "lucide-react";

const notices = [
  {
    id: 1,
    title: "Mid-Semester Examination Schedule Released",
    category: "Academic",
    date: "2026-10-04",
    time: "10:00 AM",
    location: "Academic Section",
    description:
      "The mid-semester examination timetable has been released. Students are requested to check their respective department schedules and examination rooms.",
    important: true,
  },
  {
    id: 2,
    title: "Annual Technical Festival Registration Open",
    category: "Events",
    date: "2026-10-08",
    time: "9:30 AM",
    location: "Main Auditorium",
    description:
      "Registration for the annual technical festival is now open. Students can register for workshops, competitions and technical events.",
    important: false,
  },
  {
    id: 3,
    title: "Library Timing Extended During Examination Week",
    category: "General",
    date: "2026-10-06",
    time: "8:00 AM",
    location: "Central Library",
    description:
      "The Central Library will remain open until 10:00 PM during the examination preparation period.",
    important: false,
  },
  {
    id: 4,
    title: "Campus Wi-Fi Maintenance Scheduled",
    category: "Maintenance",
    date: "2026-10-09",
    time: "11:00 PM",
    location: "Entire Campus",
    description:
      "Scheduled maintenance of the campus network infrastructure will take place. Internet services may be temporarily unavailable.",
    important: false,
  },
  {
    id: 5,
    title: "Student Council Meeting",
    category: "Events",
    date: "2026-10-11",
    time: "4:00 PM",
    location: "Student Activity Center",
    description:
      "The Student Council will conduct its monthly meeting. Student representatives are requested to attend.",
    important: false,
  },
  {
    id: 6,
    title: "Scholarship Application Deadline Extended",
    category: "Academic",
    date: "2026-10-12",
    time: "5:00 PM",
    location: "Student Section",
    description:
      "The deadline for submitting scholarship applications has been extended. Students should submit all required documents before the revised deadline.",
    important: true,
  },
];

const categoryIcons = {
  Academic: GraduationCap,
  Events: Users,
  Maintenance: Wrench,
  General: Bell,
};

function StudentEvents() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedNotice, setSelectedNotice] = useState(null);

  const categories = ["All", "Academic", "Events", "Maintenance", "General"];

  const filteredNotices = useMemo(() => {
    return notices.filter((notice) => {
      const matchesCategory =
        activeCategory === "All" ||
        notice.category === activeCategory;

      const searchText = search.toLowerCase();

      const matchesSearch =
        notice.title.toLowerCase().includes(searchText) ||
        notice.description.toLowerCase().includes(searchText) ||
        notice.category.toLowerCase().includes(searchText);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, search]);

  return (
    <div className="student-events-page">
      <div className="student-page-header">
        <div>
          <h1>Events & Notices</h1>
          <p>
            Stay updated with important campus announcements and events.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="events-toolbar">
        <div className="events-search">
          <Search size={17} />

          <input
            type="text"
            placeholder="Search notices and events..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="events-filters">
          {categories.map((category) => (
            <button
              key={category}
              className={activeCategory === category ? "active" : ""}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Important notice */}
      {notices
        .filter((notice) => notice.important)
        .slice(0, 1)
        .map((notice) => {
          const Icon = categoryIcons[notice.category] || Bell;

          return (
            <div className="featured-notice" key={notice.id}>
              <div className="featured-notice-icon">
                <Icon size={22} />
              </div>

              <div className="featured-notice-content">
                <span>Important Notice</span>
                <h2>{notice.title}</h2>
                <p>{notice.description}</p>

                <div className="featured-notice-meta">
                  <span>
                    <CalendarDays size={14} />
                    {notice.date}
                  </span>

                  <span>
                    <MapPin size={14} />
                    {notice.location}
                  </span>
                </div>
              </div>

              <button
                className="featured-notice-button"
                onClick={() => setSelectedNotice(notice)}
              >
                Read More
                <ChevronRight size={16} />
              </button>
            </div>
          );
        })}

      {/* Notice list */}
      <section className="events-list-section">
        <div className="events-list-header">
          <div>
            <h2>Latest Updates</h2>
            <p>{filteredNotices.length} notices found</p>
          </div>
        </div>

        <div className="student-events-grid">
          {filteredNotices.map((notice) => {
            const Icon = categoryIcons[notice.category] || Bell;

            return (
              <article className="student-event-card" key={notice.id}>
                <div className="event-card-top">
                  <div className="event-icon">
                    <Icon size={19} />
                  </div>

                  <span
                    className={`event-category ${notice.category.toLowerCase()}`}
                  >
                    {notice.category}
                  </span>
                </div>

                <h3>{notice.title}</h3>

                <p className="event-description">
                  {notice.description}
                </p>

                <div className="event-meta">
                  <span>
                    <CalendarDays size={14} />
                    {notice.date}
                  </span>

                  <span>
                    <Clock size={14} />
                    {notice.time}
                  </span>

                  <span>
                    <MapPin size={14} />
                    {notice.location}
                  </span>
                </div>

                <button
                  className="event-read-button"
                  onClick={() => setSelectedNotice(notice)}
                >
                  View Details
                  <ChevronRight size={15} />
                </button>
              </article>
            );
          })}
        </div>

        {filteredNotices.length === 0 && (
          <div className="events-empty-state">
            <Bell size={30} />
            <h3>No notices found</h3>
            <p>
              Try changing the search text or selecting another category.
            </p>
          </div>
        )}
      </section>

      {/* Details modal */}
      {selectedNotice && (
        <div
          className="notice-modal-overlay"
          onClick={() => setSelectedNotice(null)}
        >
          <div
            className="notice-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="notice-modal-header">
              <div className="notice-modal-title">
                <span>{selectedNotice.category}</span>
                <h2>{selectedNotice.title}</h2>
              </div>

              <button
                className="notice-modal-close"
                onClick={() => setSelectedNotice(null)}
              >
                <X size={19} />
              </button>
            </div>

            <div className="notice-modal-meta">
              <span>
                <CalendarDays size={15} />
                {selectedNotice.date}
              </span>

              <span>
                <Clock size={15} />
                {selectedNotice.time}
              </span>

              <span>
                <MapPin size={15} />
                {selectedNotice.location}
              </span>
            </div>

            <div className="notice-modal-body">
              <p>{selectedNotice.description}</p>
            </div>

            <button
              className="notice-modal-done"
              onClick={() => setSelectedNotice(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentEvents;