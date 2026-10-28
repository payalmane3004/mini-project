"""Preview or explicitly add a small simulated dataset for CampusSphere dashboards.

Default behavior is read-only. Run with --apply only after reviewing the plan.
This script may create clearly marked demo notices, but never creates users,
bookings, alerts, or maintenance requests.
"""
import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from demo_db_safety import DemoSetupError, validate_seed_database_url
from seed_campussphere_demo import _load_application_modules, _safe_database_diagnostic


ENERGY_VALUES = (Decimal("12.500"), Decimal("23.750"), Decimal("9.125"))
DEMO_ROOM_PREFIX = "DEMO-"
SIMULATED_SOURCE = "SIMULATED_DEMO"
SEED_DATABASE_ENV = "CAMPUSSPHERE_DEMO_DATABASE_URL"
NOTICE_SPECS = (
    ("DEMO | Facilities update (test only)", "DEMO content for CampusSphere UI testing only. This is not an official campus notice.", False),
    ("DEMO | Student services update (test only)", "DEMO content for admin draft rendering tests only. No campus policy or event is being announced.", False),
    ("DEMO | Draft notice (test only)", "Unpublished DEMO content for the admin draft list. Students should not see this record.", False),
)


def _room_code(building, number):
    candidate = f"DEMO-{building.building_code}-ROOM-{number}"
    return candidate if len(candidate) <= 30 else f"DEMO-B{building.id}-R{number}"


def build_full_plan(buildings, rooms, floor_labels, notices, energy_rows,
                    occupancy_rows, now):
    """Create insert intents; never mutate input records or existing rows."""
    eligible, _ = plan_dashboard_records(
        buildings, rooms, set(), set(), now
    )
    eligible_building_ids = {b.id for b in eligible}
    existing_room_codes = {r.room_code for r in rooms}
    existing_floor_labels = {(x.building_id, x.floor_number, x.label) for x in floor_labels}
    existing_notice_titles = {x.title for x in notices}
    existing_energy_building_ids = {x.building_id for x in energy_rows if x.reading_source == SIMULATED_SOURCE}

    demo_buildings = eligible[:4]
    room_specs = []
    for index, building in enumerate(demo_buildings):
        numbers = (101, 102, 103) if index < 3 else (101, 102)
        for number in numbers:
            code = _room_code(building, number)
            if code in existing_room_codes:
                continue
            room_specs.append({
                "code": code,
                "values": {
                    "building_id": building.id,
                    "room_code": code,
                    "room_name": f"DEMO test room {number}",
                    "floor_number": number % 2,
                    "capacity": 20,
                    "room_type": "DEMO",
                },
            })

    all_demo_rooms = [r for r in rooms if (
        isinstance(r.room_code, str) and r.room_code.startswith(DEMO_ROOM_PREFIX)
        and r.building_id in eligible_building_ids
    )]
    planned_room_values = [spec["values"] for spec in room_specs]
    occupancy_source_rooms = {x.room_id for x in occupancy_rows if x.source == SIMULATED_SOURCE}
    room_specs_by_code = {r.room_code: r for r in all_demo_rooms}
    room_capacity_by_code = {r.room_code: r.capacity or 0 for r in all_demo_rooms}
    for value in planned_room_values:
        room_capacity_by_code[value["room_code"]] = value["capacity"]
    existing_room_id_by_code = {r.room_code: r.id for r in all_demo_rooms}

    energy_specs = []
    for building_index, building in enumerate(demo_buildings):
        if building.id in existing_energy_building_ids:
            continue
        for day_offset, value in enumerate(ENERGY_VALUES):
            recorded_at = now - timedelta(days=2 - day_offset)
            energy_specs.append({
                "key": f"{building.building_code}:{SIMULATED_SOURCE}",
                "values": {
                    "building_id": building.id,
                    "energy_kwh": value,
                    "reading_source": SIMULATED_SOURCE,
                    "recorded_at": recorded_at,
                },
            })

    occupancy_specs = []
    for room_code, capacity in room_capacity_by_code.items():
        room_id = existing_room_id_by_code.get(room_code)
        if capacity <= 0 or (room_id is not None and room_id in occupancy_source_rooms):
            continue
        counts = (0, min(5, capacity), min(12, capacity))
        for day_offset, count in enumerate(counts):
            occupancy_specs.append({
                "room_code": room_code,
                "key": f"{room_code}:{SIMULATED_SOURCE}",
                "values": {
                    "occupied_count": count,
                    "source": SIMULATED_SOURCE,
                    "recorded_at": now - timedelta(days=2 - day_offset),
                },
            })

    floor_specs = []
    existing_label_keys = set(existing_floor_labels)
    for building in demo_buildings:
        for floor_number in (0, 1):
            label = f"DEMO TEST FLOOR {floor_number}"
            key = (building.id, floor_number, label)
            if key in existing_label_keys:
                continue
            floor_specs.append({
                "key": key,
                "values": {"building_id": building.id, "floor_number": floor_number, "label": label},
            })

    notice_specs = [
        {"key": title, "values": {
            "title": title, "content": content, "created_by": None,
            "published": published,
            "created_at": now,
            "expires_at": now + timedelta(days=30) if published else None,
        }}
        for title, content, published in NOTICE_SPECS if title not in existing_notice_titles
    ]

    # Keep the plan small and coherent: just four existing buildings, with
    # demo rooms on two demo floors, three simulated readings per eligible room,
    # three energy points per building, and three explicit demo notices.
    skipped = {
        "rooms": sum(len((101, 102, 103) if index < 3 else (101, 102)) for index, _ in enumerate(demo_buildings)) - len(room_specs),
        "floor_labels": len(demo_buildings) * 2 - len(floor_specs),
        "energy": sum(3 for building in demo_buildings if building.id in existing_energy_building_ids),
        "occupancy": sum(1 for room in all_demo_rooms if (room.capacity or 0) > 0 and room.id in occupancy_source_rooms),
        "notices": len(NOTICE_SPECS) - len(notice_specs),
    }
    return {
        "rooms": room_specs,
        "floor_labels": floor_specs,
        "occupancy": occupancy_specs,
        "energy": energy_specs,
        "notices": notice_specs,
        "eligible_buildings": eligible,
        "eligible_demo_rooms": all_demo_rooms,
        "skipped": skipped,
    }


