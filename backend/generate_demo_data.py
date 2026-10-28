"""Create fictional sample data in the dedicated local CampusSphere demo DB.

This command never imports the Neon seeder/initializer and never uses the
normal database URL. It sets a process-only local target, disables dotenv
loading, verifies the effective SQLAlchemy engine, then writes only to the
approved SQLite file.
"""

import argparse
from contextlib import closing
import getpass
import importlib
import os
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import BigInteger, event, func, inspect, select, text
from sqlalchemy.engine import URL
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

from demo_mode import (
    DEMO_DATABASE_PATH,
    DEMO_MARKER_KEY,
    DEMO_MARKER_VALUE,
    DEMO_METADATA_TABLE,
    DemoDatabaseError,
    demo_marker,
    demo_metadata,
    require_approved_demo_engine,
)


@compiles(BigInteger, "sqlite")
def _sqlite_integer_primary_key(type_, compiler, **kwargs):
    # SQLite only autogenerates integer primary keys declared exactly INTEGER.
    return "INTEGER"


BUILDING_NAMES = (
    "North Learning Centre", "Cedar Science Annex", "Riverside Design Studio",
    "West Commons", "Summit Lecture Hall", "Orchard Computing Centre",
    "Lakeside Collaboration Hub", "East Research Pavilion", "Meadow Library Wing",
    "South Student Centre",
)
ROOM_TYPES = ("LECTURE", "LAB", "STUDY", "MEETING")
CAPACITIES = (48, 24, 16, 32)
BOOKING_STATUSES = ("PENDING", "APPROVED", "REJECTED", "CANCELLED") * 3
BOOKING_PURPOSES = (
    "DEMO study group", "DEMO project meeting", "DEMO seminar practice",
    "DEMO peer tutoring", "DEMO workshop planning", "DEMO club discussion",
)
APPLICATION_TABLE_NAMES = (
    "users", "buildings", "rooms", "room_bookings", "room_occupancy",
    "energy_readings", "notices", "emergency_alerts", "maintenance_requests",
    "building_floor_labels",
)
EXPECTED_RECORD_COUNTS = {
    "users": 2,
    "buildings": 10,
    "rooms": 40,
    "room_bookings": 12,
    "room_occupancy": 336,
    "energy_readings": 224,
    "notices": 4,
    "emergency_alerts": 4,
    "maintenance_requests": 6,
    "building_floor_labels": 30,
    "password_reset_tokens": 0,
}


