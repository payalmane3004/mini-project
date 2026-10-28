"""Dry-run-first, idempotent sample inventory for the configured Neon database.

The script only adds records tagged as DEMO/SAMPLE DATA. It never edits buildings,
users, credentials, alerts, or existing records. Run from the repository root.
"""

from __future__ import annotations

import argparse
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
import os
from pathlib import Path
import sys

from sqlalchemy import inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError


BACKEND_DIR = Path(__file__).resolve().parent
SEED_VERSION = "CAMPUS-SAMPLE-SEED-V1"
SIMULATED_SOURCE = "SIMULATED_SAMPLE_SEED_V1"
ROOM_NUMBERS = (101, 102, 201, 202)
ROOM_SPECS = {
    101: ("Sample classroom", 1, 60, "CLASSROOM"),
    102: ("Sample computer lab", 1, 36, "COMPUTER LAB"),
    201: ("Sample seminar room", 2, 30, "SEMINAR ROOM"),
    202: ("Sample study and meeting room", 2, 14, "MEETING ROOM"),
}
BOOKING_STATUSES = ("APPROVED", "CANCELLED", "REJECTED")
MAINTENANCE_STATUSES = ("OPEN", "IN_PROGRESS", "RESOLVED")
ROOM_CODE_PREFIX = "DEMO-"
BOOKING_MARKER = f"DEMO | SAMPLE DATA | {SEED_VERSION} | BOOKING-"
MAINTENANCE_MARKER = f"DEMO | SAMPLE DATA | {SEED_VERSION} | MAINTENANCE-"
ADVISORY_LOCK_KEY = 628_410_035
APPROVED_INSERT_COUNTS = {"rooms": 137, "occupancy": 411, "energy": 105, "bookings": 12, "maintenance": 12}
APPROVED_BUILDINGS = (
    (1, "BU-002", "Main Building"), (2, "BU-019", "PE"),
    (3, "BU-026", "Metallurgy"), (4, "BU-007", "Electrical Deptt"),
    (5, "BU-008", "Mechanical Lab"), (6, "BU-009", "Mechanical Workshop"),
    (7, "BU-003", "Mechanical Deptt"), (8, "BU-048", "Hyd Lab"),
    (9, "BU-005", "Civil Drg Hall"), (10, "BU-001", "Quadrangle"),
    (11, "BU-015", "Vartak Hall"), (12, "BU-027", "Lawn Tennis"),
    (13, "BU-044", "Gymkhana"), (14, "BU-013", "Canteen"),
    (15, "BU-012", "Vision Office"), (16, "BU-039", "Exam"),
    (17, "BU-004", "Ajit Gulabchand Central Library"),
    (18, "BU-037", "Cyber Hostel"), (19, "BU-040", "Director Bunglow"),
    (20, "BU-054", "Ladies Mess"), (21, "BU-029", "Old Rector Office"),
    (22, "BU-043", "Ladies Mess"), (23, "BU-025", "D1"),
    (24, "BU-021", "D2"), (25, "BU-020", "D3"), (26, "BU-024", "D4"),
    (27, "BU-017", "D8"), (28, "BU-016", "D7"), (29, "BU-018", "D5"),
    (30, "BU-006", "Old Mess"), (31, "BU-031", "Hot Bath"),
    (32, "BU-010", "Community Polytechnic"), (33, "BU-046", "Bank"),
    (34, "BU-011", "Smithy Workshop"), (35, "BU-023", "Wadar Well"),
)


def room_code(building, number: int) -> str:
    code = f"DEMO-{building.building_code}-ROOM-{number}"
    if len(code) > 30:
        code = f"DEMO-B{building.id}-R{number}"
    if len(code) > 30:
        raise ValueError("A sample room identifier exceeds the database column length.")
    return code


