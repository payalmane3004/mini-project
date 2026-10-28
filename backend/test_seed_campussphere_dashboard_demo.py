import contextlib
import io
import os
import unittest
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

import seed_campussphere_dashboard_demo as seeder
from demo_db_safety import DemoSetupError, validate_seed_database_url


class Model:
    id = "id"
    building_id = "building_id"
    reading_source = "reading_source"
    room_id = "room_id"
    source = "source"

    def __init__(self, **values):
        self.__dict__.update(values)


class Query:
    def __init__(self, rows=()):
        self.rows = list(rows)

    def order_by(self, *_):
        return self

    def filter(self, *_):
        return self

    def all(self):
        return list(self.rows)

    def first(self):
        return None


class Session:
    def __init__(self, buildings=(), rooms=(), fail_add=False):
        self.fail_add = fail_add
        self.buildings = list(buildings)
        self.rooms = list(rooms)
        self.added = []
        self.rolled_back = False
        self.connected = False

    def connection(self):
        self.connected = True

    def flush(self):
        pass

    def begin(self):
        return contextlib.nullcontext()

    def query(self, model):
        if model is Models.Building:
            return Query(self.buildings)
        if model is Models.Room:
            return Query(self.rooms)
        return Query()

    def add(self, row):
        if self.fail_add:
            raise RuntimeError("insert failure")
        self.added.append(row)

    def rollback(self):
        self.rolled_back = True
        self.added.clear()

    def close(self):
        pass


def data():
    buildings = [
        SimpleNamespace(id=1, building_code="BU-002", name="Main Building"),
        SimpleNamespace(id=2, building_code="BU-019", name="PE"),
    ]
    rooms = [
        SimpleNamespace(id=11, room_code="DEMO-BU-002-ROOM-101", building_id=1, capacity=0),
        SimpleNamespace(id=12, room_code="DEMO-ORPHAN-ROOM-101", building_id=99, capacity=20),
        SimpleNamespace(id=13, room_code="OFFICIAL-ROOM-101", building_id=1, capacity=20),
    ]
    return buildings, rooms


class Column:
    def __eq__(self, _):
        return True

    def like(self, _):
        return True


class Models:
    class Building:
        id = Column()

    class Room:
        id = Column()
        room_code = Column()
        building_id = Column()
        capacity = Column()

    class BuildingFloorLabel(Model):
        id = Column()
        building_id = Column()
        floor_number = Column()
        label = Column()

    class Notice(Model):
        id = Column()
        title = Column()

    class EnergyReading(Model):
        id = Column()
        building_id = Column()
        reading_source = Column()

    class RoomOccupancy(Model):
        id = Column()
        room_id = Column()
        source = Column()


