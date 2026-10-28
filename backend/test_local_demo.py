"""Offline safety and fixture tests for the isolated local demo dataset."""

import os
import tempfile
import unittest
import contextlib
import io
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from sqlalchemy import create_engine, event, select
from sqlalchemy.engine import URL
from sqlalchemy.exc import IntegrityError

import demo_mode
import generate_demo_data as demo
import run_demo_backend
import main
import models
import database
from demo_mode import DemoDatabaseError, demo_marker, demo_metadata
from schemas import LoginRequest
from security import decode_access_token, hash_password, verify_password
from sqlalchemy.orm import Session
from starlette.responses import Response


def enable_foreign_keys(connection, record):
    cursor = connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


class LocalDemoSafetyTests(unittest.TestCase):
    def test_demo_backend_port_defaults_to_8000(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(run_demo_backend.get_demo_port(), 8000)

    def test_demo_backend_port_accepts_custom_valid_port(self):
        with patch.dict(os.environ, {"CAMPUSSPHERE_DEMO_PORT": "8001"}, clear=True):
            self.assertEqual(run_demo_backend.get_demo_port(), 8001)

    def test_demo_backend_port_rejects_invalid_values(self):
        for value in ("", "abc", "0", "65536", "-1"):
            with self.subTest(value=value), patch.dict(
                os.environ, {"CAMPUSSPHERE_DEMO_PORT": value}, clear=True
            ):
                with self.assertRaisesRegex(ValueError, "CAMPUSSPHERE_DEMO_PORT"):
                    run_demo_backend.get_demo_port()

    def test_refuses_non_sqlite_and_nonapproved_sqlite_engine_targets(self):
        postgres = SimpleNamespace(
            dialect=SimpleNamespace(name="postgresql"),
            url=URL.create("postgresql", host="localhost", database="not-connected"),
        )
        memory = create_engine("sqlite:///:memory:")
        other_file = create_engine("sqlite:///another-demo.sqlite3")
        approved = create_engine(URL.create("sqlite", database=str(demo_mode.DEMO_DATABASE_PATH.absolute())))
        self.addCleanup(memory.dispose)
        self.addCleanup(other_file.dispose)
        self.addCleanup(approved.dispose)

        self.assertFalse(demo_mode.is_approved_demo_engine(postgres))
        self.assertFalse(demo_mode.is_approved_demo_engine(memory))
        self.assertFalse(demo_mode.is_approved_demo_engine(other_file))
        self.assertTrue(demo_mode.is_approved_demo_engine(approved))
        with self.assertRaises(DemoDatabaseError):
            demo_mode.require_approved_demo_engine(postgres)

    def test_engine_target_is_validated_before_schema_writes(self):
        postgres = SimpleNamespace(
            dialect=SimpleNamespace(name="postgresql"),
            url=URL.create("postgresql", host="localhost", database="not-connected"),
        )
        metadata_spy = Mock()
        with self.assertRaises(DemoDatabaseError):
            demo.create_demo_schema(postgres, metadata_spy)
        metadata_spy.create_all.assert_not_called()

    def test_only_exact_empty_unmarked_schema_is_recoverable(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "campussphere_demo.sqlite3"
            engine = create_engine(URL.create("sqlite", database=str(path)))
            try:
                with patch.object(demo, "DEMO_DATABASE_PATH", path), patch.object(
                    demo_mode, "DEMO_DATABASE_PATH", path
                ):
                    models.Base.metadata.create_all(engine)
                    demo.demo_metadata.create_all(engine)
                    self.assertFalse(demo.inspect_existing_demo_file(engine, models))
                    with engine.begin() as connection:
                        connection.execute(
                            models.Building.__table__.insert().values(
                                building_code="LOCAL-USER", name="Existing user data"
                            )
                        )
                    with self.assertRaises(DemoDatabaseError):
                        demo.inspect_existing_demo_file(engine, models)
            finally:
                engine.dispose()

    def test_recovery_refuses_unexpected_tables_and_views(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "campussphere_demo.sqlite3"
            engine = create_engine(URL.create("sqlite", database=str(path)))
            try:
                with patch.object(demo, "DEMO_DATABASE_PATH", path), patch.object(
                    demo_mode, "DEMO_DATABASE_PATH", path
                ):
                    models.Base.metadata.create_all(engine)
                    demo.demo_metadata.create_all(engine)
                    with engine.begin() as connection:
                        connection.exec_driver_sql("CREATE TABLE unexpected_notes (note TEXT)")
                    with self.assertRaises(DemoDatabaseError):
                        demo.inspect_existing_demo_file(engine, models)
            finally:
                engine.dispose()

    def test_generator_defaults_to_preview_without_creating_or_mutating_database(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "campussphere_demo.sqlite3"
            with patch.object(demo, "DEMO_DATABASE_PATH", path), contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(demo.main([]), 0)
            self.assertFalse(path.exists())
            self.assertIn("Target database:", output.getvalue())
            self.assertIn("Records proposed: occupancy=0, energy=0", output.getvalue())

    def test_preview_reports_integrity_and_proposal_without_writing_fixture(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "campussphere_demo.sqlite3"
            engine = create_engine(URL.create("sqlite", database=str(path)))
            event.listen(engine, "connect", enable_foreign_keys)
            try:
                with patch.object(demo, "DEMO_DATABASE_PATH", path), patch.object(
                    demo_mode, "DEMO_DATABASE_PATH", path
                ):
                    demo.create_demo_schema(engine, models.Base.metadata)
                    with Session(engine) as session, session.begin():
                        demo.populate_demo_data(
                            session, models, admin_hash="offline-admin-password-hash",
                            student_hash="offline-student-password-hash",
                            as_of=datetime(2026, 10, 24, 7, tzinfo=timezone.utc),
                        )
                    with contextlib.redirect_stdout(io.StringIO()) as output:
                        result = demo._preview_read_only()
                    self.assertEqual(result["proposed"], (784, 56))
                    self.assertIn("Existing buildings: 10", output.getvalue())
                    self.assertIn("Existing rooms: 40", output.getvalue())
                    self.assertIn("Foreign-key integrity: valid (0 violations)", output.getvalue())
                    self.assertIn("Source labels: SIMULATED_DEMO", output.getvalue())
                    with Session(engine) as session:
                        self.assertEqual(session.query(models.RoomOccupancy).count(), 336)
                        self.assertEqual(session.query(models.EnergyReading).count(), 224)
            finally:
                engine.dispose()

    def test_apply_requires_existing_marked_fixture_and_does_not_bootstrap_fake_records(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "campussphere_demo.sqlite3"
            original_engine = database.engine
            engine = create_engine(URL.create("sqlite", database=str(path)))
            try:
                database.engine = engine
                with patch.object(demo, "DEMO_DATABASE_PATH", path), patch.object(demo_mode, "DEMO_DATABASE_PATH", path):
                    with self.assertRaisesRegex(DemoDatabaseError, "existing verified local demo fixture"):
                        demo.main(["--apply"])
                self.assertFalse(path.exists())
            finally:
                database.engine = original_engine
                engine.dispose()

    def test_demo_indicator_never_connects_to_a_nonlocal_database(self):
        engine = Mock()
        engine.dialect.name = "postgresql"
        engine.url = URL.create("postgresql", host="db.example.invalid", database="campus")
        self.assertFalse(demo_mode.is_active_demo_engine(engine))
        engine.connect.assert_not_called()

    def test_demo_indicator_requires_the_marker_in_the_approved_local_file(self):
        with tempfile.TemporaryDirectory() as directory:
            demo_path = os.path.join(directory, "campussphere_demo.sqlite3")
            engine = create_engine(URL.create("sqlite", database=demo_path))
            try:
                with patch.object(demo_mode, "DEMO_DATABASE_PATH", Path(demo_path)):
                    demo_metadata.create_all(engine)
                    with engine.begin() as connection:
                        connection.execute(
                            demo_marker.insert().values(
                                key=demo_mode.DEMO_MARKER_KEY,
                                value=demo_mode.DEMO_MARKER_VALUE,
                            )
                        )
                    self.assertTrue(demo_mode.is_active_demo_engine(engine))
            finally:
                engine.dispose()


class LocalDemoFixtureTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        event.listen(self.engine, "connect", enable_foreign_keys)
        models.Base.metadata.create_all(self.engine)
        demo_metadata.create_all(self.engine)
        self.as_of = datetime(2025, 6, 10, 12, 0, tzinfo=timezone.utc)
        self.admin_password = "Demo-only-admin-test-password"
        self.student_password = "Demo-only-student-test-password"
        self.admin_hash = "offline-admin-password-hash"
        self.student_hash = "offline-student-password-hash"

    def tearDown(self):
        self.engine.dispose()

    def _populate(self):
        with Session(self.engine) as session, session.begin():
            return demo.populate_demo_data(
                session,
                models,
                admin_hash=self.admin_hash,
                student_hash=self.student_hash,
                as_of=self.as_of,
            )

    def test_generation_is_idempotent_and_matches_expected_table_counts(self):
        self.assertEqual(self._populate(), demo.EXPECTED_RECORD_COUNTS)
        self.assertEqual(self._populate(), demo.EXPECTED_RECORD_COUNTS)
        with Session(self.engine) as session:
            self.assertEqual(demo._counts(session, models), demo.EXPECTED_RECORD_COUNTS)
            self.assertEqual(
                session.execute(select(demo_marker.c.value)).scalar_one(),
                demo_mode.DEMO_MARKER_VALUE,
            )

    def test_existing_fixture_normalization_is_idempotent_and_preserves_demo_workflows(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "campussphere_demo.sqlite3"
            engine = create_engine(URL.create("sqlite", database=str(path)))
            event.listen(engine, "connect", enable_foreign_keys)
            try:
                with patch.object(demo, "DEMO_DATABASE_PATH", path), patch.object(
                    demo_mode, "DEMO_DATABASE_PATH", path
                ):
                    demo.create_demo_schema(engine, models.Base.metadata)
                    with Session(engine) as session, session.begin():
                        demo.populate_demo_data(
                            session, models,
                            admin_hash=self.admin_hash,
                            student_hash=self.student_hash,
                            as_of=self.as_of,
                        )
                    with Session(engine) as session, session.begin():
                        session.query(models.RoomOccupancy).update({"source": "RECORDED_VIDEO"})
                        session.query(models.EnergyReading).update({"reading_source": "SIMULATED"})
                        session.query(models.Notice).update({"published": True})
                        session.query(models.MaintenanceRequest).update({"status": "OPEN", "priority": "LOW"})
                        student = session.query(models.User).filter_by(role="STUDENT").one()
                        room = session.query(models.Room).first()
                        session.add(models.RoomBooking(
                            room_id=room.id,
                            user_id=student.id,
                            purpose="DEMO | local workflow test",
                            start_time=self.as_of + timedelta(days=20),
                            end_time=self.as_of + timedelta(days=20, hours=1),
                            status="PENDING",
                        ))
                        session.add(models.MaintenanceRequest(
                            room_id=room.id,
                            reported_by=student.id,
                            title="DEMO | local maintenance workflow",
                            description="Fictional local workflow test",
                            priority="MEDIUM",
                            status="OPEN",
                        ))
                        session.add(models.PasswordResetToken(
                            user_id=student.id,
                            token_hash="a" * 64,
                            expires_at=self.as_of + timedelta(minutes=15),
                        ))

                    self.assertTrue(demo.inspect_existing_demo_file(engine, models))
                    changes = demo.normalize_existing_demo_fixture(engine, models)
                    self.assertEqual(changes["occupancy_sources"], 336)
                    self.assertEqual(changes["energy_sources"], 224)
                    self.assertEqual(changes["notice_drafts"], 4)
                    self.assertGreater(changes["maintenance_statuses"], 0)
                    self.assertEqual(demo.normalize_existing_demo_fixture(engine, models), {
                        "occupancy_sources": 0,
                        "energy_sources": 0,
                        "notice_drafts": 0,
                        "maintenance_statuses": 0,
                    })
                    with Session(engine) as session:
                        self.assertEqual(session.query(models.RoomBooking).count(), 13)
                        self.assertEqual(session.query(models.MaintenanceRequest).count(), 7)
                        self.assertEqual(session.query(models.PasswordResetToken).count(), 1)
                        self.assertEqual(
                            session.query(models.MaintenanceRequest).filter_by(
                                title="DEMO | local maintenance workflow"
                            ).one().status,
                            "OPEN",
                        )
            finally:
                engine.dispose()

    def test_local_demo_notices_remain_unpublished_and_floor_labels_are_classified(self):
        self._populate()
        with Session(self.engine) as session:
            notices = session.query(models.Notice).all()
            floor_labels = session.query(models.BuildingFloorLabel).all()
            self.assertTrue(notices)
            self.assertTrue(all(notice.is_demo and not notice.published for notice in notices))
            self.assertTrue(floor_labels)
            self.assertTrue(all(label.is_demo for label in floor_labels))

    def test_foreign_keys_unique_codes_statuses_intervals_and_reading_ranges(self):
        self._populate()
        with Session(self.engine) as session:
            buildings = session.query(models.Building).all()
            rooms = session.query(models.Room).all()
            bookings = session.query(models.RoomBooking).all()
            occupancy = session.query(models.RoomOccupancy).all()
            energy = session.query(models.EnergyReading).all()
            self.assertEqual({row.source for row in occupancy}, {"SIMULATED_DEMO"})
            self.assertEqual({row.reading_source for row in energy}, {"SIMULATED_DEMO"})
            self.assertEqual(len({row.building_code for row in buildings}), 10)
            self.assertEqual(len({row.room_code for row in rooms}), 40)
            self.assertTrue(all(room.building_id in {row.id for row in buildings} for room in rooms))
            self.assertTrue(all(row.room_id in {room.id for room in rooms} for row in occupancy))
            self.assertTrue(all(row.building_id in {building.id for building in buildings} for row in energy))
            self.assertTrue(all(row.status in {"PENDING", "APPROVED", "REJECTED", "CANCELLED"} for row in bookings))
            self.assertTrue(all(row.end_time > row.start_time for row in bookings))
            self.assertEqual(len({row.room_id for row in bookings}), len(bookings))
            rooms_by_id = {room.id: room for room in rooms}
            self.assertTrue(all(0 <= row.occupied_count <= rooms_by_id[row.room_id].capacity for row in occupancy))
            self.assertGreaterEqual(sum(row.occupied_count == 0 for row in occupancy), 3)
            self.assertGreaterEqual(sum(row.occupied_count == rooms_by_id[row.room_id].capacity for row in occupancy), 3)
            self.assertTrue(all(row.energy_kwh >= 0 for row in energy))
            users = session.query(models.User).all()
            self.assertEqual({user.role for user in users}, {"ADMIN", "STUDENT"})
            self.assertTrue(all(user.email.endswith(".example.invalid") for user in users))

    def test_password_hashes_authenticate_local_demo_users_with_normalized_roles(self):
        self.admin_hash = hash_password(self.admin_password)
        self.student_hash = hash_password(self.student_password)
        self._populate()
        with Session(self.engine) as session:
            admin_payload = LoginRequest(email="admin@campussphere-demo.example.invalid", password=self.admin_password)
            student_payload = LoginRequest(email="student@campussphere-demo.example.invalid", password=self.student_password)
            original_key = os.environ.get("JWT_SECRET_KEY")
            os.environ["JWT_SECRET_KEY"] = "offline-test-signing-key-with-32-bytes"
            try:
                admin_result = main.login(admin_payload, Response(), session)
                student_result = main.login(student_payload, Response(), session)
                self.assertEqual(admin_result["user"]["role"], "admin")
                self.assertEqual(student_result["user"]["role"], "student")
                self.assertEqual(decode_access_token(admin_result["access_token"])["role"], "admin")
                self.assertEqual(decode_access_token(student_result["access_token"])["role"], "student")
                self.assertTrue(verify_password(self.admin_password, session.query(models.User).filter_by(role="ADMIN").one().password_hash))
            finally:
                if original_key is None:
                    os.environ.pop("JWT_SECRET_KEY", None)
                else:
                    os.environ["JWT_SECRET_KEY"] = original_key

    def test_dashboard_analytics_counts_and_date_filters_match_seeded_rows(self):
        self._populate()
        with Session(self.engine) as session:
            summary = main.get_analytics_summary(start=None, end=None, limit=2000, db=session)
            self.assertEqual(summary["buildings_total"], 0)
            self.assertEqual(summary["verified_rooms_total"], 0)
            self.assertEqual(summary["occupancy_readings_total"], 0)
            self.assertEqual(summary["energy_readings_total"], 0)
            self.assertEqual(summary["maintenance_open_total"], 0)
            filtered = main.get_analytics_summary(
                start=self.as_of - timedelta(days=1),
                end=self.as_of + timedelta(hours=1),
                limit=2000,
                db=session,
            )
            self.assertEqual(filtered["occupancy_readings_total"], 0)
            self.assertEqual(filtered["energy_readings_total"], 0)

    def test_explicit_demo_preview_exposes_simulated_readings_without_changing_operational_counts(self):
        self._populate()
        with Session(self.engine) as session:
            operational_occupancy = main.get_latest_room_occupancy(
                room_id=None, building_code=None, include_demo=False, db=session
            )
            preview_occupancy = main.get_latest_room_occupancy(
                room_id=None, building_code=None, include_demo=True, db=session
            )
            operational_energy = main.get_energy_readings(
                start=None, end=None, building_code=None, limit=1000, include_demo=False, db=session
            )
            preview_energy = main.get_energy_readings(
                start=None, end=None, building_code=None, limit=1000, include_demo=True, db=session
            )
            self.assertEqual(operational_occupancy["readings"], [])
            self.assertFalse(operational_occupancy["demo_preview"])
            self.assertEqual(preview_occupancy["room_count"], 40)
            self.assertTrue(preview_occupancy["demo_preview"])
            self.assertEqual(len(preview_occupancy["readings"]), 12)
            self.assertTrue(all(reading["is_demo"] for reading in preview_occupancy["readings"]))
            self.assertEqual({reading["source"] for reading in preview_occupancy["readings"]}, {"SIMULATED_DEMO"})
            self.assertEqual(operational_energy["readings"], [])
            self.assertEqual(len(preview_energy["readings"]), 224)
            self.assertEqual({row["reading_source"] for row in preview_energy["readings"]}, {"SIMULATED_DEMO"})

            operational = main.get_analytics_summary(
                start=None, end=None, limit=2000, include_demo=False, db=session
            )
            preview = main.get_analytics_summary(
                start=None, end=None, limit=2000, include_demo=True, db=session
            )
            self.assertEqual(operational["occupancy_readings_total"], 0)
            self.assertEqual(operational["energy_readings_total"], 0)
            self.assertEqual(preview["occupancy_readings_total"], 0)
            self.assertEqual(preview["energy_readings_total"], 0)
            self.assertEqual(preview["demo_buildings_total"], 10)
            self.assertEqual(preview["demo_rooms_total"], 40)
            self.assertEqual(preview["demo_occupancy_readings_total"], 336)
            self.assertEqual(preview["demo_energy_readings_total"], 224)
            self.assertEqual(preview["maintenance_open_total"], 0)
            self.assertGreater(preview["demo_maintenance_open_total"], 0)
            self.assertGreater(preview["demo_maintenance_resolved_total"], 0)
            self.assertEqual(len(preview["occupancy_readings"]), 336)
            self.assertTrue(all(reading["is_demo"] for reading in preview["occupancy_readings"]))
            self.assertEqual({reading["source"] for reading in preview["energy_readings"]}, {"SIMULATED_DEMO"})
            self.assertTrue(all(reading["is_demo"] for reading in preview["energy_readings"]))

    def test_occupancy_preview_keeps_latest_simulated_row_when_operational_row_is_newer(self):
        self._populate()
        with Session(self.engine) as session, session.begin():
            simulated = session.query(models.RoomOccupancy).order_by(
                models.RoomOccupancy.recorded_at.desc(), models.RoomOccupancy.id.desc()
            ).first()
            simulated_room_id = simulated.room_id
            session.add(models.RoomOccupancy(
                room_id=simulated_room_id,
                occupied_count=1,
                source="RECORDED_VIDEO",
                recorded_at=simulated.recorded_at + timedelta(hours=1),
            ))

        with Session(self.engine) as session:
            preview = main.get_latest_room_occupancy(
                room_id=None, building_code=None, include_demo=True, db=session
            )
            self.assertEqual(len(preview["readings"]), 12)
            self.assertEqual({row["source"] for row in preview["readings"]}, {"SIMULATED_DEMO"})
            self.assertEqual(
                sum(row["room_id"] == simulated_room_id for row in preview["readings"]), 1
            )
            operational = main.get_latest_room_occupancy(
                room_id=None, building_code=None, include_demo=False, db=session
            )
            self.assertEqual(operational["readings"], [])

    def test_student_preview_endpoints_return_simulated_rows_only(self):
        self._populate()
        with Session(self.engine) as session, session.begin():
            room = session.query(models.Room).first()
            building = session.query(models.Building).first()
            session.add(models.RoomOccupancy(room_id=room.id, occupied_count=2, source="RECORDED_VIDEO"))
            session.add(models.EnergyReading(building_id=building.id, energy_kwh=1, reading_source="METER"))
        with Session(self.engine) as session:
            occupancy = main.get_student_simulated_occupancy_history(building_code=None, limit=5000, db=session)
            energy = main.get_student_simulated_energy_readings(start=None, end=None, building_code=None, limit=2000, db=session)
            self.assertEqual(len(occupancy["readings"]), 336)
            self.assertEqual({row["source"] for row in occupancy["readings"]}, {"SIMULATED_DEMO"})
            self.assertEqual(len(energy["readings"]), 224)
            self.assertEqual({row["reading_source"] for row in energy["readings"]}, {"SIMULATED_DEMO"})

    def test_reading_generation_is_deterministic_idempotent_and_only_adds_missing_facilities(self):
        self._populate()
        with Session(self.engine) as session, session.begin():
            first = demo.populate_simulated_readings(session, models, now=self.as_of)
        with Session(self.engine) as session, session.begin():
            second = demo.populate_simulated_readings(session, models, now=self.as_of + timedelta(days=2))
        self.assertEqual(first, {"occupancy": 784, "energy": 56})
        self.assertEqual(second, {"occupancy": 0, "energy": 0})
        with Session(self.engine) as session:
            self.assertEqual(session.query(models.RoomOccupancy).count(), 1120)
            self.assertEqual(session.query(models.EnergyReading).count(), 280)
            rooms = {room.id: room for room in session.query(models.Room).all()}
            readings = session.query(models.RoomOccupancy).all()
            self.assertTrue(all(row.source == "SIMULATED_DEMO" for row in readings))
            self.assertTrue(all(0 <= row.occupied_count <= (rooms[row.room_id].capacity or 0) for row in readings))
            self.assertGreaterEqual(sum(row.occupied_count == 0 for row in readings), 3)
            self.assertGreaterEqual(sum(row.occupied_count == rooms[row.room_id].capacity for row in readings), 3)

    def test_unmarked_existing_records_are_not_overwritten(self):
        with Session(self.engine) as session:
            session.add(models.Building(building_code="USER-B1", name="Pre-existing local row"))
            session.commit()
            with self.assertRaises(DemoDatabaseError):
                demo.populate_demo_data(
                    session,
                    models,
                    admin_hash=self.admin_hash,
                    student_hash=self.student_hash,
                    as_of=self.as_of,
                )
            self.assertEqual(session.query(models.Building).count(), 1)


if __name__ == "__main__":
    unittest.main()
