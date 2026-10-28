"""Occupancy and energy endpoint tests using isolated in-memory SQLite data."""

import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

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
        models.BuildingFloorLabel.__table__.create(self.engine)
        models.Notice.__table__.create(self.engine)
        models.EmergencyAlert.__table__.create(self.engine)
        models.MaintenanceRequest.__table__.create(self.engine)
        self.db = Session(self.engine)
        self.db.add(models.Building(id=2, building_code="B-2", name="Test Building"))
        self.db.add_all([
            models.Room(id=7, building_id=2, room_code="R-7", floor_number=0, capacity=20, room_type="Classroom"),
            models.Room(id=8, building_id=2, room_code="R-8", floor_number=1, capacity=None, room_type="Lab"),
            models.Room(id=9, building_id=2, room_code="DEMO-B-9", floor_number=2, capacity=20, room_type="DEMO"),
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_empty_readings_remain_empty_and_do_not_imply_zero_occupancy(self):
        result = main.get_latest_room_occupancy(room_id=None, building_code=None, db=self.db)
        self.assertEqual(result["room_count"], 2)
        self.assertEqual(result["readings"], [])
        self.assertFalse(result["demo_preview"])

    def test_latest_occupancy_uses_timestamp_then_highest_id_and_preserves_staleness(self):
        old = datetime.now(timezone.utc) - timedelta(days=30)
        self.db.add_all([
            models.RoomOccupancy(id=10, room_id=7, occupied_count=5, source="RECORDED_VIDEO", recorded_at=old),
            models.RoomOccupancy(id=11, room_id=7, occupied_count=3, source="SIMULATED_DEMO", recorded_at=old + timedelta(days=1)),
            models.RoomOccupancy(id=12, room_id=9, occupied_count=12, source="RECORDED_VIDEO", recorded_at=old + timedelta(days=2)),
        ])
        self.db.commit()

        result = main.get_latest_room_occupancy(room_id=None, building_code=None, db=self.db)

        self.assertEqual(result["room_count"], 2)
        self.assertEqual(len(result["readings"]), 1)
        self.assertEqual(result["readings"][0]["id"], 10)
        self.assertEqual(result["readings"][0]["occupied_count"], 5)
        self.assertEqual(result["readings"][0]["source"], "RECORDED_VIDEO")
        self.assertFalse(result["readings"][0]["is_demo"])
        self.assertLess(result["readings"][0]["recorded_at"], (datetime.now(timezone.utc) - timedelta(days=1)).replace(tzinfo=None))

    def test_explicit_occupancy_preview_includes_simulated_demo_readings(self):
        from schemas import OccupancyDashboardResponse, OccupancyReadingResponse

        self.db.add(models.RoomOccupancy(
            id=24, room_id=9, occupied_count=8, source="SIMULATED_DEMO",
            recorded_at=datetime.now(timezone.utc),
        ))
        self.db.commit()

        result = main.get_latest_room_occupancy(
            room_id=None, building_code=None, include_demo=True, db=self.db
        )

        response = OccupancyDashboardResponse.model_validate(result)
        self.assertTrue(response.demo_preview)
        self.assertEqual(len(response.readings), 1)
        self.assertTrue(response.readings[0].is_demo)
        self.assertTrue(result["demo_preview"])
        self.assertEqual(result["room_count"], 3)
        demo_reading = next(reading for reading in result["readings"] if reading["room_code"] == "DEMO-B-9")
        self.assertEqual(demo_reading["source"], "SIMULATED_DEMO")
        self.assertTrue(demo_reading["is_demo"])
        self.assertTrue(OccupancyReadingResponse.model_validate(demo_reading).model_dump()["is_demo"])

    def test_energy_excludes_simulated_variants_by_default_and_can_include_them_explicitly(self):
        old = datetime.now(timezone.utc) - timedelta(days=60)
        self.db.add_all([
            models.EnergyReading(id=20, building_id=2, energy_kwh=Decimal("1.250"), reading_source="SIMULATED", recorded_at=old),
            models.EnergyReading(id=21, building_id=2, energy_kwh=Decimal("2.500"), reading_source="SIMULATED_DEMO", recorded_at=old + timedelta(days=1)),
            models.EnergyReading(id=22, building_id=2, energy_kwh=Decimal("3.750"), reading_source="METER", recorded_at=old + timedelta(days=2)),
        ])
        self.db.commit()

        result = main.get_energy_readings(start=None, end=None, building_code=None, limit=1000, db=self.db)

        self.assertEqual(result["unit"], "kWh")
        self.assertEqual([reading["reading_source"] for reading in result["readings"]], ["METER"])
        demo_inclusive = main.get_energy_readings(
            start=None, end=None, building_code=None, limit=1000,
            include_demo=True, db=self.db,
        )
        self.assertEqual({reading["reading_source"] for reading in demo_inclusive["readings"]}, {
            "SIMULATED", "SIMULATED_DEMO", "METER",
        })

    def test_room_and_floor_label_responses_classify_demo_records(self):
        from schemas import NoticeResponse, RoomResponse

        demo_room = self.db.query(models.Room).filter_by(id=9).one()
        self.assertTrue(RoomResponse.model_validate(demo_room, from_attributes=True).is_demo)
        self.assertFalse(RoomResponse.model_validate(
            self.db.query(models.Room).filter_by(id=7).one(),
            from_attributes=True,
        ).is_demo)

        self.db.add_all([
            models.BuildingFloorLabel(building_id=2, floor_number=0, label="Main Floor"),
            models.BuildingFloorLabel(building_id=2, floor_number=2, label="DEMO TEST FLOOR 2"),
            models.BuildingFloorLabel(building_id=2, floor_number=1, label="DEMO Ground Floor · fictional import label"),
        ])
        self.db.commit()
        result = main.get_building_floor_labels("B-2", floor_number=None, db=self.db)
        self.assertFalse(result["is_demo"])
        self.assertEqual([item["is_demo"] for item in result["floor_labels"]], [False, True, True])

    def test_published_demo_notices_are_hidden_from_student_endpoint(self):
        from schemas import NoticeResponse

        now = datetime.now(timezone.utc)
        self.db.add_all([
            models.Notice(id=1, title="DEMO | Facilities update (test only)", content="Demo", published=True, created_at=now),
            models.Notice(id=2, title="Campus closure", content="Official notice", published=True, created_at=now),
            models.Notice(id=3, title="DEMO notice 1: fictional campus update", content="Demo", published=True, created_at=now),
        ])
        self.db.commit()

        result = main.get_published_notices(db=self.db)

        self.assertEqual([notice.title for notice in result], ["Campus closure"])
        demo_notice = self.db.query(models.Notice).filter_by(id=1).one()
        self.assertTrue(NoticeResponse.model_validate(demo_notice, from_attributes=True).is_demo)
        local_demo_notice = self.db.query(models.Notice).filter_by(id=3).one()
        self.assertTrue(NoticeResponse.model_validate(local_demo_notice, from_attributes=True).is_demo)

    def test_demo_alerts_are_classified_and_hidden_outside_the_local_demo(self):
        now = datetime.now(timezone.utc)
        demo_alert = models.EmergencyAlert(
            id=90, title="DEMO alert: fictional event", message="Not a real incident",
            severity="LOW", active=True, created_at=now,
        )
        official_alert = models.EmergencyAlert(
            id=91, title="Maintenance warning", message="Official notice",
            severity="MEDIUM", active=True, created_at=now,
        )
        self.db.add_all([demo_alert, official_alert])
        self.db.commit()

        with patch.object(main, "_local_demo_is_active", return_value=False):
            external_records = main.get_published_emergency_alerts(db=self.db)
        self.assertEqual([alert.id for alert in external_records], [91])
        self.assertTrue(demo_alert.is_demo)

    def test_analytics_excludes_demo_rooms_and_simulated_readings(self):
        now = datetime.now(timezone.utc)
        self.db.add_all([
            models.RoomOccupancy(id=30, room_id=7, occupied_count=6, source="RECORDED_VIDEO", recorded_at=now),
            models.RoomOccupancy(id=31, room_id=9, occupied_count=12, source="RECORDED_VIDEO", recorded_at=now),
            models.EnergyReading(id=40, building_id=2, energy_kwh=Decimal("4.000"), reading_source="METER", recorded_at=now),
            models.EnergyReading(id=41, building_id=2, energy_kwh=Decimal("9.000"), reading_source="SIMULATED_DEMO", recorded_at=now),
        ])
        self.db.commit()

        result = main.get_analytics_summary(start=None, end=None, limit=1000, db=self.db)

        self.assertEqual(result["verified_rooms_total"], 2)
        self.assertEqual(result["occupancy_readings_total"], 1)
        self.assertEqual([reading["room_code"] for reading in result["occupancy_readings"]], ["R-7"])
        self.assertEqual(result["energy_readings_total"], 1)
        self.assertEqual([reading["source"] for reading in result["energy_readings"]], ["METER"])
        self.assertEqual([item["source"] for item in result["energy_by_building"]], ["METER"])


if __name__ == "__main__":
    unittest.main()
