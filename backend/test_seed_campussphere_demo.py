import contextlib
import builtins
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import seed_campussphere_demo as seeder


class FakeQuery:
    def __init__(self, session, model):
        self.session, self.model = session, model

    def order_by(self, *_):
        return self

    def all(self):
        return list(self.session.buildings)

    def filter(self, condition):
        self.code = condition[1]
        return self

    def first(self):
        if self.model is self.session.models.Building:
            return next((b for b in self.session.buildings if b.building_code == self.code), None)
        return self.session.rooms.get(self.code)


class FakeSession:
    def __init__(self, models, buildings=(), rooms=None, fail_add=False):
        self.models = models
        self.buildings = list(buildings)
        self.rooms = dict(rooms or {})
        self.fail_add = fail_add
        self.added = []
        self.rolled_back = False
        self.connected = False

    def connection(self):
        self.connected = True

    def query(self, model):
        return FakeQuery(self, model)

    def add(self, value):
        if self.fail_add:
            raise RuntimeError("simulated insert failure")
        self.added.append(value)

    def begin(self):
        return contextlib.nullcontext()

    def rollback(self):
        self.rolled_back = True
        self.added.clear()

    def close(self):
        pass


def fixtures(buildings=(), rooms=None):
    class Attribute:
        def __init__(self, name):
            self.name = name

        def __eq__(self, value):
            return (self.name, value)

    class Building:
        def __init__(self, **values):
            self.__dict__.update(values)

    class Room:
        def __init__(self, **values):
            self.__dict__.update(values)
    Building.id = Attribute("building.id")
    Building.building_code = Attribute("building.building_code")
    Building.name = Attribute("building.name")
    Room.id = Attribute("room.id")
    Room.room_code = Attribute("room.room_code")
    models = SimpleNamespace(Building=Building, Room=Room)
    rows = [SimpleNamespace(id=i + 1, building_code=code, name=name) for i, (code, name) in enumerate(buildings)]
    return models, rows, rooms or {}


class DemoSeederTests(unittest.TestCase):
    def test_room_helper_plans_an_existing_building_without_writes(self):
        models, buildings, rooms = fixtures([("BLK-A", "Building A")])
        session = FakeSession(models, buildings, rooms)
        eligible, planned = seeder._demo_plan(session, models)
        self.assertEqual(len(eligible), 1)
        self.assertEqual(planned[0][1], "DEMO-BLK-A-ROOM-101")
        self.assertEqual(session.added, [])

    def test_database_connection_failure_is_sanitized(self):
        output = seeder._safe_database_diagnostic(OSError("connection failed to ep-secret.neon.tech password=secret"))
        self.assertNotIn("ep-secret", output)
        self.assertNotIn("secret", output)
        self.assertIn("OSError", output)

    def test_database_import_without_environment_configuration_is_actionable(self):
        real_import = builtins.__import__

        def import_without_database_config(name, *args, **kwargs):
            if name == "database":
                raise ValueError("DATABASE_URL is missing; configure it in backend/.env or the process environment")
            return real_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=import_without_database_config):
            with self.assertRaisesRegex(RuntimeError, "Missing environment configuration"):
                seeder._load_application_modules()

    def test_matching_demo_room_is_not_proposed_twice(self):
        models, buildings, _ = fixtures([("A", "A")])
        existing = {"DEMO-A-ROOM-101": object()}
        session = FakeSession(models, buildings, existing)
        eligible, plan = seeder._demo_plan(session, models)
        self.assertEqual(len(eligible), 1)
        self.assertEqual(plan, [])

    def test_apply_skips_a_room_created_after_preflight(self):
        models, buildings, _ = fixtures([("A", "A")])
        session = FakeSession(models, buildings, {"DEMO-A-ROOM-101": object()})
        self.assertEqual(seeder._apply_plan(session, models, [(buildings[0], "DEMO-A-ROOM-101")]), 0)
        self.assertEqual(session.added, [])

    def test_insert_failure_rolls_back(self):
        models, buildings, _ = fixtures([("A", "A")])
        session = FakeSession(models, buildings, fail_add=True)
        with self.assertRaisesRegex(RuntimeError, "simulated insert failure"):
            seeder._apply_plan(session, models, [(buildings[0], "DEMO-A-ROOM-101")])
        self.assertTrue(session.rolled_back)


if __name__ == "__main__":
    unittest.main()
