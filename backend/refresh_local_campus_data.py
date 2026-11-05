"""Refresh only the marked local SQLite fixture's fictional campus records.

User rows, password hashes, and reading values/sources are preserved. This
command refuses production databases and unmarked or modified fixtures.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import inspect
from sqlalchemy.orm import Session

from database import DATABASE_ENVIRONMENT, USES_APPROVED_DEMO_FIXTURE, engine
from demo_mode import DemoDatabaseError, is_active_demo_engine, require_approved_demo_engine
import models


BUILDINGS = [
    ("MAIN", "Main Academic Building"),
    ("ENGR", "Engineering Block"),
    ("COMP", "Computer Science Block"),
    ("LIB", "Library Building"),
    ("ADMIN", "Administrative Block"),
    ("MECH", "Mechanical Engineering Block"),
    ("ELEC", "Electrical Engineering Block"),
    ("SCI", "Science and Research Block"),
    ("STUD", "Student Services Building"),
    ("CAMP", "Campus Activities Centre"),
]
ROOMS = [
    ("Computer Laboratory 1", "LAB", 36),
    ("Computer Laboratory 2", "LAB", 32),
    ("Seminar Hall", "SEMINAR", 80),
    ("Lecture Hall 101", "LECTURE", 90),
    ("Faculty Room", "OFFICE", 12),
    ("Student Discussion Room", "MEETING", 16),
    ("Electronics Laboratory", "LAB", 28),
    ("Mechanical Workshop", "WORKSHOP", 24),
]
BOOKINGS = [
    ("Laboratory Session", "APPROVED"),
    ("Project Review Meeting", "PENDING"),
    ("Seminar Hall Reservation", "APPROVED"),
    ("Project Review Meeting", "APPROVED"),
    ("Faculty Meeting", "PENDING"),
    ("Project Review Meeting", "CANCELLED"),
    ("Laboratory Session", "APPROVED"),
    ("Student Technical Workshop", "REJECTED"),
    ("Laboratory Session", "APPROVED"),
    ("Laboratory Session", "PENDING"),
    ("Seminar Hall Reservation", "APPROVED"),
    ("Project Review Meeting", "PENDING"),
]
MAINTENANCE = [
    ("Electrical equipment inspection", "Fictional maintenance record for the computer laboratory electrical safety checklist.", "MEDIUM", "OPEN"),
    ("Classroom lighting repair", "Fictional maintenance record for a lighting repair review in Lecture Hall 101.", "MEDIUM", "IN_PROGRESS"),
    ("Laboratory equipment maintenance", "Fictional scheduled equipment inspection for the electronics laboratory.", "LOW", "RESOLVED"),
    ("Air conditioning maintenance", "Fictional maintenance record for routine air conditioning service in Computer Laboratory 2.", "MEDIUM", "OPEN"),
    ("Network connectivity issue", "Fictional maintenance record for a connectivity review in the faculty room.", "HIGH", "IN_PROGRESS"),
    ("Projector maintenance", "Fictional maintenance record for a projector and presentation system check in the mechanical workshop.", "LOW", "OPEN"),
    ("Plumbing inspection", "Check washroom fixtures and water supply connections during the routine facilities inspection.", "MEDIUM", "OPEN"),
]


def main():
    if DATABASE_ENVIRONMENT != "development" or not USES_APPROVED_DEMO_FIXTURE:
        raise DemoDatabaseError("Campus data refresh is limited to the approved local SQLite fixture.")
    require_approved_demo_engine(engine)
    if not is_active_demo_engine(engine):
        raise DemoDatabaseError("The local SQLite fixture marker is missing or invalid.")
    inspector = inspect(engine)
    required = {"users", "buildings", "rooms", "room_bookings", "maintenance_requests", "building_floor_labels", "campussphere_demo_metadata"}
    if not required.issubset(inspector.get_table_names()):
        raise DemoDatabaseError("The local fixture schema is incomplete.")

    with Session(engine) as db, db.begin():
        buildings = db.query(models.Building).order_by(models.Building.id).all()
        rooms = db.query(models.Room).order_by(models.Room.id).all()
        bookings = db.query(models.RoomBooking).order_by(models.RoomBooking.id).all()
        maintenance = db.query(models.MaintenanceRequest).order_by(models.MaintenanceRequest.id).all()
        labels = db.query(models.BuildingFloorLabel).order_by(models.BuildingFloorLabel.id).all()
        notices = db.query(models.Notice).order_by(models.Notice.id).all()
        alerts = db.query(models.EmergencyAlert).order_by(models.EmergencyAlert.id).all()
        if (len(buildings), len(rooms), len(bookings), len(labels), len(notices), len(alerts)) != (10, 40, 12, 30, 4, 4) or len(maintenance) not in {6, 7}:
            raise DemoDatabaseError("Fixture record counts changed; refusing to update an unfamiliar dataset.")
        if any(not (b.building_code.startswith(("DEMO-", "LOCAL-")) or b.building_code in {code for code, _ in BUILDINGS}) for b in buildings):
            raise DemoDatabaseError("Unexpected building records found; refusing to update.")
        if any(not (r.room_code.startswith(("DEMO-", "LOCAL-")) or any(r.room_code.startswith(f"{code}-") for code, _ in BUILDINGS)) for r in rooms):
            raise DemoDatabaseError("Unexpected room records found; refusing to update.")

        building_by_id = {}
        for row, (code, name) in zip(buildings, BUILDINGS):
            row.building_code, row.name = code, name
            row.description = f"Academic campus facility providing teaching, study, and student support space."
            building_by_id[row.id] = (code, name)
        for index, room in enumerate(rooms):
            code, _ = building_by_id[room.building_id]
            name, kind, capacity = ROOMS[index % len(ROOMS)]
            floor = (index // 10) % 3
            room.room_code = f"{code}-F{floor}-{101 + (index % 10):03d}"
            room.room_name, room.room_type, room.capacity = name, kind, capacity
            room.floor_number = floor
        now = bookings[0].start_time
        for index, row in enumerate(bookings):
            row.purpose, row.status = BOOKINGS[index]
            row.start_time = now + timedelta(days=2 + index, hours=9 + (index % 6))
            row.end_time = row.start_time + timedelta(hours=1)
        for index, row in enumerate(maintenance):
            row.title, row.description, row.priority, row.status = MAINTENANCE[index]
            row.resolved_at = row.created_at + timedelta(hours=4) if row.status == "RESOLVED" else None
        if not any(row.title == "Plumbing inspection" for row in maintenance):
            admin_building = next(row for row in buildings if row.building_code == "ADMIN")
            service_room = next(row for row in rooms if row.building_id == admin_building.id)
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            db.add(models.MaintenanceRequest(
                room_id=service_room.id,
                reported_by=maintenance[0].reported_by,
                title="Plumbing inspection",
                description="Fictional maintenance record for a routine plumbing inspection in the Administrative Block.",
                priority=MAINTENANCE[6][2],
                status=MAINTENANCE[6][3],
                created_at=now - timedelta(days=2),
            ))
        for row in labels:
            row.label = ("Ground Floor", "First Floor", "Second Floor")[row.floor_number % 3]
        for index, row in enumerate(notices, 1):
            row.title = ("Library hours and study space update", "Laboratory access schedule", "Campus network maintenance notice", "Student project showcase")[(index - 1) % 4]
            row.content = "Fictional local campus information for interface review; confirm details with campus administration before operational use."
            row.published = False
            row.expires_at = None
        alert_details = [
            ("Electrical panel inspection scheduled", "A facilities inspection is scheduled for the electrical distribution area.", "LOW", True),
            ("Network service review", "The campus network team is reviewing connectivity in the computing facilities.", "MEDIUM", True),
            ("Workshop safety notice", "Please follow posted safety procedures while workshop equipment is under review.", "HIGH", False),
            ("Water supply inspection completed", "A routine plumbing inspection was recorded for the student services area.", "LOW", False),
        ]
        for row, detail in zip(alerts, alert_details):
            row.title, row.message, row.severity, row.active = detail
    print("Updated 10 buildings, 40 rooms, 12 bookings, 7 maintenance requests, and 30 floor labels.")
    print("Preserved all user accounts, credentials, and simulated reading records.")


if __name__ == "__main__":
    main()
