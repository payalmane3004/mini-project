"""Maintenance API tests using an isolated in-memory SQLite database."""

import asyncio
import json
import os
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import main
import models
from database import get_db
from security import create_access_token


async def asgi_request(path, *, token=None, method="GET", body=None):
    headers = []
    if token:
        headers.append((b"authorization", f"Bearer {token}".encode("ascii")))
    if body is not None:
        headers.append((b"content-type", b"application/json"))
    scope = {
        "type": "http", "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1", "method": method, "scheme": "http",
        "path": path.split("?", 1)[0], "raw_path": path.split("?", 1)[0].encode("ascii"),
        "query_string": path.split("?", 1)[1].encode("ascii") if "?" in path else b"",
        "root_path": "", "headers": headers, "server": ("testserver", 80),
        "client": ("testclient", 12345), "state": {},
    }
    delivered = False
    messages = []
    request_body = json.dumps(body).encode("utf-8") if body is not None else b""

    async def receive():
        nonlocal delivered
        if not delivered:
            delivered = True
            return {"type": "http.request", "body": request_body, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message):
        messages.append(message)

    await main.app(scope, receive, send)
    start = next(message for message in messages if message["type"] == "http.response.start")
    response_body = b"".join(
        message.get("body", b"") for message in messages
        if message["type"] == "http.response.body"
    )
    return start["status"], json.loads(response_body) if response_body else None