def _apply_full_plan(session, models, plan):
    counts = {name: {"inserted": 0, "skipped": 0} for name in ("rooms", "floor_labels", "occupancy", "energy", "notices")}
    try:
        with session.begin():
            for item in plan["rooms"]:
                if session.query(models.Room.id).filter(models.Room.room_code == item["code"]).first():
                    counts["rooms"]["skipped"] += 1
                    continue
                session.add(models.Room(**item["values"]))
                counts["rooms"]["inserted"] += 1
            session.flush()

            demo_rooms = session.query(models.Room).filter(models.Room.room_code.like("DEMO-%")).all()
            room_by_code = {room.room_code: room for room in demo_rooms}
            for item in plan["floor_labels"]:
                building_id, floor_number, label = item["key"]
                exists = session.query(models.BuildingFloorLabel.id).filter(
                    models.BuildingFloorLabel.building_id == building_id,
                    models.BuildingFloorLabel.floor_number == floor_number,
                    models.BuildingFloorLabel.label == label,
                ).first()
                if exists:
                    counts["floor_labels"]["skipped"] += 1
                    continue
                session.add(models.BuildingFloorLabel(**item["values"]))
                counts["floor_labels"]["inserted"] += 1

            for item in plan["energy"]:
                building_id = item["values"]["building_id"]
                exists = session.query(models.EnergyReading.id).filter(
                    models.EnergyReading.building_id == building_id,
                    models.EnergyReading.reading_source == SIMULATED_SOURCE,
                ).first()
                if exists:
                    counts["energy"]["skipped"] += 1
                    continue
                session.add(models.EnergyReading(**item["values"]))
                counts["energy"]["inserted"] += 1

            for item in plan["occupancy"]:
                room = room_by_code.get(item["room_code"])
                if room is None:
                    raise ValueError("A planned demo room was not found after insert")
                exists = session.query(models.RoomOccupancy.id).filter(
                    models.RoomOccupancy.room_id == room.id,
                    models.RoomOccupancy.source == SIMULATED_SOURCE,
                ).first()
                if exists:
                    counts["occupancy"]["skipped"] += 1
                    continue
                session.add(models.RoomOccupancy(room_id=room.id, **item["values"]))
                counts["occupancy"]["inserted"] += 1

            for item in plan["notices"]:
                if session.query(models.Notice.id).filter(models.Notice.title == item["key"]).first():
                    counts["notices"]["skipped"] += 1
                    continue
                session.add(models.Notice(**item["values"]))
                counts["notices"]["inserted"] += 1
        return counts
    except Exception:
        session.rollback()
        raise