def _enable_sqlite_foreign_keys(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def enable_sqlite_foreign_keys(engine):
    require_approved_demo_engine(engine)
    if not event.contains(engine, "connect", _enable_sqlite_foreign_keys):
        event.listen(engine, "connect", _enable_sqlite_foreign_keys)


def create_demo_schema(engine, metadata):
    """Create tables only after validating the effective engine destination."""
    require_approved_demo_engine(engine)
    enable_sqlite_foreign_keys(engine)
    metadata.create_all(engine)
    demo_metadata.create_all(engine)


def _counts(session, models):
    return {
        table_name: session.query(getattr(models, model_name)).count()
        for table_name, model_name in (
            ("users", "User"), ("buildings", "Building"), ("rooms", "Room"),
            ("room_bookings", "RoomBooking"), ("room_occupancy", "RoomOccupancy"),
            ("energy_readings", "EnergyReading"), ("notices", "Notice"),
            ("emergency_alerts", "EmergencyAlert"), ("maintenance_requests", "MaintenanceRequest"),
            ("building_floor_labels", "BuildingFloorLabel"),
            ("password_reset_tokens", "PasswordResetToken"),
        )
    }


def inspect_existing_demo_file(engine, models, *, allow_incomplete_readings=False):
    """Allow a new file, the exact verified-empty schema, or a complete fixture."""
    require_approved_demo_engine(engine)
    if DEMO_DATABASE_PATH.is_symlink():
        raise DemoDatabaseError("The reserved demo database path is a symlink; refusing to access it.")
    if DEMO_DATABASE_PATH.exists() and not DEMO_DATABASE_PATH.is_file():
        raise DemoDatabaseError("The reserved demo database path is not a regular file; refusing to access it.")
    if not DEMO_DATABASE_PATH.exists():
        return False

    table_names = set(inspect(engine).get_table_names())
    if not table_names:
        return False
    optional_tables = {"password_reset_tokens"}
    required = set(models.Base.metadata.tables) - optional_tables
    expected = required | {DEMO_METADATA_TABLE}
    if table_names not in (expected, expected | optional_tables):
        raise DemoDatabaseError(
            "The reserved demo SQLite file contains an unmarked or unexpected schema; refusing to modify it. "
            "Review and remove only the documented demo file before rebuilding."
        )
    with engine.connect() as connection:
        extra_objects = connection.execute(text(
            "SELECT type FROM sqlite_master WHERE type IN ('view', 'trigger')"
        )).scalars().all()
        if extra_objects:
            raise DemoDatabaseError(
                "The reserved demo SQLite file contains unexpected schema objects; refusing to modify it."
            )
        marker_rows = connection.execute(
            select(func.count()).select_from(demo_marker)
        ).scalar_one()
        marker = connection.execute(
            select(demo_marker.c.value).where(demo_marker.c.key == DEMO_MARKER_KEY)
        ).scalar_one_or_none()
        application_counts = {
            table_name: connection.execute(
                select(func.count()).select_from(models.Base.metadata.tables[table_name])
            ).scalar_one()
            for table_name in models.Base.metadata.tables
            if table_name in table_names
        }

    if marker_rows == 1 and marker == DEMO_MARKER_VALUE:
        allowed_growth = {"room_bookings", "maintenance_requests", "password_reset_tokens"}
        invalid_counts = {
            name: count
            for name, count in application_counts.items()
            if count < EXPECTED_RECORD_COUNTS[name]
            or (name not in allowed_growth and count != EXPECTED_RECORD_COUNTS[name])
        }
        if allow_incomplete_readings:
            invalid_counts.pop("room_occupancy", None)
            invalid_counts.pop("energy_readings", None)
        if invalid_counts:
            raise DemoDatabaseError(
                "The marked local demo database is incomplete or unexpected; refusing to modify it."
            )
        with Session(engine) as session:
            unsafe_bookings = (
                session.query(models.RoomBooking)
                .join(models.Room, models.Room.id == models.RoomBooking.room_id)
                .filter(
                    (models.Room.room_code.notilike("DEMO-%"))
                    | (~func.upper(models.RoomBooking.purpose).like("DEMO%"))
                )
                .count()
            )
            unsafe_maintenance = (
                session.query(models.MaintenanceRequest)
                .join(models.Room, models.Room.id == models.MaintenanceRequest.room_id)
                .filter(
                    (models.Room.room_code.notilike("DEMO-%"))
                    | (~func.upper(models.MaintenanceRequest.title).like("DEMO%"))
                )
                .count()
            )
        if unsafe_bookings or unsafe_maintenance:
            raise DemoDatabaseError(
                "The marked local demo database contains unlabelled workflow records; refusing to modify it."
            )
        return True

    if marker_rows == 0 and marker is None and not any(application_counts.values()):
        # The only recoverable unmarked state is the exact known application
        # schema plus marker table, with no rows or additional schema objects.
        return False

    if marker != DEMO_MARKER_VALUE:
        raise DemoDatabaseError(
            "The reserved demo SQLite file is unmarked or contains data; refusing to modify it."
        )
    raise DemoDatabaseError("The reserved demo SQLite file has an invalid marker state; refusing to modify it.")


def normalize_existing_demo_fixture(engine, models):
    """Keep the known local fixture visibly simulated and clearly fictional."""
    require_approved_demo_engine(engine)
    if not inspect_existing_demo_file(engine, models):
        raise DemoDatabaseError("The local demo fixture is not complete; refusing to normalize it.")

    changes = {"occupancy_sources": 0, "energy_sources": 0, "notice_drafts": 0, "maintenance_statuses": 0}
    expected_maintenance = {
        f"DEMO fixture request {index}": (
            ("OPEN", "IN_PROGRESS", "RESOLVED", "OPEN", "IN_PROGRESS", "OPEN")[index - 1],
            ("LOW", "MEDIUM", "HIGH", "MEDIUM", "HIGH", "LOW")[index - 1],
        )
        for index in range(1, 7)
    }

    with Session(engine) as session, session.begin():
        buildings = session.query(models.Building).all()
        rooms = session.query(models.Room).all()
        if not buildings or any(not building.building_code.upper().startswith("DEMO-") for building in buildings):
            raise DemoDatabaseError("The marked fixture contains a non-demo building; refusing to modify it.")
        if not rooms or any(not room.room_code.upper().startswith("DEMO-") for room in rooms):
            raise DemoDatabaseError("The marked fixture contains a non-demo room; refusing to modify it.")

        energy_rows = session.query(models.EnergyReading).all()
        if any(row.reading_source not in {"SIMULATED", "SIMULATED_DEMO"} for row in energy_rows):
            raise DemoDatabaseError("The marked fixture contains an unexpected energy source; refusing to modify it.")
        for row in energy_rows:
            if row.reading_source != "SIMULATED_DEMO":
                row.reading_source = "SIMULATED_DEMO"
                changes["energy_sources"] += 1

        occupancy_rows = session.query(models.RoomOccupancy).all()
        if any(row.source not in {"RECORDED_VIDEO", "SIMULATED", "SIMULATED_DEMO"} for row in occupancy_rows):
            raise DemoDatabaseError("The marked fixture contains an unexpected occupancy source; refusing to modify it.")
        for row in occupancy_rows:
            if row.source != "SIMULATED_DEMO":
                row.source = "SIMULATED_DEMO"
                changes["occupancy_sources"] += 1

        notices = session.query(models.Notice).all()
        if any(notice.title not in {f"DEMO notice {index}: fictional campus update" for index in range(1, 5)} for notice in notices):
            raise DemoDatabaseError("The marked fixture contains an unexpected notice; refusing to modify it.")
        for notice in notices:
            if notice.published or notice.expires_at is not None:
                notice.published = False
                notice.expires_at = None
                changes["notice_drafts"] += 1

        maintenance_rows = session.query(models.MaintenanceRequest).all()
        maintenance_titles = {row.title for row in maintenance_rows}
        if not set(expected_maintenance).issubset(maintenance_titles) or any(
            not title.startswith("DEMO") for title in maintenance_titles
        ):
            raise DemoDatabaseError("The marked fixture contains unexpected maintenance records; refusing to modify them.")
        for row in maintenance_rows:
            if row.title not in expected_maintenance:
                continue
            status, priority = expected_maintenance[row.title]
            resolved_at = row.created_at if status == "RESOLVED" else None
            if row.status != status or row.priority != priority or row.resolved_at != resolved_at:
                row.status = status
                row.priority = priority
                row.resolved_at = resolved_at
                changes["maintenance_statuses"] += 1

    return changes


def _ensure_empty_application_tables(session, models):
    if any(_counts(session, models).values()):
        raise DemoDatabaseError(
            "The local demo database has records but no completed demo marker; refusing to overwrite them."
        )


def _check_password(label, hash_password):
    while True:
        password = getpass.getpass(f"Choose a local-only {label} password (12+ characters): ")
        confirmation = getpass.getpass("Confirm password: ")
        if password != confirmation:
            password = confirmation = ""
            print("Passwords did not match; try again.", file=sys.stderr)
            continue
        try:
            encoded = hash_password(password)
        except ValueError:
            password = confirmation = ""
            print("Password does not meet the existing password policy; try again.", file=sys.stderr)
            continue
        password = confirmation = ""
        return encoded


def _utc_datetime(value):
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _schedule(anchor):
    anchor = _utc_datetime(anchor).replace(minute=0, second=0, microsecond=0)
    return [anchor - timedelta(hours=6 * (27 - slot)) for slot in range(28)]


def _build_readings_plan(rooms, buildings, occupancy_rows, energy_rows, *, now=None):
    """Return deterministic additions without changing existing observations."""
    now = _utc_datetime(now or datetime.now(timezone.utc)).replace(minute=0, second=0, microsecond=0)
    occupancy_anchor = max((_utc_datetime(row[1]) for row in occupancy_rows), default=now)
    energy_anchor = max((_utc_datetime(row[1]) for row in energy_rows), default=now)
    occupied_keys = {(int(room_id), _utc_datetime(stamp)) for room_id, stamp in occupancy_rows}
    energy_keys = {(int(building_id), _utc_datetime(stamp)) for building_id, stamp in energy_rows}
    occupancy_additions = []
    for room_index, (room_id, capacity) in enumerate(rooms):
        capacity = max(0, int(capacity or 0))
        for slot, recorded_at in enumerate(_schedule(occupancy_anchor)):
            if (int(room_id), recorded_at) in occupied_keys:
                continue
            if slot == 0 and room_index % 4 == 0:
                count = 0
            elif slot == 1 and room_index % 4 == 0:
                count = capacity
            else:
                ratio_tenths = ((room_index * 7 + slot * 3) % 9) + 1
                count = min(capacity, int(capacity * ratio_tenths / 10))
            occupancy_additions.append({
                "room_id": int(room_id), "occupied_count": count,
                "source": "SIMULATED_DEMO", "recorded_at": recorded_at,
            })
    energy_additions = []
    for building_index, building_id in enumerate(buildings):
        for slot, recorded_at in enumerate(_schedule(energy_anchor)):
            if (int(building_id), recorded_at) in energy_keys:
                continue
            value = Decimal(18 + ((building_index * 17 + slot * 11) % 105)) + Decimal("0.375")
            energy_additions.append({
                "building_id": int(building_id), "energy_kwh": value,
                "reading_source": "SIMULATED_DEMO", "recorded_at": recorded_at,
            })
    return occupancy_additions, energy_additions


def _read_only_plan(connection):
    tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    required = {DEMO_METADATA_TABLE, "room_occupancy", "energy_readings", "rooms", "buildings"}
    if not required.issubset(tables):
        return None
    marker = connection.execute(
        f"SELECT value FROM {DEMO_METADATA_TABLE} WHERE key=?", (DEMO_MARKER_KEY,)
    ).fetchone()
    if marker != (DEMO_MARKER_VALUE,):
        return None
    if connection.execute("PRAGMA foreign_key_check").fetchone() is not None:
        return None
    rooms = connection.execute(
        "SELECT r.id, COALESCE(r.capacity, 0) FROM rooms r JOIN buildings b ON b.id=r.building_id ORDER BY r.id"
    ).fetchall()
    if not rooms or any(int(capacity or 0) <= 0 for _, capacity in rooms):
        return None
    buildings = [row[0] for row in connection.execute("SELECT id FROM buildings ORDER BY id")]
    occupancy = connection.execute("SELECT room_id, recorded_at FROM room_occupancy").fetchall()
    energy = connection.execute("SELECT building_id, recorded_at FROM energy_readings").fetchall()
    return _build_readings_plan(rooms, buildings, occupancy, energy)


def populate_simulated_readings(session: Session, models, *, now=None):
    """Add only missing deterministic readings for existing facilities."""
    rooms = session.query(models.Room.id, models.Room.capacity).join(
        models.Building, models.Building.id == models.Room.building_id
    ).order_by(models.Room.id).all()
    buildings = [row[0] for row in session.query(models.Building.id).order_by(models.Building.id).all()]
    if not rooms or any(capacity is None or int(capacity) <= 0 for _, capacity in rooms):
        raise DemoDatabaseError("The local demo fixture contains a room without a valid positive capacity; refusing to generate occupancy readings.")
    occupancy = session.query(models.RoomOccupancy.room_id, models.RoomOccupancy.recorded_at).all()
    energy = session.query(models.EnergyReading.building_id, models.EnergyReading.recorded_at).all()
    occupancy_additions, energy_additions = _build_readings_plan(
        rooms, buildings, occupancy, energy, now=now
    )
    session.add_all([models.RoomOccupancy(**row) for row in occupancy_additions])
    session.add_all([models.EnergyReading(**row) for row in energy_additions])
    session.flush()
    return {"occupancy": len(occupancy_additions), "energy": len(energy_additions)}


def populate_demo_data(session: Session, models, *, admin_hash, student_hash, as_of=None):
    """Insert the deterministic fixture once; never replace existing rows."""
    existing_marker = session.execute(
        select(demo_marker.c.value).where(demo_marker.c.key == DEMO_MARKER_KEY)
    ).scalar_one_or_none()
    if existing_marker == DEMO_MARKER_VALUE:
        return _counts(session, models)
    if existing_marker is not None:
        raise DemoDatabaseError("The local demo marker is unexpected; refusing to modify records.")
    _ensure_empty_application_tables(session, models)

    now = as_of or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("as_of must be timezone-aware")
    now = now.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)

    admin = models.User(
        full_name="DEMO CampusSphere Administrator",
        email="admin@campussphere-demo.example.invalid",
        password_hash=admin_hash,
        role="ADMIN",
        created_at=now - timedelta(days=30),
    )
    student = models.User(
        full_name="DEMO CampusSphere Student",
        email="student@campussphere-demo.example.invalid",
        password_hash=student_hash,
        role="STUDENT",
        created_at=now - timedelta(days=25),
    )
    session.add_all([admin, student])
    session.flush()

    buildings = []
    rooms = []
    for building_index, name in enumerate(BUILDING_NAMES):
        building = models.Building(
            building_code=f"DEMO-B{building_index + 1:02d}",
            name=f"DEMO {name}",
            description="Fictional CampusSphere demonstration building; not a real campus facility.",
        )
        session.add(building)
        buildings.append(building)
    session.flush()

    for building_index, building in enumerate(buildings):
        for room_index in range(4):
            floor_number = room_index % 3
            room = models.Room(
                building_id=building.id,
                room_code=f"{building.building_code}-F{floor_number}-{room_index + 1:02d}",
                room_name=f"DEMO {ROOM_TYPES[room_index]} {room_index + 1:02d}",
                floor_number=floor_number,
                capacity=CAPACITIES[(building_index + room_index) % len(CAPACITIES)],
                room_type=ROOM_TYPES[room_index],
                created_at=now - timedelta(days=20 - building_index),
            )
            session.add(room)
            rooms.append(room)
        for floor_number, label in enumerate(("DEMO Ground", "DEMO First", "DEMO Second")):
            session.add(models.BuildingFloorLabel(
                building_id=building.id,
                floor_number=floor_number,
                label=f"{label} Floor · fictional import label",
                created_at=now - timedelta(days=20 - building_index),
            ))
    session.flush()

    occupancy_rooms = rooms[:12]
    for room_index, room in enumerate(occupancy_rooms):
        for slot in range(28):
            if slot == 0 and room_index % 4 == 0:
                occupied = 0
            elif slot == 1 and room_index % 4 == 0:
                occupied = room.capacity or 0
            else:
                ratio_tenths = ((room_index * 7 + slot * 3) % 9) + 1
                occupied = min(room.capacity or 0, int((room.capacity or 0) * ratio_tenths / 10))
            session.add(models.RoomOccupancy(
                room_id=room.id,
                occupied_count=occupied,
                source="SIMULATED_DEMO",
                recorded_at=now - timedelta(days=7) + timedelta(hours=6 * slot),
            ))

    for building_index, building in enumerate(buildings[:8]):
        for slot in range(28):
            value = Decimal(18 + ((building_index * 17 + slot * 11) % 105)) + Decimal("0.375")
            session.add(models.EnergyReading(
                building_id=building.id,
                energy_kwh=value,
                reading_source="SIMULATED_DEMO",
                recorded_at=now - timedelta(days=7) + timedelta(hours=6 * slot),
            ))

    for booking_index, status in enumerate(BOOKING_STATUSES):
        room = rooms[booking_index]
        start_time = now + timedelta(days=1 + (booking_index % 7), hours=(booking_index * 2) % 10)
        session.add(models.RoomBooking(
            room_id=room.id,
            user_id=student.id,
            purpose=f"{BOOKING_PURPOSES[booking_index % len(BOOKING_PURPOSES)]} {booking_index + 1:02d}",
            start_time=start_time,
            end_time=start_time + timedelta(hours=1),
            status=status,
            created_at=now - timedelta(days=booking_index % 6, hours=booking_index),
        ))

    for notice_index in range(4):
        session.add(models.Notice(
            title=f"DEMO notice {notice_index + 1}: fictional campus update",
            content="Fictional demonstration notice. This is not an official campus announcement.",
            created_by=admin.id,
            published=False,
            created_at=now - timedelta(days=notice_index + 1),
        ))

    alert_values = (
        ("LOW", True, now + timedelta(days=5)),
        ("MEDIUM", True, None),
        ("HIGH", False, None),
        ("LOW", True, now - timedelta(days=1)),
    )
    for alert_index, (severity, active, expires_at) in enumerate(alert_values):
        session.add(models.EmergencyAlert(
            title=f"DEMO alert {alert_index + 1}: fictional {severity.lower()} event",
            message="Fictional demonstration alert. This is not a real campus incident.",
            severity=severity,
            active=active,
            created_by=admin.id,
            created_at=now - timedelta(days=alert_index + 1),
            expires_at=expires_at,
        ))

    maintenance_statuses = ("OPEN", "IN_PROGRESS", "RESOLVED", "OPEN", "IN_PROGRESS", "OPEN")
    maintenance_priorities = ("LOW", "MEDIUM", "HIGH", "MEDIUM", "HIGH", "LOW")
    for maintenance_index, status in enumerate(maintenance_statuses):
        room = rooms[(maintenance_index * 3) % len(rooms)]
        session.add(models.MaintenanceRequest(
            room_id=room.id,
            reported_by=student.id,
            title=f"DEMO fixture request {maintenance_index + 1}",
            description="Fictional dashboard fixture only; not submitted through the maintenance or QR workflow.",
            priority=maintenance_priorities[maintenance_index],
            status=status,
            qr_code_value=None,
            created_at=now - timedelta(days=maintenance_index + 1),
            resolved_at=now - timedelta(days=maintenance_index) if status == "RESOLVED" else None,
        ))

    session.execute(demo_marker.insert().values(key=DEMO_MARKER_KEY, value=DEMO_MARKER_VALUE))
    session.flush()
    return _counts(session, models)