def build_plan(
    buildings,
    rooms,
    occupancy_rows,
    energy_rows,
    booking_markers,
    maintenance_markers,
    *,
    student_id,
    now: datetime,
):
    """Build deterministic insert intents from existing records without mutation."""
    if now.tzinfo is None:
        raise ValueError("Plan timestamps must be timezone-aware.")
    now = now.astimezone(timezone.utc).replace(second=0, microsecond=0)

    eligible = [building for building in buildings if (
        building.id is not None
        and isinstance(building.building_code, str) and building.building_code.strip()
        and isinstance(building.name, str) and building.name.strip()
    )]
    existing_by_code = {room.room_code: room for room in rooms}
    room_specs = []
    skipped_room_codes = 0
    for building in eligible:
        for number in ROOM_NUMBERS:
            code = room_code(building, number)
            if code in existing_by_code:
                skipped_room_codes += 1
                continue
            name, floor_number, capacity, room_type = ROOM_SPECS[number]
            room_specs.append({
                "code": code,
                "values": {
                    "building_id": building.id,
                    "room_code": code,
                    "room_name": name,
                    "floor_number": floor_number,
                    "capacity": capacity,
                    "room_type": room_type,
                },
            })

    candidate_room_values = {
        room_code(building, number): {
            "building_id": building.id,
            "capacity": ROOM_SPECS[number][2],
        }
        for building in eligible for number in ROOM_NUMBERS
    }
    # Existing room records are authoritative. In particular, the three legacy
    # DEMO-ROOM-101 fixtures have capacity zero and must not receive occupancy.
    for room in rooms:
        if room.room_code in candidate_room_values:
            candidate_room_values[room.room_code]["capacity"] = int(room.capacity or 0)
    for item in room_specs:
        candidate_room_values[item["code"]] = item["values"]
    existing_sample_occupancy = {
        row.room_id for row in occupancy_rows if row.source == SIMULATED_SOURCE
    }
    existing_room_ids = {
        room_code_for_id.room_code: room_code_for_id.id
        for room_code_for_id in rooms
        if room_code_for_id.id is not None
    }
    existing_occupancy_codes = {
        code for code, room_id in existing_room_ids.items()
        if code in candidate_room_values and room_id in existing_sample_occupancy
    }

    # A stable weekly window keeps the first run useful in current dashboards;
    # reruns are keyed by source and room/building, not by this timestamp.
    monday = now.date() - timedelta(days=now.weekday())
    occupancy_specs = []
    skipped_occupancy = 0
    for code, values in candidate_room_values.items():
        room_id = existing_room_ids.get(code)
        if room_id is None and code not in {item["code"] for item in room_specs}:
            continue
        capacity = int(values.get("capacity") or 0)
        if capacity <= 0:
            continue
        if room_id is not None and code in existing_occupancy_codes:
            skipped_occupancy += 3
            continue
        for day_index, hour, ratio in ((0, 9, 0.25), (1, 13, 0.65), (2, 17, 0.40)):
            count = min(capacity, int(capacity * ratio))
            recorded_at = datetime.combine(
                monday + timedelta(days=day_index), time(hour, 0), timezone.utc
            )
            occupancy_specs.append({
                "room_code": code,
                "room_id": room_id,
                "values": {
                    "occupied_count": count,
                    "source": SIMULATED_SOURCE,
                    "recorded_at": recorded_at,
                },
            })

    existing_sample_energy = {
        row.building_id for row in energy_rows if row.reading_source == SIMULATED_SOURCE
    }
    energy_specs = []
    skipped_energy = 0
    for building_index, building in enumerate(eligible):
        if building.id in existing_sample_energy:
            skipped_energy += 3
            continue
        base = Decimal(35 + (building_index % 8) * 7)
        for day_index, value in enumerate((base, base + Decimal("8.250"), base - Decimal("4.125"))):
            energy_specs.append({
                "building_id": building.id,
                "energy_kwh": value,
                "reading_source": SIMULATED_SOURCE,
                "recorded_at": datetime.combine(
                    monday + timedelta(days=day_index), time(20, 0), timezone.utc
                ),
            })

    booking_specs = []
    skipped_bookings = 0
    for index, building in enumerate(eligible[:12], start=1):
        code = room_code(building, ROOM_NUMBERS[0])
        purpose = f"{BOOKING_MARKER}{index:03d} | Not a real booking"
        if purpose in booking_markers or student_id is None:
            skipped_bookings += 1
            continue
        start_time = datetime.combine(
            now.date() + timedelta(days=index), time(10 + (index % 4), 0), timezone.utc
        )
        booking_specs.append({
            "room_code": code,
            "purpose": purpose,
            "values": {
                "user_id": student_id,
                "purpose": purpose,
                "start_time": start_time,
                "end_time": start_time + timedelta(hours=1),
                "status": BOOKING_STATUSES[(index - 1) % len(BOOKING_STATUSES)],
            },
        })

    maintenance_specs = []
    skipped_maintenance = 0
    ordered_codes = [room_code(building, ROOM_NUMBERS[0]) for building in eligible]
    for index, code in enumerate(ordered_codes[:12], start=1):
        title = f"{MAINTENANCE_MARKER}{index:03d} | Sample inspection"
        if title in maintenance_markers:
            skipped_maintenance += 1
            continue
        status = MAINTENANCE_STATUSES[(index - 1) % len(MAINTENANCE_STATUSES)]
        created_at = datetime.combine(monday - timedelta(days=12 - index), time(8, 0), timezone.utc)
        resolved_at = created_at + timedelta(hours=5) if status == "RESOLVED" else None
        maintenance_specs.append({
            "room_code": code,
            "title": title,
            "values": {
                "title": title,
                "description": f"SAMPLE DATA ONLY. Fictional maintenance example {index:03d}; no real issue was reported.",
                "priority": ("LOW", "MEDIUM", "HIGH")[index % 3],
                "status": status,
                "reported_by": None,
                "created_at": created_at,
                "resolved_at": resolved_at,
            },
        })

    return {
        "eligible_buildings": eligible,
        "rooms": room_specs,
        "occupancy": occupancy_specs,
        "energy": energy_specs,
        "bookings": booking_specs,
        "maintenance": maintenance_specs,
        "skipped": {
            "rooms": skipped_room_codes,
            "occupancy": skipped_occupancy,
            "energy": skipped_energy,
            "bookings": skipped_bookings,
            "maintenance": skipped_maintenance,
        },
        "student_available": student_id is not None,
    }


