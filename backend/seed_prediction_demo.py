"""Add deterministic forecast-history samples to the marked local SQLite demo only."""

import argparse
from datetime import datetime, time, timedelta, timezone
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

from demo_mode import DEMO_DATABASE_PATH, DEMO_MARKER_KEY, DEMO_MARKER_VALUE, DEMO_METADATA_TABLE


HISTORY_DAYS = 56
SAMPLE_HOURS = (9, 11, 13, 15, 17, 19)
SOURCE = "SIMULATED_PREDICTION_DEMO"
HOUR_OCCUPANCY_FACTOR = {9: 0.42, 11: 0.65, 13: 0.5, 15: 0.78, 17: 0.9, 19: 0.3}


class SeedRefused(ValueError):
    pass


def _key_timestamp(value):
    if isinstance(value, datetime):
        return value.replace(tzinfo=None).strftime("%Y-%m-%d %H:%M")
    return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None).strftime("%Y-%m-%d %H:%M")


def _validate_fixture(connection):
    path = DEMO_DATABASE_PATH.resolve(strict=True)
    if DEMO_DATABASE_PATH.is_symlink() or not path.is_file():
        raise SeedRefused("The marked local demo database must already exist as a regular file.")
    table_names = set(connection.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).scalars())
    required = {DEMO_METADATA_TABLE, "buildings", "rooms", "room_occupancy", "energy_readings"}
    if not required.issubset(table_names):
        raise SeedRefused("Required local demo tables are missing; no database setup is performed by this script.")
    marker = connection.execute(
        text(f"SELECT value FROM {DEMO_METADATA_TABLE} WHERE key=:key"), {"key": DEMO_MARKER_KEY}
    ).scalar_one_or_none()
    if marker != DEMO_MARKER_VALUE:
        raise SeedRefused("The database is not the marked CampusSphere local demo fixture.")
    return path