class MaintenanceAPITests(unittest.TestCase):
    def setUp(self):
        self.secret_patch = patch.dict(os.environ, {"JWT_SECRET_KEY": "maintenance-test-secret-not-a-real-key"})
        self.secret_patch.start()
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        with self.engine.begin() as connection:
            connection.execute(text("""
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY, full_name VARCHAR(100) NOT NULL,
                    email VARCHAR(255) NOT NULL UNIQUE, password_hash TEXT NOT NULL,
                    role VARCHAR(20) NOT NULL, created_at DATETIME
                )
            """))
            connection.execute(text("""
                CREATE TABLE buildings (
                    id INTEGER PRIMARY KEY, building_code VARCHAR(30) NOT NULL UNIQUE,
                    name VARCHAR(100) NOT NULL, description TEXT
                )
            """))
            connection.execute(text("""
                CREATE TABLE rooms (
                    id INTEGER PRIMARY KEY, building_id INTEGER REFERENCES buildings(id),
                    room_code VARCHAR(30) NOT NULL UNIQUE, room_name VARCHAR(100),
                    floor_number INTEGER NOT NULL, capacity INTEGER, room_type VARCHAR(30) NOT NULL,
                    created_at DATETIME
                )
            """))
            connection.execute(text("""
                CREATE TABLE maintenance_requests (
                    id INTEGER PRIMARY KEY, room_id INTEGER NOT NULL REFERENCES rooms(id),
                    reported_by INTEGER REFERENCES users(id), title VARCHAR(150) NOT NULL,
                    description TEXT, priority VARCHAR(20), status VARCHAR(20), qr_code_value TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, resolved_at DATETIME
                )
            """))
            connection.execute(text("INSERT INTO users (id, full_name, email, password_hash, role) VALUES (11, 'Campus Admin', 'admin@example.invalid', 'x', 'ADMIN'), (12, 'Student One', 'one@example.invalid', 'x', 'STUDENT'), (13, 'Student Two', 'two@example.invalid', 'x', 'STUDENT')"))
            connection.execute(text("INSERT INTO buildings (id, building_code, name) VALUES (21, 'BLD-A', 'Academic Block')"))
            connection.execute(text("INSERT INTO rooms (id, building_id, room_code, room_name, floor_number, capacity, room_type) VALUES (31, 21, 'A-101', 'Lecture Room 101', 1, 30, 'CLASSROOM')"))
            connection.execute(text("INSERT INTO rooms (id, building_id, room_code, room_name, floor_number, capacity, room_type) VALUES (32, 99, 'ORPHAN-1', NULL, 1, 0, 'CLASSROOM')"))
            connection.execute(text("INSERT INTO rooms (id, building_id, room_code, room_name, floor_number, capacity, room_type) VALUES (33, 21, 'DEMO-B-101', 'Demo room', 1, 20, 'DEMO')"))
            connection.execute(text("""
                INSERT INTO maintenance_requests (id, room_id, reported_by, title, description, priority, status, created_at)
                VALUES (41, 31, 12, 'Light is out', 'Ceiling light is not working', 'MEDIUM', 'OPEN', :created_at),
                       (42, 31, 13, 'Door is stuck', 'Door does not close', 'HIGH', 'IN_PROGRESS', :created_at)
            """), {"created_at": datetime.now(timezone.utc).isoformat()})
        self.db = Session(self.engine, expire_on_commit=False)
        main.app.dependency_overrides[get_db] = lambda: self.db
        self.admin = create_access_token(11, "admin")
        self.student = create_access_token(12, "student")
        self.other_student = create_access_token(13, "student")

    def tearDown(self):
        main.app.dependency_overrides.pop(get_db, None)
        self.db.close()
        self.engine.dispose()
        self.secret_patch.stop()

    def request(self, path, *, role=None, method="GET", body=None):
        token = {"admin": self.admin, "student": self.student, "other": self.other_student}.get(role)
        return asyncio.run(asgi_request(path, token=token, method=method, body=body))

    def test_student_creates_request_for_verified_room_and_identity(self):
        status, result = self.request(
            "/maintenance/requests", role="student", method="POST",
            body={"room_id": 31, "title": "Broken projector", "description": "No image", "priority": "HIGH", "reported_by": 11},
        )
        self.assertEqual(status, 201)
        self.assertEqual(result["reported_by"], 12)
        self.assertEqual(result["room_code"], "A-101")
        self.assertEqual(result["building_name"], "Academic Block")
        self.assertEqual(result["status"], "OPEN")
        self.assertEqual(self.db.query(models.MaintenanceRequest).filter_by(id=result["id"]).one().reported_by, 12)

    def test_missing_or_blank_required_fields_are_rejected(self):
        for body in ({"room_id": 31}, {"room_id": 31, "title": "  ", "description": "issue"},
                     {"room_id": 31, "title": "issue", "description": "  "}):
            with self.subTest(body=body):
                status, _ = self.request("/maintenance/requests", role="student", method="POST", body=body)
                self.assertEqual(status, 422)

    def test_unknown_room_is_rejected(self):
        status, result = self.request(
            "/maintenance/requests", role="student", method="POST",
            body={"room_id": 999, "title": "Issue", "description": "Details"},
        )
        self.assertEqual(status, 404)
        self.assertEqual(result["detail"], "Room not found")

    def test_demo_room_cannot_receive_maintenance_requests(self):
        status, result = self.request(
            "/maintenance/requests", role="student", method="POST",
            body={"room_id": 33, "title": "Issue", "description": "Demo room issue"},
        )
        self.assertEqual(status, 409)
        self.assertEqual(result["detail"], "Demo rooms are not available for maintenance requests")
        self.assertEqual(self.db.query(models.MaintenanceRequest).count(), 2)

    def test_local_demo_maintenance_request_is_allowed_and_visibly_marked(self):
        with patch.object(main, "_local_demo_is_active", return_value=True):
            status, result = self.request(
                "/maintenance/requests", role="student", method="POST",
                body={"room_id": 33, "title": "Projector issue", "description": "Fictional demo request"},
            )
        self.assertEqual(status, 201)
        self.assertTrue(result["title"].startswith("DEMO"))
        self.assertTrue(result["description"].startswith("DEMO:"))
        self.assertEqual(result["room_code"], "DEMO-B-101")

    def test_room_with_missing_building_is_rejected(self):
        status, result = self.request(
            "/maintenance/requests", role="student", method="POST",
            body={"room_id": 32, "title": "Issue", "description": "Details"},
        )
        self.assertEqual(status, 404)
        self.assertEqual(result["detail"], "Room building not found")

    def test_student_list_contains_only_own_requests(self):
        status, result = self.request("/maintenance/requests", role="student")
        self.assertEqual(status, 200)
        self.assertEqual([request["id"] for request in result], [41])

    def test_student_cannot_read_another_students_request(self):
        status, result = self.request("/maintenance/requests/42", role="student")
        self.assertEqual(status, 404)
        self.assertEqual(result["detail"], "Maintenance request not found")

    def test_student_cannot_change_status(self):
        status, result = self.request(
            "/maintenance/requests/41/status", role="student", method="PATCH",
            body={"status": "RESOLVED"},
        )
        self.assertEqual(status, 403)
        self.assertEqual(result["detail"], "Insufficient permissions")
        self.assertEqual(self.db.query(models.MaintenanceRequest).filter_by(id=41).one().status, "OPEN")

    def test_admin_lists_all_requests_and_persists_status_with_resolution_time(self):
        status, result = self.request("/maintenance/requests", role="admin")
        self.assertEqual(status, 200)
        self.assertEqual({request["id"] for request in result}, {41, 42})
        status, updated = self.request(
            "/maintenance/requests/41/status", role="admin", method="PATCH",
            body={"status": "RESOLVED"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(updated["status"], "RESOLVED")
        self.assertIsNotNone(updated["resolved_at"])
        self.assertEqual(self.db.query(models.MaintenanceRequest).filter_by(id=41).one().status, "RESOLVED")

    def test_admin_reopening_request_clears_resolution_time(self):
        request = self.db.query(models.MaintenanceRequest).filter_by(id=41).one()
        request.status = "RESOLVED"
        request.resolved_at = datetime.now(timezone.utc)
        self.db.commit()
        status, updated = self.request(
            "/maintenance/requests/41/status", role="admin", method="PATCH",
            body={"status": "IN_PROGRESS"},
        )
        self.assertEqual(status, 200)
        self.assertIsNone(updated["resolved_at"])

    def test_invalid_status_and_missing_request_are_rejected(self):
        status, _ = self.request(
            "/maintenance/requests/41/status", role="admin", method="PATCH",
            body={"status": "PENDING"},
        )
        self.assertEqual(status, 422)
        status, _ = self.request(
            "/maintenance/requests/999/status", role="admin", method="PATCH",
            body={"status": "OPEN"},
        )
        self.assertEqual(status, 404)

    def test_maintenance_routes_reject_unauthenticated_requests(self):
        for path, method, body in (
            ("/maintenance/requests", "GET", None),
            ("/maintenance/requests", "POST", {"room_id": 31, "title": "Issue", "description": "Details"}),
            ("/maintenance/requests/41/status", "PATCH", {"status": "RESOLVED"}),
        ):
            with self.subTest(path=path, method=method):
                status, _ = asyncio.run(asgi_request(path, method=method, body=body))
                self.assertEqual(status, 401)

    def test_database_integrity_failure_rolls_back_and_hides_details(self):
        error = IntegrityError("insert", {}, Exception("private constraint details"))
        with patch.object(self.db, "commit", side_effect=error), patch.object(self.db, "rollback", wraps=self.db.rollback) as rollback:
            status, result = self.request(
                "/maintenance/requests", role="student", method="POST",
                body={"room_id": 31, "title": "Broken projector", "description": "No image"},
            )
        self.assertEqual(status, 409)
        self.assertEqual(result["detail"], "Maintenance request conflicts with existing database records")
        self.assertEqual(rollback.call_count, 1)
        self.assertEqual(self.db.query(models.MaintenanceRequest).count(), 2)


if __name__ == "__main__":
    unittest.main()