def load_application():
    if os.environ.get("CAMPUSSPHERE_ENV", "").strip().lower() != "production":
        raise RuntimeError("Refusing to seed: set CAMPUSSPHERE_ENV=production in this process.")
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))
    from dotenv import dotenv_values
    from sqlalchemy.engine import make_url
    from demo_mode import DEMO_DATABASE_PATH
    import database
    import models

    configured = os.environ.get("DATABASE_URL") or dotenv_values(BACKEND_DIR / ".env").get("DATABASE_URL")
    try:
        configured_url = make_url(configured or "")
        active_url = database.engine.url
    except Exception:
        raise RuntimeError("Refusing to seed: the configured target could not be verified.") from None

    def is_neon(url):
        host = (url.host or "").lower()
        return url.get_backend_name() in {"postgresql", "postgres"} and host.endswith(".neon.tech")

    if (
        database.DATABASE_ENVIRONMENT != "production"
        or database.USES_APPROVED_DEMO_FIXTURE
        or database.engine.dialect.name != "postgresql"
        or not is_neon(configured_url)
        or not is_neon(active_url)
        or configured_url.host != active_url.host
        or configured_url.database != active_url.database
        or DEMO_DATABASE_PATH.resolve() == Path(str(active_url.database)).resolve()
    ):
        raise RuntimeError("Refusing to seed: active SQLAlchemy target does not match configured Neon.")
    return database, models


def _load_plan(session, models, now):
    buildings = session.query(models.Building).order_by(models.Building.id).all()
    rooms = session.query(models.Room).order_by(models.Room.id).all()
    occupancy_rows = session.query(models.RoomOccupancy).filter(
        models.RoomOccupancy.source == SIMULATED_SOURCE
    ).all()
    energy_rows = session.query(models.EnergyReading).filter(
        models.EnergyReading.reading_source == SIMULATED_SOURCE
    ).all()
    booking_markers = {
        row[0] for row in session.query(models.RoomBooking.purpose).filter(
            models.RoomBooking.purpose.like(f"{BOOKING_MARKER}%")
        ).all()
    }
    maintenance_markers = {
        row[0] for row in session.query(models.MaintenanceRequest.title).filter(
            models.MaintenanceRequest.title.like(f"{MAINTENANCE_MARKER}%")
        ).all()
    }
    student_id = session.query(models.User.id).filter(
        models.User.role.ilike("student")
    ).order_by(models.User.id).first()
    return build_plan(
        buildings,
        rooms,
        occupancy_rows,
        energy_rows,
        booking_markers,
        maintenance_markers,
        student_id=student_id[0] if student_id else None,
        now=now,
    )


def _counts(plan):
    return {name: len(plan[name]) for name in ("rooms", "occupancy", "energy", "bookings", "maintenance")}


def _approved_building_snapshot(plan):
    return tuple(
        (int(row.id), row.building_code, row.name)
        for row in plan["eligible_buildings"]
    )


