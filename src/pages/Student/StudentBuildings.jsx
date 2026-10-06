import { useState } from "react";
import {
  Building2,
  Search,
  Layers3,
  DoorOpen,
  MapPin,
  Wifi,
  Monitor,
  FlaskConical,
  Library,
  ChevronRight,
} from "lucide-react";

const buildings = [
  {
    id: 1,
    name: "CSE Building",
    code: "CSE",
    type: "Academic",
    description:
      "Computer Science and Engineering academic building with classrooms, laboratories and project spaces.",
    floors: 4,
    rooms: 68,
    location: "Academic Campus",
    facilities: ["Computer Labs", "Classrooms", "Wi-Fi", "Project Rooms"],
    icon: Monitor,
  },
  {
    id: 2,
    name: "Mechanical Block",
    code: "ME",
    type: "Academic",
    description:
      "Mechanical Engineering block containing classrooms, laboratories and workshop facilities.",
    floors: 3,
    rooms: 74,
    location: "Academic Campus",
    facilities: ["Labs", "Workshop", "Classrooms", "Wi-Fi"],
    icon: Building2,
  },
  {
    id: 3,
    name: "Central Library",
    code: "LIB",
    type: "Academic",
    description:
      "Central library with reading areas, digital resources and student study spaces.",
    floors: 3,
    rooms: 42,
    location: "Central Campus",
    facilities: ["Reading Hall", "Digital Library", "Wi-Fi", "Study Rooms"],
    icon: Library,
  },
  {
    id: 4,
    name: "Electrical Engineering",
    code: "EE",
    type: "Academic",
    description:
      "Electrical Engineering building with specialized laboratories and classrooms.",
    floors: 3,
    rooms: 56,
    location: "Academic Campus",
    facilities: ["Electrical Labs", "Classrooms", "Project Rooms", "Wi-Fi"],
    icon: FlaskConical,
  },
  {
    id: 5,
    name: "Admin Block",
    code: "ADM",
    type: "Administration",
    description:
      "Administrative building containing college offices and student service facilities.",
    floors: 2,
    rooms: 31,
    location: "Main Campus",
    facilities: ["Student Services", "Accounts", "Office", "Help Desk"],
    icon: Building2,
  },
  {
    id: 6,
    name: "Workshop",
    code: "WS",
    type: "Laboratory",
    description:
      "Practical workshop facility used for engineering activities and hands-on learning.",
    floors: 2,
    rooms: 28,
    location: "Workshop Area",
    facilities: ["Workshop", "Machines", "Labs", "Safety Equipment"],
    icon: FlaskConical,
  },
];

function StudentBuildings() {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("All");

  const filteredBuildings = buildings.filter((building) => {
    const matchesSearch =
      building.name.toLowerCase().includes(search.toLowerCase()) ||
      building.code.toLowerCase().includes(search.toLowerCase());

    const matchesType =
      selectedType === "All" || building.type === selectedType;

    return matchesSearch && matchesType;
  });

  return (
    <div className="student-buildings-page">

      {/* HEADER */}

      <div className="student-page-header">
        <div>
          <p className="page-label">CAMPUS DIRECTORY</p>

          <h1>Buildings</h1>

          <p>
            Explore campus buildings, facilities, floors and rooms.
          </p>
        </div>
      </div>

      {/* SEARCH + FILTER */}

      <div className="student-building-toolbar">

        <div className="student-building-search">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search buildings..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="student-building-filters">

          {["All", "Academic", "Administration", "Laboratory"].map(
            (type) => (
              <button
                key={type}
                className={
                  selectedType === type
                    ? "active"
                    : ""
                }
                onClick={() => setSelectedType(type)}
              >
                {type}
              </button>
            )
          )}

        </div>
      </div>

      {/* BUILDING COUNT */}

      <div className="student-building-result">
        <span>
          Showing <strong>{filteredBuildings.length}</strong> buildings
        </span>
      </div>

      {/* BUILDING GRID */}

      {filteredBuildings.length > 0 ? (
        <div className="student-building-grid">

          {filteredBuildings.map((building) => {
            const Icon = building.icon;

            return (
              <div
                className="student-building-card"
                key={building.id}
              >

                <div className="student-building-card-top">

                  <div className="student-building-icon">
                    <Icon size={24} />
                  </div>

                  <span className="student-building-code">
                    {building.code}
                  </span>

                </div>

                <h2>{building.name}</h2>

                <span className="student-building-type">
                  {building.type}
                </span>

                <p className="student-building-description">
                  {building.description}
                </p>

                {/* LOCATION */}

                <div className="student-building-location">
                  <MapPin size={15} />
                  <span>{building.location}</span>
                </div>

                {/* STATS */}

                <div className="student-building-stats">

                  <div>
                    <Layers3 size={17} />

                    <span>
                      <strong>{building.floors}</strong>
                      Floors
                    </span>
                  </div>

                  <div>
                    <DoorOpen size={17} />

                    <span>
                      <strong>{building.rooms}</strong>
                      Rooms
                    </span>
                  </div>

                </div>

                {/* FACILITIES */}

                <div className="student-facilities">

                  {building.facilities.slice(0, 3).map(
                    (facility) => (
                      <span key={facility}>
                        {facility}
                      </span>
                    )
                  )}

                  {building.facilities.length > 3 && (
                    <span>
                      +{building.facilities.length - 3}
                    </span>
                  )}

                </div>

                {/* BUTTON */}

                <button
                  className="student-explore-button"
                  onClick={() =>
                    console.log(
                      "Explore building:",
                      building.name
                    )
                  }
                >
                  Explore Building
                  <ChevronRight size={17} />
                </button>

              </div>
            );
          })}

        </div>
      ) : (
        <div className="student-building-empty">
          <Building2 size={40} />

          <h2>No buildings found</h2>

          <p>
            Try changing your search or selecting another category.
          </p>
        </div>
      )}

    </div>
  );
}

export default StudentBuildings;