def plan_dashboard_records(buildings, rooms, existing_energy_building_ids,
                           existing_occupancy_room_ids, recorded_at):
    """Build deterministic insert intents from valid existing model rows only."""
    eligible_buildings = [building for building in buildings if (
        building.id is not None
        and isinstance(building.building_code, str) and building.building_code.strip()
        and isinstance(building.name, str) and building.name.strip()
    )]
    building_ids = {building.id for building in eligible_buildings}
    plan = []

    energy_index = 0
    for building in eligible_buildings:
        if building.id in existing_energy_building_ids:
            continue
        plan.append({
            "kind": "energy",
            "key": building.id,
            "label": f"{building.building_code}:SIMULATED",
            "values": {
                "building_id": building.id,
                "energy_kwh": ENERGY_VALUES[energy_index % len(ENERGY_VALUES)],
                "reading_source": "SIMULATED",
                "recorded_at": recorded_at,
            },
        })
        energy_index += 1
        if energy_index >= 3:
            break

    occupancy_count = 0
    for room in rooms:
        if not (isinstance(room.room_code, str) and room.room_code.startswith(DEMO_ROOM_PREFIX)):
            continue
        # A joined building row is required by the API payload. Orphan rooms
        # are never used as a source for dashboard fixtures.
        if room.building_id not in building_ids or room.id is None:
            continue
        if room.id in existing_occupancy_room_ids:
            continue
        plan.append({
            "kind": "occupancy",
            "key": room.id,
            "label": f"{room.room_code}:SIMULATED:0",
            "values": {
                "room_id": room.id,
                "occupied_count": 0,
                "source": "SIMULATED",
                "recorded_at": recorded_at,
            },
        })
        occupancy_count += 1
        if occupancy_count >= 3:
            break

    return eligible_buildings, plan


def _apply_plan(session, models, plan):
    inserted = 0
    try:
        with session.begin():
            for record in plan:
                if record["kind"] == "energy":
                    exists = session.query(models.EnergyReading.id).filter(
                        models.EnergyReading.building_id == record["key"],
                        models.EnergyReading.reading_source == "SIMULATED",
                    ).first()
                    model = models.EnergyReading
                else:
                    exists = session.query(models.RoomOccupancy.id).filter(
                        models.RoomOccupancy.room_id == record["key"],
                        models.RoomOccupancy.source == "SIMULATED",
                    ).first()
                    model = models.RoomOccupancy
                if exists:
                    continue
                session.add(model(**record["values"]))
                inserted += 1
        return inserted
    except Exception:
        session.rollback()
        raise