def _validate_live_schema(connection):
    """Check the live PostgreSQL structure before planning or writing."""
    schema = inspect(connection)
    required_columns = {
        "buildings": {"id", "building_code", "name"},
        "rooms": {"id", "building_id", "room_code", "room_name", "floor_number", "capacity", "room_type"},
        "room_occupancy": {"id", "room_id", "occupied_count", "source", "recorded_at"},
        "energy_readings": {"id", "building_id", "energy_kwh", "reading_source", "recorded_at"},
        "room_bookings": {"id", "room_id", "user_id", "purpose", "start_time", "end_time", "status"},
        "maintenance_requests": {"id", "room_id", "reported_by", "title", "description", "priority", "status"},
    }
    tables = set(schema.get_table_names(schema="public"))
    for table_name, columns_needed in required_columns.items():
        if table_name not in tables:
            raise RuntimeError("The live Neon schema differs from the reviewed sample-data plan.")
        columns = {column["name"] for column in schema.get_columns(table_name, schema="public")}
        if not columns_needed.issubset(columns):
            raise RuntimeError("The live Neon schema differs from the reviewed sample-data plan.")

    def has_foreign_key(table, column, target_table):
        return any(
            column in key.get("constrained_columns", [])
            and key.get("referred_table") == target_table
            for key in schema.get_foreign_keys(table, schema="public")
        )

    def has_unique(table, column):
        constraints = schema.get_unique_constraints(table, schema="public")
        indexes = schema.get_indexes(table, schema="public")
        return any(item.get("column_names") == [column] for item in constraints) or any(
            item.get("unique") and item.get("column_names") == [column] for item in indexes
        )

    def check_texts(table):
        return " ".join(
            str(item.get("sqltext", "")).upper().replace('"', "")
            for item in schema.get_check_constraints(table, schema="public")
        )

    valid = (
        has_unique("buildings", "building_code")
        and has_unique("rooms", "room_code")
        and has_foreign_key("rooms", "building_id", "buildings")
        and has_foreign_key("room_occupancy", "room_id", "rooms")
        and has_foreign_key("energy_readings", "building_id", "buildings")
        and has_foreign_key("room_bookings", "room_id", "rooms")
        and has_foreign_key("room_bookings", "user_id", "users")
        and has_foreign_key("maintenance_requests", "room_id", "rooms")
        and "CAPACITY >= 0" in check_texts("rooms")
        and "OCCUPIED_COUNT >= 0" in check_texts("room_occupancy")
        and "ENERGY_KWH >= 0" in check_texts("energy_readings")
        and "END_TIME > START_TIME" in check_texts("room_bookings")
    )
    if not valid:
        raise RuntimeError("The live Neon constraints differ from the reviewed sample-data plan.")
    booking_checks = check_texts("room_bookings")
    maintenance_checks = check_texts("maintenance_requests")
    for value in ("PENDING", "APPROVED", "REJECTED", "CANCELLED"):
        if value not in booking_checks:
            raise RuntimeError("The live Neon booking statuses differ from the reviewed sample-data plan.")
    for value in ("OPEN", "IN_PROGRESS", "RESOLVED"):
        if value not in maintenance_checks:
            raise RuntimeError("The live Neon maintenance statuses differ from the reviewed sample-data plan.")
    print("Live Neon schema check: required columns, foreign keys, uniqueness, and insert constraints/statuses verified.")


def _validate_approved_plan(plan):
    if _approved_building_snapshot(plan) != APPROVED_BUILDINGS:
        raise RuntimeError("The live building identities differ from the approved snapshot; no writes were made.")
    counts = _counts(plan)
    if counts == APPROVED_INSERT_COUNTS:
        return
    no_op_counts = {name: 0 for name in APPROVED_INSERT_COUNTS}
    if counts != no_op_counts:
        raise RuntimeError("The live insert counts differ from the approved plan; no writes were made.")


def print_plan(plan):
    counts = _counts(plan)
    print("Target: verified configured Neon PostgreSQL (connection details hidden)")
    print(f"Existing buildings: {len(plan['eligible_buildings'])} (read-only; 0 inserts/updates/deletes)")
    print("Building identity snapshot: id | building_code | name")
    for building_id, code, name in _approved_building_snapshot(plan):
        print(f"  {building_id} | {code} | {name}")
    print("Proposed table counts (insert / skipped existing):")
    table_names = {
        "rooms": "rooms",
        "occupancy": "room_occupancy",
        "energy": "energy_readings",
        "bookings": "room_bookings",
        "maintenance": "maintenance_requests",
    }
    for name, table_name in table_names.items():
        print(f"  {table_name}: {counts[name]} / {plan['skipped'][name]}")
    print("  buildings: 0 / existing records preserved")
    print("  users: 0 / existing accounts preserved")
    print("  emergency_alerts: 0 / none created")
    print("  equipment/resources: 0 / no supporting table exists")
    print("Sample rows use DEMO room codes, simulated reading sources, and explicit sample booking/maintenance labels.")
    if not plan["student_available"]:
        print("Bookings are skipped because no existing student account is available; no account will be created.")


