import { useMemo, useState } from "react";
import {
  Building2,
  Users,
  Thermometer,
  Lightbulb,
  Snowflake,
  Monitor,
  DoorOpen,
} from "lucide-react";

const buildings = [
  {
    id: 1,
    name: "CSE Building",
    code: "CSE",
    floors: 4,
  },
  {
    id: 2,
    name: "Mechanical Block",
    code: "ME",
    floors: 3,
  },
  {
    id: 3,
    name: "Central Library",
    code: "LIB",
    floors: 3,
  },
];

const rooms = [
  {
    id: 101,
    buildingId: 1,
    floorId: 1,
    number: "CSE-101",
    type: "Classroom",
    capacity: 60,
    occupancy: 42,
    status: "Occupied",
    temperature: 24.2,
    lights: "On",
    ac: "On",
    projector: "Online",
  },
  {
    id: 102,
    buildingId: 1,
    floorId: 1,
    number: "CSE-102",
    type: "Classroom",
    capacity: 60,
    occupancy: 0,
    status: "Available",
    temperature: 23.5,
    lights: "Off",
    ac: "Off",
    projector: "Online",
  },
  {
    id: 103,
    buildingId: 1,
    floorId: 1,
    number: "CSE-103",
    type: "Lab",
    capacity: 40,
    occupancy: 28,
    status: "Occupied",
    temperature: 23.8,
    lights: "On",
    ac: "On",
    projector: "Online",
  },
  {
    id: 201,
    buildingId: 1,
    floorId: 2,
    number: "CSE-201",
    type: "Classroom",
    capacity: 70,
    occupancy: 55,
    status: "Occupied",
    temperature: 24.6,
    lights: "On",
    ac: "On",
    projector: "Online",
  },
  {
    id: 202,
    buildingId: 1,
    floorId: 2,
    number: "CSE-202",
    type: "Classroom",
    capacity: 50,
    occupancy: 0,
    status: "Available",
    temperature: 22.9,
    lights: "Off",
    ac: "Off",
    projector: "Online",
  },
  {
    id: 301,
    buildingId: 1,
    floorId: 3,
    number: "CSE-301",
    type: "Project Room",
    capacity: 20,
    occupancy: 8,
    status: "Occupied",
    temperature: 24.1,
    lights: "On",
    ac: "On",
    projector: "Online",
  },
  {
    id: 401,
    buildingId: 1,
    floorId: 4,
    number: "CSE-401",
    type: "Seminar Hall",
    capacity: 100,
    occupancy: 0,
    status: "Available",
    temperature: 23.2,
    lights: "Off",
    ac: "Off",
    projector: "Online",
  },
  {
    id: 4011,
    buildingId: 2,
    floorId: 1,
    number: "ME-101",
    type: "Classroom",
    capacity: 60,
    occupancy: 36,
    status: "Occupied",
    temperature: 25.1,
    lights: "On",
    ac: "On",
    projector: "Online",
  },
  {
    id: 4012,
    buildingId: 2,
    floorId: 1,
    number: "ME-102",
    type: "Workshop",
    capacity: 40,
    occupancy: 0,
    status: "Available",
    temperature: 24.4,
    lights: "Off",
    ac: "Off",
    projector: "Offline",
  },
  {
    id: 4013,
    buildingId: 3,
    floorId: 1,
    number: "LIB-101",
    type: "Reading Hall",
    capacity: 120,
    occupancy: 78,
    status: "Occupied",
    temperature: 23.7,
    lights: "On",
    ac: "On",
    projector: "Online",
  },
];

