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

    def test_password_validation_precedes_all_database_writes_for_fresh_file(self):
        original_engine = database.engine
        original_environment = {
            name: os.environ.get(name)
            for name in ("DATABASE_URL", "PYTHON_DOTENV_DISABLED")
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "campussphere_demo.sqlite3"
            engine = create_engine(URL.create("sqlite", database=str(path)))
            events = []
            real_create_schema = demo.create_demo_schema

            def capture_password(label, hash_password):
                events.append("password")
                return "offline-hash"

            def capture_schema(target_engine, metadata):
                events.append("schema-write")
                return real_create_schema(target_engine, metadata)

            try:
                database.engine = engine
                with patch.object(demo, "DEMO_DATABASE_PATH", path), patch.object(
                    demo_mode, "DEMO_DATABASE_PATH", path
                ), patch.object(demo, "_check_password", side_effect=capture_password), patch.object(
                    demo, "create_demo_schema", side_effect=capture_schema
                ), contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(demo.main([]), 0)
                self.assertEqual(events, ["password", "password", "schema-write"])
                with Session(engine) as session:
                    self.assertEqual(demo._counts(session, models), demo.EXPECTED_RECORD_COUNTS)
                    self.assertEqual(
                        session.execute(select(demo_marker.c.value)).scalar_one(),
                        demo_mode.DEMO_MARKER_VALUE,
                    )
            finally:
                database.engine = original_engine
                engine.dispose()
                for name, value in original_environment.items():
                    if value is None:
                        os.environ.pop(name, None)
                    else:
                        os.environ[name] = value

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

    def test_foreign_keys_unique_codes_statuses_intervals_and_reading_ranges(self):
        self._populate()
        with Session(self.engine) as session:
            buildings = session.query(models.Building).all()
            rooms = session.query(models.Room).all()
            bookings = session.query(models.RoomBooking).all()
            occupancy = session.query(models.RoomOccupancy).all()
            energy = session.query(models.EnergyReading).all()
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
            self.assertEqual(summary["buildings_total"], 10)
            self.assertEqual(summary["verified_rooms_total"], 40)
            self.assertEqual(summary["occupancy_readings_total"], 336)
            self.assertEqual(summary["energy_readings_total"], 224)
            self.assertEqual(summary["maintenance_open_total"], 6)
            filtered = main.get_analytics_summary(
                start=self.as_of - timedelta(days=1),
                end=self.as_of + timedelta(hours=1),
                limit=2000,
                db=session,
            )
            self.assertEqual(filtered["occupancy_readings_total"], 48)
            self.assertEqual(filtered["energy_readings_total"], 32)

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