def _set_process_local_database():
    os.environ["PYTHON_DOTENV_DISABLED"] = "1"
    local_url = URL.create("sqlite", database=str(DEMO_DATABASE_PATH.absolute()))
    os.environ["DATABASE_URL"] = local_url.render_as_string(hide_password=False)


def _parser():
    parser = argparse.ArgumentParser(description="Preview the simulated occupancy and energy fixture in the isolated local CampusSphere demo database.")
    parser.add_argument("--preview", action="store_true", help="Inspect the local fixture read-only (the default)")
    parser.add_argument("--apply", action="store_true", help="Explicitly apply a planned generation (requires a reviewed, non-empty plan)")
    return parser


def _print_counts(counts):
    print(f"Local database: {DEMO_DATABASE_PATH.absolute()}")
    for table_name in APPLICATION_TABLE_NAMES:
        print(f"{table_name}: {counts[table_name]}")


def _preview_read_only():
    """Inspect only the exact local SQLite fixture using SQLite read-only mode."""
    path = DEMO_DATABASE_PATH.absolute()
    print(f"Target database: {path}")
    print("Operation: simulated occupancy and energy only")
    print("Source labels: SIMULATED_DEMO")
    print("Time range: existing stored readings (UTC)")
    if not path.is_file() or path.is_symlink():
        print("Existing occupancy readings: 0")
        print("Existing energy readings: 0")
        print("Records proposed: occupancy=0, energy=0")
        print("Status: no verified marked fixture; no records will be generated")
        return {"occupancy": 0, "energy": 0, "verified": False}
    uri = f"file:{path.as_posix()}?mode=ro"
    with closing(sqlite3.connect(uri, uri=True)) as connection:
        table_names = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        required = {DEMO_METADATA_TABLE, "room_occupancy", "energy_readings", "rooms", "buildings"}
        if not required.issubset(table_names):
            print("Existing occupancy readings: unavailable")
            print("Existing energy readings: unavailable")
            print("Records proposed: occupancy=0, energy=0")
            print("Status: fixture schema or marker table is missing; no writes allowed")
            return {"occupancy": 0, "energy": 0, "verified": False}
        marker = connection.execute(
            f"SELECT value FROM {DEMO_METADATA_TABLE} WHERE key=?", (DEMO_MARKER_KEY,)
        ).fetchone()
        occupancy_count = connection.execute("SELECT COUNT(*) FROM room_occupancy").fetchone()[0]
        energy_count = connection.execute("SELECT COUNT(*) FROM energy_readings").fetchone()[0]
        building_count = connection.execute("SELECT COUNT(*) FROM buildings").fetchone()[0]
        room_count = connection.execute("SELECT COUNT(*) FROM rooms").fetchone()[0]
        invalid_capacity_count = connection.execute(
            "SELECT COUNT(*) FROM rooms WHERE capacity IS NULL OR capacity <= 0"
        ).fetchone()[0]
        foreign_key_violations = connection.execute("PRAGMA foreign_key_check").fetchall()
        occupancy_sources = connection.execute(
            "SELECT source, COUNT(*) FROM room_occupancy GROUP BY source"
        ).fetchall()
        energy_sources = connection.execute(
            "SELECT reading_source, COUNT(*) FROM energy_readings GROUP BY reading_source"
        ).fetchall()
        plan = _read_only_plan(connection)
        occupancy_range = connection.execute(
            "SELECT MIN(recorded_at), MAX(recorded_at) FROM room_occupancy"
        ).fetchone()
        energy_range = connection.execute(
            "SELECT MIN(recorded_at), MAX(recorded_at) FROM energy_readings"
        ).fetchone()
    verified = marker == (DEMO_MARKER_VALUE,)
    print(f"Fixture marker verified: {'yes' if verified else 'no'}")
    print(f"Existing occupancy readings: {occupancy_count}")
    print(f"Occupancy source counts: {occupancy_sources}")
    print(f"Occupancy time range: {occupancy_range[0]} to {occupancy_range[1]} UTC")
    print(f"Existing energy readings: {energy_count}")
    print(f"Energy source counts: {energy_sources}")
    print(f"Energy time range: {energy_range[0]} to {energy_range[1]} UTC")
    print(f"Existing buildings: {building_count}")
    print(f"Existing rooms: {room_count}")
    print(f"Rooms with invalid capacity: {invalid_capacity_count}")
    print(f"Foreign-key integrity: {'valid (0 violations)' if not foreign_key_violations else f'invalid ({len(foreign_key_violations)} violations)'}")
    safe_fixture = verified and plan is not None and not foreign_key_violations and invalid_capacity_count == 0
    proposed = (len(plan[0]), len(plan[1])) if safe_fixture else (0, 0)
    print(f"Records proposed: occupancy={proposed[0]}, energy={proposed[1]}")
    planned_rows = (plan[0] + plan[1]) if safe_fixture else []
    if planned_rows:
        planned_range = min(row["recorded_at"] for row in planned_rows), max(row["recorded_at"] for row in planned_rows)
        print(f"Proposed timestamp range: {planned_range[0].isoformat()} to {planned_range[1].isoformat()} UTC")
    else:
        print("Proposed timestamp range: none")
    print("Status: existing simulated dataset is complete; no additions proposed" if safe_fixture and proposed == (0, 0) else "Status: additions reference existing rooms/buildings only" if safe_fixture else "Status: fixture safety checks failed; no records proposed")
    return {"occupancy": occupancy_count, "energy": energy_count, "verified": verified, "proposed": proposed}


def main(argv=None):
    args = _parser().parse_args(argv)
    if args.preview and args.apply:
        raise DemoDatabaseError("Choose either --preview or --apply, not both.")
    if not args.apply:
        _preview_read_only()
        return 0
    _set_process_local_database()
    database = importlib.import_module("database")
    engine = require_approved_demo_engine(database.engine)
    enable_sqlite_foreign_keys(engine)
    models = importlib.import_module("models")
    if not inspect_existing_demo_file(engine, models, allow_incomplete_readings=True):
        raise DemoDatabaseError("Apply refused: simulated readings can only reference an existing verified local demo fixture; this command will not create users, rooms, or other records.")
    with Session(engine) as session, session.begin():
        changes = populate_simulated_readings(session, models)
    print(f"Applied simulated readings to existing facilities only: occupancy={changes['occupancy']}, energy={changes['energy']}.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except DemoDatabaseError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(2)