def build_plan(connection, now=None):
    now = now or datetime.now(timezone.utc).replace(tzinfo=None, minute=0, second=0, microsecond=0)
    buildings = connection.execute(
        text("SELECT id, building_code, name FROM buildings ORDER BY building_code")
    ).mappings().all()
    rooms = connection.execute(
        text("SELECT id, building_id, room_code, capacity, room_type FROM rooms ORDER BY room_code")
    ).mappings().all()
    if not buildings or not rooms or any(room["capacity"] is None or room["capacity"] <= 0 for room in rooms):
        raise SeedRefused("The local demo fixture needs existing buildings and rooms with positive capacities.")

    start_day = now.date() - timedelta(days=HISTORY_DAYS - 1)
    end_day = now.date()
    start = datetime.combine(start_day, time.min)
    end = now.replace(tzinfo=None)
    existing_occupancy = {
        (row["room_id"], _key_timestamp(row["recorded_at"])): row
        for row in connection.execute(
            text("SELECT id, room_id, occupied_count, source, recorded_at FROM room_occupancy WHERE recorded_at >= :start AND recorded_at <= :end"),
            {"start": start, "end": end},
        ).mappings()
    }
    existing_energy = {
        (row["building_id"], _key_timestamp(row["recorded_at"])): row
        for row in connection.execute(
            text("SELECT id, building_id, energy_kwh, reading_source, recorded_at FROM energy_readings WHERE recorded_at >= :start AND recorded_at <= :end"),
            {"start": start, "end": end},
        ).mappings()
    }

    occupancy_additions = []
    occupancy_updates = []
    energy_additions = []
    energy_updates = []
    for day_offset in range(HISTORY_DAYS):
        day = start_day + timedelta(days=day_offset)
        weekday_factor = 0.88 if day.weekday() < 5 else 0.32
        week_index = day_offset // 7
        for hour in SAMPLE_HOURS:
            recorded_at = datetime.combine(day, time(hour))
            if recorded_at > now:
                continue
            stamp_key = _key_timestamp(recorded_at)
            hour_factor = HOUR_OCCUPANCY_FACTOR[hour]
            total_by_building = {building["id"]: 0 for building in buildings}
            for room_index, room in enumerate(rooms):
                # A small, repeatable subset represents genuinely low-use rooms.
                room_factor = 0.08 if room_index % 10 == 0 else 0.78 + ((room_index * 7) % 20) / 100
                gradual_change = 0.96 + ((week_index + room_index) % 4) * 0.02
                occupied = round(room["capacity"] * weekday_factor * hour_factor * room_factor * gradual_change)
                occupied = max(0, min(room["capacity"], occupied))
                total_by_building[room["building_id"]] = total_by_building.get(room["building_id"], 0) + occupied
                key = (room["id"], stamp_key)
                current = existing_occupancy.get(key)
                if current is None:
                    occupancy_additions.append({
                        "room_id": room["id"], "occupied_count": occupied,
                        "source": SOURCE, "recorded_at": recorded_at,
                    })
                elif current["source"] == SOURCE and current["occupied_count"] != occupied:
                    occupancy_updates.append({"id": current["id"], "occupied_count": occupied})
            for building_index, building in enumerate(buildings):
                building_id = building["id"]
                occupancy_load = total_by_building.get(building_id, 0)
                peak_adjustment = 2.0 if hour in (15, 17) else 0.0
                energy_kwh = round(6.0 + building_index * 1.4 + occupancy_load * 0.11 + peak_adjustment, 3)
                key = (building_id, stamp_key)
                current = existing_energy.get(key)
                if current is None:
                    energy_additions.append({
                        "building_id": building_id, "energy_kwh": energy_kwh,
                        "reading_source": SOURCE, "recorded_at": recorded_at,
                    })
                elif current["reading_source"] == SOURCE and float(current["energy_kwh"]) != energy_kwh:
                    energy_updates.append({"id": current["id"], "energy_kwh": energy_kwh})

    return {
        "buildings": len(buildings),
        "rooms": len(rooms),
        "occupancy_existing": len(existing_occupancy),
        "energy_existing": len(existing_energy),
        "occupancy_additions": occupancy_additions,
        "occupancy_updates": occupancy_updates,
        "energy_additions": energy_additions,
        "energy_updates": energy_updates,
        "start": start,
        "end": end,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Insert only missing tagged readings into the verified local demo fixture")
    args = parser.parse_args()
    if not DEMO_DATABASE_PATH.is_file() or DEMO_DATABASE_PATH.is_symlink():
        raise SeedRefused("The local demo database must already exist; this script does not create databases.")
    url = URL.create("sqlite", database=str(DEMO_DATABASE_PATH.resolve()))
    engine = create_engine(url)
    try:
        with engine.connect() as connection:
            _validate_fixture(connection)
            plan = build_plan(connection)
        print(f"Target: marked local demo SQLite ({plan['buildings']} buildings, {plan['rooms']} rooms)")
        print(f"Window: {plan['start'].isoformat()} through {plan['end'].isoformat()}")
        print(f"Would add occupancy readings: {len(plan['occupancy_additions'])}")
        print(f"Would adjust existing tagged demo occupancy readings: {len(plan['occupancy_updates'])}")
        print(f"Would add energy readings: {len(plan['energy_additions'])}")
        print(f"Would adjust existing tagged demo energy readings: {len(plan['energy_updates'])}")
        print("Source label: SIMULATED_PREDICTION_DEMO")
        if not args.apply:
            print("Preview only. Pass --apply to insert the missing local demo readings.")
            return
        with engine.begin() as connection:
            _validate_fixture(connection)
            plan = build_plan(connection)
            connection.execute(text(
                "INSERT INTO room_occupancy (room_id, occupied_count, source, recorded_at) "
                "VALUES (:room_id, :occupied_count, :source, :recorded_at)"
            ), plan["occupancy_additions"])
            connection.execute(text(
                "INSERT INTO energy_readings (building_id, energy_kwh, reading_source, recorded_at) "
                "VALUES (:building_id, :energy_kwh, :reading_source, :recorded_at)"
            ), plan["energy_additions"])
            connection.execute(text(
                "UPDATE room_occupancy SET occupied_count=:occupied_count WHERE id=:id AND source=:source"
            ), [dict(row, source=SOURCE) for row in plan["occupancy_updates"]])
            connection.execute(text(
                "UPDATE energy_readings SET energy_kwh=:energy_kwh WHERE id=:id AND reading_source=:source"
            ), [dict(row, source=SOURCE) for row in plan["energy_updates"]])
        print("Applied missing readings and refreshed only this script's tagged samples in the marked local demo fixture.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    try:
        main()
    except SeedRefused as error:
        raise SystemExit(str(error)) from None