class DashboardDemoSeederTests(unittest.TestCase):
    HOST = "ep-test.c-4.ap-southeast-1.aws.neon.tech"
    SEED_URL = f"postgresql://demo:demo@{HOST}/test?sslmode=require"

    def target_args(self):
        return [
            "--expected-project-id", "project-1",
            "--expected-branch-id", "br-1",
            "--expected-host", self.HOST,
            "--expected-database", "test",
            "--confirm-neon-target-verified",
        ]

    def test_seed_url_normalizes_generic_postgresql_to_psycopg3(self):
        url = validate_seed_database_url(
            self.SEED_URL, self.HOST, "test"
        )
        self.assertEqual(url.drivername, "postgresql+psycopg")
        self.assertEqual(url.host, self.HOST)

    def test_seed_url_rejects_pooler_or_mismatched_target(self):
        with self.assertRaisesRegex(DemoSetupError, "unpooled"):
            validate_seed_database_url(
                "postgresql://demo:demo@ep-test-pooler.c-4.ap-southeast-1.aws.neon.tech/test?sslmode=require",
                "ep-test-pooler.c-4.ap-southeast-1.aws.neon.tech", "test",
            )
        with self.assertRaisesRegex(DemoSetupError, "host does not match"):
            validate_seed_database_url(self.SEED_URL, "ep-other.c-4.ap-southeast-1.aws.neon.tech", "test")
        with self.assertRaisesRegex(DemoSetupError, "database does not match"):
            validate_seed_database_url(self.SEED_URL, self.HOST, "other")
        with self.assertRaisesRegex(DemoSetupError, "not set"):
            validate_seed_database_url(None, self.HOST, "test")

    def test_default_cli_dry_run_performs_no_adds(self):
        buildings, rooms = data()
        session = Session(buildings, rooms)
        from sqlalchemy.engine import URL
        database = SimpleNamespace(SessionLocal=lambda: session, engine=SimpleNamespace(dispose=lambda: None, url=URL.create("postgresql+psycopg", host=self.HOST, database="test", query={"sslmode": "require"})))
        output = io.StringIO()
        with patch.dict(os.environ, {seeder.SEED_DATABASE_ENV: self.SEED_URL}), patch.object(seeder, "_load_application_modules", return_value=(database, Models)), patch.object(seeder, "_load_seed_database", return_value=database), contextlib.redirect_stdout(output):
            self.assertEqual(seeder.main(self.target_args()), 0)
        self.assertTrue(session.connected)
        self.assertEqual(session.added, [])
        self.assertIn("rooms=5", output.getvalue())
        self.assertIn("energy=6", output.getvalue())
        self.assertIn("notices=3", output.getvalue())
        self.assertIn("SIMULATED_DEMO", output.getvalue())
        self.assertIn("Dry run only", output.getvalue())

    def test_apply_requires_target_confirmation_and_does_not_write_without_it(self):
        buildings, rooms = data()
        session = Session(buildings, rooms)
        from sqlalchemy.engine import URL
        database = SimpleNamespace(SessionLocal=lambda: session, engine=SimpleNamespace(dispose=lambda: None, url=URL.create("postgresql+psycopg", host=self.HOST, database="test", query={"sslmode": "require"})))
        output = io.StringIO()
        error_output = io.StringIO()
        with patch.dict(os.environ, {seeder.SEED_DATABASE_ENV: self.SEED_URL}), patch.object(seeder, "_load_application_modules", return_value=(database, Models)), patch.object(seeder, "_load_seed_database", return_value=database), contextlib.redirect_stdout(output), contextlib.redirect_stderr(error_output):
            self.assertEqual(seeder.main(self.target_args() + ["--apply"]), 3)
        self.assertEqual(session.added, [])
        self.assertIn("Refusing to write", error_output.getvalue())

    def test_dry_run_attests_console_target_and_matches_configured_host_database(self):
        buildings, rooms = data()
        session = Session(buildings, rooms)
        from sqlalchemy.engine import URL
        database = SimpleNamespace(SessionLocal=lambda: session, engine=SimpleNamespace(dispose=lambda: None, url=URL.create("postgresql+psycopg", host=self.HOST, database="test", query={"sslmode": "require"})))
        output = io.StringIO()
        with patch.dict(os.environ, {seeder.SEED_DATABASE_ENV: self.SEED_URL}), patch.object(seeder, "_load_application_modules", return_value=(database, Models)), patch.object(seeder, "_load_seed_database", return_value=database), contextlib.redirect_stdout(output):
            args = self.target_args()
            self.assertEqual(seeder.main(args), 0)
        self.assertIn("Target comparison: seed-only host/database match", output.getvalue())
        self.assertEqual(session.added, [])

    def test_dry_run_refuses_a_mismatched_console_host(self):
        buildings, rooms = data()
        session = Session(buildings, rooms)
        from sqlalchemy.engine import URL
        database = SimpleNamespace(SessionLocal=lambda: session, engine=SimpleNamespace(dispose=lambda: None, url=URL.create("postgresql+psycopg", host=self.HOST, database="test", query={"sslmode": "require"})))
        args = self.target_args()
        args[args.index("--expected-host") + 1] = "ep-other.c-4.ap-southeast-1.aws.neon.tech"
        with patch.dict(os.environ, {seeder.SEED_DATABASE_ENV: self.SEED_URL}), patch.object(seeder, "_load_application_modules", return_value=(database, Models)), patch.object(seeder, "_load_seed_database", return_value=database), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(seeder.main(args), 2)
        self.assertEqual(session.added, [])

    def test_missing_seed_only_url_never_falls_back_to_application_database(self):
        output = io.StringIO()
        with patch.dict(os.environ, {}, clear=True), patch.object(seeder, "_load_application_modules") as app_loader, contextlib.redirect_stderr(output):
            self.assertEqual(seeder.main(self.target_args()), 2)
        app_loader.assert_not_called()
        self.assertIn(seeder.SEED_DATABASE_ENV, output.getvalue())

    def test_config_only_dry_run_validates_without_loading_models_or_connecting(self):
        output = io.StringIO()
        with patch.dict(os.environ, {seeder.SEED_DATABASE_ENV: self.SEED_URL}), patch.object(seeder, "_load_application_modules") as app_loader, patch.object(seeder, "_load_seed_database") as db_loader, contextlib.redirect_stdout(output):
            self.assertEqual(seeder.main(self.target_args() + ["--check-config-only"]), 0)
        app_loader.assert_not_called()
        db_loader.assert_not_called()
        self.assertIn("No database connection was opened", output.getvalue())

    def test_full_plan_uses_valid_building_links_and_simulated_values(self):
        buildings, rooms = data()
        now = datetime(2026, 10, 26, 12, tzinfo=timezone.utc)
        plan = seeder.build_full_plan(buildings, rooms, [], [], [], [], now)
        building_ids = {building.id for building in plan["eligible_buildings"]}
        self.assertTrue(all(row["values"]["building_id"] in building_ids for row in plan["rooms"]))
        planned_room_codes = {row["code"] for row in plan["rooms"]}
        self.assertEqual({row["room_code"] for row in plan["occupancy"]}, planned_room_codes)
        self.assertTrue(all(row["values"]["source"] == "SIMULATED_DEMO" for row in plan["occupancy"]))
        self.assertTrue(all(row["values"]["reading_source"] == "SIMULATED_DEMO" for row in plan["energy"]))
        self.assertTrue(all(0 <= row["values"]["occupied_count"] <= 20 for row in plan["occupancy"]))
        self.assertEqual(len(plan["notices"]), 3)
        self.assertTrue(all(not row["values"]["published"] for row in plan["notices"]))

    def test_full_plan_is_idempotent_after_records_exist(self):
        buildings, rooms = data()
        now = datetime(2026, 10, 26, 12, tzinfo=timezone.utc)
        first = seeder.build_full_plan(buildings, rooms, [], [], [], [], now)
        applied_rooms = [SimpleNamespace(id=100 + i, **item["values"]) for i, item in enumerate(first["rooms"])]
        applied_floors = [SimpleNamespace(**item["values"]) for item in first["floor_labels"]]
        applied_notices = [SimpleNamespace(**item["values"]) for item in first["notices"]]
        applied_energy = [SimpleNamespace(building_id=building.id, reading_source="SIMULATED_DEMO") for building in buildings]
        applied_occupancy = [SimpleNamespace(room_id=room.id, source="SIMULATED_DEMO") for room in applied_rooms]
        rerun = seeder.build_full_plan(
            buildings, rooms + applied_rooms, applied_floors, applied_notices,
            applied_energy, applied_occupancy, now,
        )
        for module in ("rooms", "floor_labels", "energy", "occupancy", "notices"):
            self.assertEqual(rerun[module], [])

    def test_plan_uses_existing_buildings_and_linked_demo_rooms_only(self):
        buildings, rooms = data()
        eligible, plan = seeder.plan_dashboard_records(
            buildings, rooms, set(), set(), datetime(2026, 10, 26, 12, tzinfo=timezone.utc)
        )
        self.assertEqual([row.id for row in eligible], [1, 2])
        self.assertEqual([item["kind"] for item in plan], ["energy", "energy", "occupancy"])
        self.assertEqual({item["values"].get("building_id") for item in plan if item["kind"] == "energy"}, {1, 2})
        self.assertEqual(plan[-1]["values"]["room_id"], 11)
        self.assertEqual(plan[-1]["values"]["occupied_count"], 0)
        self.assertTrue(all(item["values"].get("reading_source", item["values"].get("source")) == "SIMULATED" for item in plan))
        self.assertEqual(plan[0]["values"]["energy_kwh"], Decimal("12.500"))

    def test_rerun_skips_existing_simulated_records_by_foreign_key(self):
        buildings, rooms = data()
        _, plan = seeder.plan_dashboard_records(buildings, rooms, {1, 2}, {11}, datetime.now(timezone.utc))
        self.assertEqual(plan, [])

    def test_insert_failure_rolls_back_all_pending_records(self):
        session = Session(fail_add=True)
        plan = [{"kind": "energy", "key": 1, "values": {"building_id": 1}}]
        models = SimpleNamespace(
            EnergyReading=Model,
            RoomOccupancy=Model,
        )
        with self.assertRaisesRegex(RuntimeError, "insert failure"):
            seeder._apply_plan(session, models, plan)
        self.assertTrue(session.rolled_back)
        self.assertEqual(session.added, [])

    def test_full_apply_failure_rolls_back_all_pending_records(self):
        session = Session(fail_add=True)
        plan = {
            "rooms": [], "floor_labels": [], "occupancy": [], "notices": [],
            "energy": [{"values": {"building_id": 1, "energy_kwh": Decimal("1.000"), "reading_source": "SIMULATED_DEMO", "recorded_at": datetime.now(timezone.utc)}}],
        }
        with self.assertRaisesRegex(RuntimeError, "insert failure"):
            seeder._apply_full_plan(session, Models, plan)
        self.assertTrue(session.rolled_back)
        self.assertEqual(session.added, [])


if __name__ == "__main__":
    unittest.main()