def apply_plan(session, models, plan):
    """Insert only planned rows inside the caller's transaction."""
    counts = {name: 0 for name in ("rooms", "occupancy", "energy", "bookings", "maintenance")}
    room_by_code = {}
    try:
        for item in plan["rooms"]:
            room = models.Room(**item["values"])
            session.add(room)
            room_by_code[item["code"]] = room
        session.flush()
        for room in session.query(models.Room).filter(
            models.Room.room_code.like("DEMO-%")
        ).all():
            if room.room_code not in room_by_code:
                room_by_code[room.room_code] = room

        for item in plan["occupancy"]:
            room = room_by_code.get(item["room_code"])
            if room is None:
                raise RuntimeError("A planned occupancy row has no matching sample room.")
            if item["room_id"] is None:
                item["room_id"] = room.id
            session.add(models.RoomOccupancy(room_id=room.id, **item["values"]))
            counts["occupancy"] += 1
        for item in plan["energy"]:
            session.add(models.EnergyReading(**item))
            counts["energy"] += 1
        for item in plan["bookings"]:
            room = room_by_code.get(item["room_code"])
            if room is None:
                raise RuntimeError("A planned booking has no matching sample room.")
            session.add(models.RoomBooking(room_id=room.id, **item["values"]))
            counts["bookings"] += 1
        for item in plan["maintenance"]:
            room = room_by_code.get(item["room_code"])
            if room is None:
                raise RuntimeError("A planned maintenance row has no matching sample room.")
            session.add(models.MaintenanceRequest(room_id=room.id, **item["values"]))
            counts["maintenance"] += 1
        counts["rooms"] = len(plan["rooms"])
        session.flush()
        return counts
    except Exception:
        session.rollback()
        raise


def parser():
    result = argparse.ArgumentParser(description="Preview or insert clearly marked sample records in configured Neon.")
    result.add_argument("--apply", action="store_true", help="Insert the reviewed sample plan; default is read-only preview.")
    result.add_argument("--confirm-neon-target", action="store_true", help="Confirm the configured Neon target before applying.")
    return result


def main(argv=None):
    args = parser().parse_args(argv)
    if args.apply and not args.confirm_neon_target:
        print("Refused: --apply also requires --confirm-neon-target.", file=sys.stderr)
        return 2
    session = None
    database = None
    try:
        database, models = load_application()
        session = database.SessionLocal()
        if not args.apply:
            session.execute(text("SET TRANSACTION READ ONLY"))
        # Always acquire the advisory lock in apply mode to serialize concurrent
        # seed runs; it changes no application rows.
        if args.apply:
            session.execute(
                text("SELECT pg_advisory_xact_lock(:key)"),
                {"key": ADVISORY_LOCK_KEY},
            )
        _validate_live_schema(session.connection())
        plan = _load_plan(session, models, datetime.now(timezone.utc))
        print_plan(plan)
        _validate_approved_plan(plan)
        if not args.apply:
            session.rollback()
            print("Dry run only. No database rows were written.")
            return 0
        confirmation = input("Type APPLY CAMPUS SAMPLE DATA TO NEON to insert this plan: ")
        if confirmation != "APPLY CAMPUS SAMPLE DATA TO NEON":
            session.rollback()
            print("Confirmation did not match. No database rows were written.")
            return 2
        inserted = apply_plan(session, models, plan)
        session.commit()
        print("Inserted rows:")
        for name, count in inserted.items():
            print(f"  {name}: {count}")
        print("  buildings: 0; users: 0; emergency_alerts: 0")
        return 0
    except Exception as error:
        if session is not None:
            session.rollback()
        # Deliberately suppress driver diagnostics, which can contain target details.
        print(f"Seed aborted ({type(error).__name__}); the transaction was rolled back.", file=sys.stderr)
        return 1
    finally:
        if session is not None:
            session.close()
        if database is not None:
            database.engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