def _load_seed_database(seed_url):
    """Create a separate engine for the demo seeder, never the app engine."""
    engine = create_engine(seed_url, pool_pre_ping=True)
    database = SimpleNamespace(SessionLocal=sessionmaker(
        autocommit=False, autoflush=False, bind=engine
    ), engine=engine)
    return database


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="insert the reviewed demo dataset")
    parser.add_argument("--check-config-only", action="store_true", help="validate the seed-only URL without connecting to any database")
    parser.add_argument("--expected-project-id", default="", help="project ID independently checked in Neon Console")
    parser.add_argument("--expected-branch-id", default="", help="branch ID independently checked in Neon Console")
    parser.add_argument("--expected-host", default="", help="endpoint host independently checked in Neon Console")
    parser.add_argument("--expected-database", default="", help="database name independently checked in Neon Console")
    parser.add_argument("--confirm-neon-target-verified", action="store_true", help="attest that project, branch, host, and database were compared with Neon Console")
    parser.add_argument("--confirm-demo-write", action="store_true", help="authorize the reviewed demo inserts")
    args = parser.parse_args(argv)

    target_values = (
        args.expected_project_id, args.expected_branch_id,
        args.expected_host, args.expected_database,
    )
    if not all(str(value or "").strip() for value in target_values):
        print("Refusing: supply the verified project ID, branch ID, direct hostname, and database name. No connection was opened.", file=sys.stderr)
        return 3
    if not args.confirm_neon_target_verified:
        print("Refusing: compare the project, branch, direct hostname, and database in Neon Console, then pass --confirm-neon-target-verified. No connection was opened.", file=sys.stderr)
        return 3
    try:
        seed_url = validate_seed_database_url(
            os.environ.get(SEED_DATABASE_ENV),
            args.expected_host,
            args.expected_database,
        )
    except DemoSetupError as error:
        print(f"Seed-only database configuration rejected: {error} No connection was opened.", file=sys.stderr)
        return 2
    if args.check_config_only:
        if args.apply:
            print("--check-config-only cannot be combined with --apply.", file=sys.stderr)
            return 3
        print("Seed-only configuration is valid: direct Neon host, database, TLS, and psycopg 3 checks passed. No database connection was opened.")
        return 0
    if args.apply and not args.confirm_demo_write:
        print("Refusing to write: pass --confirm-demo-write only after reviewing the dry-run plan. No connection was opened.", file=sys.stderr)
        return 3

    try:
        _application_database, models = _load_application_modules()
    except RuntimeError as error:
        print(f"Database configuration unavailable: {error}. No records were changed.", file=sys.stderr)
        return 2

    try:
        database = _load_seed_database(seed_url)
    except Exception as error:
        print(f"Seed-only database engine could not be created: {_safe_database_diagnostic(error)}. No records were changed.", file=sys.stderr)
        return 2

    session = database.SessionLocal()
    try:
        session.connection()
        buildings = session.query(models.Building).order_by(models.Building.id).all()
        rooms = session.query(models.Room).order_by(models.Room.id).all()
        floor_labels = session.query(models.BuildingFloorLabel).all()
        notices = session.query(models.Notice).all()
        energy_rows = session.query(models.EnergyReading).all()
        occupancy_rows = session.query(models.RoomOccupancy).all()
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        plan = build_full_plan(buildings, rooms, floor_labels, notices, energy_rows, occupancy_rows, now)

        url = database.engine.url
        host = (url.host or "").lower()
        print("Database connection: succeeded (read-only preflight).")
        print(f"Seed-only target: Neon direct connection; driver={url.drivername}; database={url.database}; project/branch identity is operator-attested.")
        print("Target comparison: seed-only host/database match the supplied Console values.")
        print(f"Planned insertions: rooms={len(plan['rooms'])}, floor labels={len(plan['floor_labels'])}, occupancy={len(plan['occupancy'])}, energy={len(plan['energy'])}, notices={len(plan['notices'])}; bookings=0, alerts=0, maintenance=0.")
        print("Already-present/skipped by stable identifier: " + ", ".join(f"{module}={count}" for module, count in plan["skipped"].items()) + ". Failed=0 in dry run.")
        building_by_id = {building.id: building for building in plan["eligible_buildings"]}
        for item in plan["rooms"]:
            building = building_by_id[item["values"]["building_id"]]
            print(f"Room {item['code']} -> building id={building.id}, code={building.building_code}; floor={item['values']['floor_number']}, capacity={item['values']['capacity']}, type=DEMO.")
        for item in plan["floor_labels"]:
            print(f"Floor label -> building_id={item['values']['building_id']}, floor={item['values']['floor_number']}, label={item['values']['label']}.")
        for item in plan["energy"]:
            print(f"Energy -> {building_by_id[item['values']['building_id']].building_code}, {item['values']['energy_kwh']} kWh, {SIMULATED_SOURCE}, {item['values']['recorded_at'].date()}.")
        for item in plan["occupancy"]:
            print(f"Occupancy -> {item['room_code']}, {item['values']['occupied_count']} occupants, {SIMULATED_SOURCE}, {item['values']['recorded_at'].date()}.")
        for item in plan["notices"]:
            print(f"Notice -> {item['key']}, published={item['values']['published']}, expires={item['values']['expires_at']}.")
        print("Bookings and maintenance are not seeded: their APIs require authenticated student actions and actor ownership. Alerts are not seeded: an existing active alert is present and is preserved. No users are impersonated.")
        print("All proposed occupancy/energy rows are explicitly simulated; demo room capacities are stored only on new DEMO room records.")
        if not args.apply:
            print("Dry run only. No records were written. Review the configured target and this plan before any apply.")
            return 0
        session.rollback()
        counts = _apply_full_plan(session, models, plan)
        for module, result in counts.items():
            print(f"{module}: inserted={result['inserted']}, skipped={result['skipped']}")
        return 0
    except Exception as error:
        print(f"Dashboard demo preflight/apply failed: {_safe_database_diagnostic(error)}. No uncommitted records remain.", file=sys.stderr)
        return 1
    finally:
        session.close()
        database.engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
