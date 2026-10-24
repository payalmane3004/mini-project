"""Occupancy and energy endpoint tests using isolated in-memory SQLite data."""

import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import main
import models


class ResourceIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        models.Building.__table__.create(self.engine)
        models.Room.__table__.create(self.engine)
        models.RoomOccupancy.__table__.create(self.engine)
        models.EnergyReading.__table__.create(self.engine)
        self.db = Session(self.engine)
        self.db.add(models.Building(id=2, building_code="B-2", name="Test Building"))
        self.db.add_all([
            models.Room(id=7, building_id=2, room_code="R-7", floor_number=0, capacity=20, room_type="Classroom"),
            models.Room(id=8, building_id=2, room_code="R-8", floor_number=1, capacity=None, room_type="Lab"),
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_empty_readings_remain_empty_and_do_not_imply_zero_occupancy(self):
        result = main.get_latest_room_occupancy(room_id=None, building_code=None, db=self.db)
        self.assertEqual(result["room_count"], 2)
        self.assertEqual(result["readings"], [])

    def test_latest_occupancy_uses_timestamp_then_highest_id_and_preserves_staleness(self):
        old = datetime.now(timezone.utc) - timedelta(days=30)
        self.db.add_all([
            models.RoomOccupancy(id=10, room_id=7, occupied_count=3, source="SIMULATED", recorded_at=old),
            models.RoomOccupancy(id=11, room_id=7, occupied_count=5, source="RECORDED_VIDEO", recorded_at=old),
        ])
        self.db.commit()

        result = main.get_latest_room_occupancy(room_id=None, building_code=None, db=self.db)

        self.assertEqual(len(result["readings"]), 1)
        self.assertEqual(result["readings"][0]["id"], 11)
        self.assertEqual(result["readings"][0]["occupied_count"], 5)
        self.assertEqual(result["readings"][0]["source"], "RECORDED_VIDEO")
        self.assertLess(result["readings"][0]["recorded_at"], (datetime.now(timezone.utc) - timedelta(days=1)).replace(tzinfo=None))

    def test_energy_keeps_kwh_source_and_old_timestamp(self):
        old = datetime.now(timezone.utc) - timedelta(days=60)
        self.db.add(models.EnergyReading(id=20, building_id=2, energy_kwh=Decimal("1.250"), reading_source="SIMULATED", recorded_at=old))
        self.db.commit()

        result = main.get_energy_readings(start=None, end=None, building_code=None, limit=1000, db=self.db)

        self.assertEqual(result["unit"], "kWh")
        self.assertEqual(result["readings"][0]["energy_kwh"], Decimal("1.250"))
        self.assertEqual(result["readings"][0]["reading_source"], "SIMULATED")
        self.assertLess(result["readings"][0]["recorded_at"], (datetime.now(timezone.utc) - timedelta(days=1)).replace(tzinfo=None))


if __name__ == "__main__":
    unittest.main()
