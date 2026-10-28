from datetime import datetime, timezone
from types import SimpleNamespace
import unittest

from seed_campus_records import (
    SIMULATED_SOURCE,
    build_plan,
)


def fixtures():
    buildings = [
        SimpleNamespace(id=index, building_code=f"BU-{index:03d}", name=f"Building {index}")
        for index in range(1, 36)
    ]
    rooms = [
        SimpleNamespace(
            id=index, building_id=building_id,
            room_code=f"DEMO-BU-{building_id:03d}-ROOM-101",
            capacity=0,
        )
        for index, building_id in enumerate((2, 19, 26), start=1)
    ]
    return buildings, rooms


class SeedPlanTests(unittest.TestCase):
    def test_plan_counts_and_preserves_existing_fixture_rooms(self):
        buildings, rooms = fixtures()
        plan = build_plan(
            buildings, rooms, [], [], set(), set(), student_id=51,
            now=datetime(2026, 10, 28, 12, tzinfo=timezone.utc),
        )

        self.assertEqual(len(buildings), 35)
        self.assertEqual(len(plan["rooms"]), 137)
        self.assertEqual(plan["skipped"]["rooms"], 3)
        self.assertEqual(len(plan["occupancy"]), 411)
        self.assertEqual(len(plan["energy"]), 105)
        self.assertEqual(len(plan["bookings"]), 12)
        self.assertEqual(len(plan["maintenance"]), 12)
        self.assertTrue(all(item["values"]["source"] == SIMULATED_SOURCE for item in plan["occupancy"]))
        self.assertTrue(all(room.capacity == 0 for room in rooms))

    def test_rerun_plan_has_no_duplicate_inserts(self):
        buildings, rooms = fixtures()
        initial = build_plan(
            buildings, rooms, [], [], set(), set(), student_id=51,
            now=datetime(2026, 10, 28, 12, tzinfo=timezone.utc),
        )
        seeded_rooms = list(rooms)
        next_id = 100
        for item in initial["rooms"]:
            seeded_rooms.append(SimpleNamespace(
                id=next_id, building_id=item["values"]["building_id"],
                room_code=item["code"], capacity=item["values"]["capacity"],
            ))
            next_id += 1
        occupancy = [
            SimpleNamespace(room_id=room.id, source=SIMULATED_SOURCE)
            for room in seeded_rooms if room.capacity > 0 and room.room_code.startswith("DEMO-")
        ]
        energy = [SimpleNamespace(building_id=building.id, reading_source=SIMULATED_SOURCE) for building in buildings]
        rerun = build_plan(
            buildings, seeded_rooms, occupancy, energy,
            {item["purpose"] for item in initial["bookings"]},
            {item["title"] for item in initial["maintenance"]},
            student_id=51, now=datetime(2026, 10, 28, 12, tzinfo=timezone.utc),
        )

        self.assertTrue(all(not rerun[name] for name in ("rooms", "occupancy", "energy", "bookings", "maintenance")))
        self.assertEqual(rerun["skipped"]["rooms"], 140)
        self.assertEqual(rerun["skipped"]["occupancy"], 3 * (140 - 3))
        self.assertEqual(rerun["skipped"]["energy"], 105)
        self.assertEqual(rerun["skipped"]["bookings"], 12)
        self.assertEqual(rerun["skipped"]["maintenance"], 12)


if __name__ == "__main__":
    unittest.main()