function StudentRooms() {
  const [selectedBuilding, setSelectedBuilding] = useState(1);
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [selectedRoom, setSelectedRoom] = useState(null);

  const building = buildings.find(
    (item) => item.id === Number(selectedBuilding)
  );

  const filteredRooms = useMemo(() => {
    return rooms.filter(
      (room) =>
        room.buildingId === Number(selectedBuilding) &&
        room.floorId === Number(selectedFloor)
    );
  }, [selectedBuilding, selectedFloor]);

  const handleBuildingChange = (event) => {
    const buildingId = Number(event.target.value);

    setSelectedBuilding(buildingId);
    setSelectedFloor(1);
    setSelectedRoom(null);
  };

  return (
    <div className="student-rooms-page">
      <div className="student-page-header">
        <div>
          <h1>Floors & Rooms</h1>
          <p>
            Explore buildings, floors and individual rooms across the campus.
          </p>
        </div>
      </div>

      <section className="student-room-controls">
        <div className="room-building-select">
          <label>Select Building</label>

          <div className="select-wrapper">
            <Building2 size={18} />

            <select
              value={selectedBuilding}
              onChange={handleBuildingChange}
            >
              {buildings.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="room-building-info">
          <span>{building?.code}</span>
          <strong>{building?.name}</strong>
          <small>{building?.floors} floors</small>
        </div>
      </section>

      <section className="student-floor-tabs">
        {Array.from({ length: building?.floors || 1 }, (_, index) => {
          const floorNumber = index + 1;

          const roomCount = rooms.filter(
            (room) =>
              room.buildingId === Number(selectedBuilding) &&
              room.floorId === floorNumber
          ).length;

          return (
            <button
              key={floorNumber}
              className={
                selectedFloor === floorNumber ? "active" : ""
              }
              onClick={() => {
                setSelectedFloor(floorNumber);
                setSelectedRoom(null);
              }}
            >
              <span>Floor {floorNumber}</span>
              <small>{roomCount} rooms</small>
            </button>
          );
        })}
      </section>

      <section className="student-rooms-section">
        <div className="rooms-section-heading">
          <div>
            <h2>Rooms</h2>
            <p>
              {building?.name} · Floor {selectedFloor}
            </p>
          </div>

          <div className="room-count">
            {filteredRooms.length} rooms
          </div>
        </div>

        <div className="student-room-grid">
          {filteredRooms.map((room) => (
            <button
              key={room.id}
              className={`student-room-card ${
                selectedRoom?.id === room.id ? "selected" : ""
              }`}
              onClick={() => setSelectedRoom(room)}
            >
              <div className="room-card-top">
                <div className="room-icon">
                  <DoorOpen size={20} />
                </div>

                <span
                  className={`room-status ${
                    room.status.toLowerCase()
                  }`}
                >
                  {room.status}
                </span>
              </div>

              <h3>{room.number}</h3>
              <p>{room.type}</p>

              <div className="room-occupancy">
                <Users size={15} />

                <span>
                  {room.occupancy} / {room.capacity}
                </span>

                <small>people</small>
              </div>
            </button>
          ))}
        </div>
      </section>

      {selectedRoom && (
        <section className="room-details-panel">
          <div className="room-details-header">
            <div>
              <span className="room-detail-code">
                {selectedRoom.type}
              </span>

              <h2>{selectedRoom.number}</h2>

              <p>
                {building?.name} · Floor {selectedRoom.floorId}
              </p>
            </div>

            <span
              className={`room-status large ${
                selectedRoom.status.toLowerCase()
              }`}
            >
              {selectedRoom.status}
            </span>
          </div>

          <div className="room-detail-grid">
            <div className="room-detail-item">
              <Users size={19} />
              <div>
                <span>Occupancy</span>
                <strong>
                  {selectedRoom.occupancy} / {selectedRoom.capacity}
                </strong>
              </div>
            </div>

            <div className="room-detail-item">
              <Thermometer size={19} />
              <div>
                <span>Temperature</span>
                <strong>{selectedRoom.temperature}°C</strong>
              </div>
            </div>

            <div className="room-detail-item">
              <Lightbulb size={19} />
              <div>
                <span>Lights</span>
                <strong>{selectedRoom.lights}</strong>
              </div>
            </div>

            <div className="room-detail-item">
              <Snowflake size={19} />
              <div>
                <span>Air Conditioning</span>
                <strong>{selectedRoom.ac}</strong>
              </div>
            </div>

            <div className="room-detail-item">
              <Monitor size={19} />
              <div>
                <span>Projector</span>
                <strong>{selectedRoom.projector}</strong>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default StudentRooms;