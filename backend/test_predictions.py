"""Prediction baseline and endpoint tests using isolated in-memory SQLite."""

import unittest
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import main
import models
from predictions import build_predictive_summary


class PredictiveIntelligenceTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        self.engine = create_engine("sqlite:///:memory:")
        models.Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.db.add_all([
            models.Building(id=1, building_code="BLD-1", name="Building One"),
            models.Building(id=2, building_code="BLD-2", name="Building Two"),
            models.Building(id=3, building_code="DEMO-BLD-1", name="Demo Building One"),
            models.Building(id=4, building_code="DEMO-BLD-2", name="Demo Building Two"),
        ])
        self.db.add_all([
            models.Room(id=1, building_id=1, room_code="R-1", floor_number=1, capacity=30, room_type="Classroom"),
            models.Room(id=2, building_id=1, room_code="R-2", floor_number=1, capacity=30, room_type="Classroom"),
            models.Room(id=3, building_id=2, room_code="R-3", floor_number=1, capacity=30, room_type="Lab"),
            models.Room(id=4, building_id=3, room_code="DEMO-R-1", floor_number=1, capacity=30, room_type="Classroom"),
            models.Room(id=5, building_id=3, room_code="DEMO-R-2", floor_number=1, capacity=30, room_type="Classroom"),
            models.Room(id=6, building_id=4, room_code="DEMO-R-3", floor_number=1, capacity=30, room_type="Lab"),
        ])
        hours = (9, 11, 13, 15, 17, 19)
        for day_offset in range(56):
            day = (self.now - timedelta(days=55 - day_offset)).date()
            for hour in hours:
                timestamp = datetime.combine(day, time(hour), tzinfo=timezone.utc)
                for room_id in (1, 2, 3, 4, 5, 6):
                    demo = room_id >= 4
                    value = 1 if room_id == 2 else (25 if hour == 17 else 4 + ((room_id + hour) % 8))
                    self.db.add(models.RoomOccupancy(
                        room_id=room_id,
                        occupied_count=value,
                        source="SIMULATED_PREDICTION_DEMO" if demo else "RECORDED_VIDEO",
                        recorded_at=timestamp,
                    ))
                for building_id in (1, 2, 3, 4):
                    demo = building_id in (3, 4)
                    energy = Decimal("18.000") if hour == 17 else Decimal("9.000") + Decimal(building_id)
                    self.db.add(models.EnergyReading(
                        building_id=building_id,
                        energy_kwh=energy,
                        reading_source="SIMULATED_PREDICTION_DEMO" if demo else "METER",
                        recorded_at=timestamp,
                    ))
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_operational_endpoint_returns_baselines_peaks_and_recommendations(self):
        with patch.object(main, "is_active_demo_engine", return_value=False):
            result = main.get_analytics_predictions(include_demo=False, db=self.db)

        self.assertFalse(result["demo_preview"])
        self.assertTrue(result["occupancy"]["available"])
        self.assertTrue(result["energy"]["available"])
        self.assertEqual(len(result["occupancy"]["forecast_points"]), 42)
        self.assertEqual(len(result["energy"]["forecast_points"]), 42)
        self.assertTrue(result["occupancy"]["peak_usage"])
        self.assertTrue(result["occupancy"]["underutilized_rooms"])
        self.assertTrue(result["recommendations"])
        self.assertFalse(result["is_validated_model"])

    def test_demo_preview_reads_only_local_simulated_rows(self):
        with patch.object(main, "is_active_demo_engine", return_value=True):
            result = main.get_analytics_predictions(include_demo=True, db=self.db)

        self.assertTrue(result["demo_preview"])
        self.assertTrue(result["occupancy"]["available"])
        self.assertTrue(result["energy"]["available"])
        self.assertGreaterEqual(result["occupancy"]["data_quality"]["records_available"], 3 * 55 * 6)
        self.assertGreaterEqual(result["energy"]["data_quality"]["records_available"], 55 * 6)

    def test_include_demo_cannot_expose_simulated_rows_outside_local_fixture(self):
        with patch.object(main, "is_active_demo_engine", return_value=False):
            result = main.get_analytics_predictions(include_demo=True, db=self.db)

        self.assertFalse(result["demo_preview"])
        self.assertGreaterEqual(result["occupancy"]["data_quality"]["records_available"], 3 * 55 * 6)
        self.assertGreaterEqual(result["energy"]["data_quality"]["records_available"], 2 * 55 * 6)

    def test_empty_history_returns_counts_and_specific_collection_requirements(self):
        empty = build_predictive_summary([], [], [], now=self.now)

        self.assertFalse(empty["occupancy"]["available"])
        self.assertFalse(empty["energy"]["available"])
        self.assertEqual(empty["occupancy"]["data_quality"]["records_available"], 0)
        self.assertEqual(empty["energy"]["data_quality"]["records_available"], 0)
        self.assertEqual(empty["requirements"]["history_days"], 28)
        self.assertIn("No timestamped occupancy", empty["occupancy"]["data_quality"]["reason"])
        self.assertIn("No operational timestamped energy", empty["energy"]["data_quality"]["reason"])
        self.assertTrue(empty["recommendations"])

    def test_short_history_is_not_misrepresented_as_a_forecast(self):
        rooms = [{"id": 1, "room_code": "R-1", "capacity": 30}]
        occ = [{"room_id": 1, "occupied_count": 10, "recorded_at": self.now - timedelta(days=2)}]
        energy = [{"building_id": 1, "energy_kwh": 5, "recorded_at": self.now - timedelta(days=2)}]
        result = build_predictive_summary(rooms, occ, energy, now=self.now)

        self.assertFalse(result["occupancy"]["available"])
        self.assertFalse(result["energy"]["available"])
        self.assertEqual(result["occupancy"]["data_quality"]["records_available"], 1)
        self.assertIn("spans 1 days", result["occupancy"]["data_quality"]["reason"])


if __name__ == "__main__":
    unittest.main()
