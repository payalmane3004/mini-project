"""Room creation endpoint tests using an isolated fake session (no database access)."""

import asyncio
import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import main
import models
from database import get_db
from pydantic import ValidationError
from schemas import BuildingResponse
from security import create_access_token
from sqlalchemy.exc import IntegrityError


class FakeQuery:
    def __init__(self, entities, session):
        self.entities = entities
        self.session = session
        self.filters = []

    def filter(self, *expressions):
        self.filters.extend(expressions)
        return self

    def order_by(self, *expressions):
        return self

    def first(self):
        if len(self.entities) == 1 and self.entities[0] is models.User:
            user_id = self._filter_value("id")
            return self.session.users.get(int(user_id)) if user_id is not None else None
        if len(self.entities) == 1 and self.entities[0] is models.Building:
            code = self._filter_value("building_code")
            return self.session.building if code == self.session.building.building_code else None
        if len(self.entities) == 1 and self.entities[0] is models.Room.id:
            code = self._filter_value("room_code")
            return (SimpleNamespace(id=1) if code in self.session.room_codes else None)
        return None

    def all(self):
        if len(self.entities) == 1 and self.entities[0] is models.Room:
            return self.session.committed
        return []

    def _filter_value(self, column_name):
        for expression in self.filters:
            if getattr(getattr(expression, "left", None), "key", None) == column_name:
                return getattr(getattr(expression, "right", None), "value", None)
        return None


class FakeSession:
    def __init__(self, *, commit_error=None, room_codes=None):
        self.users = {
            11: SimpleNamespace(id=11, full_name="Test Admin", email="admin@example.invalid", role="ADMIN"),
            12: SimpleNamespace(id=12, full_name="Test Student", email="student@example.invalid", role="STUDENT"),
        }
        self.building = SimpleNamespace(id=42, building_code="BU-TEST", name="Test Building")
        self.room_codes = set(room_codes or ())
        self.commit_error = commit_error
        self.pending = None
        self.committed = []
        self.rollback_count = 0

    def query(self, *entities):
        return FakeQuery(entities, self)

    def add(self, room):
        self.pending = room
        room.id = 101

    def commit(self):
        if self.commit_error:
            raise self.commit_error
        self.room_codes.add(self.pending.room_code)
        self.committed.append(self.pending)

    def refresh(self, _room):
        return None

    def rollback(self):
        self.rollback_count += 1
        self.pending = None


async def asgi_request(path, *, method="POST", body=None, authorization=None):
    headers = [(b"content-type", b"application/json")]
    if authorization:
        headers.append((b"authorization", authorization.encode("ascii")))
    encoded_body = json.dumps(body).encode("utf-8") if body is not None else b""
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("ascii"),
        "query_string": b"",
        "root_path": "",
        "headers": headers,
        "server": ("testserver", 80),
        "client": ("testclient", 12345),
        "state": {},
    }
    delivered = False
    messages = []

    async def receive():
        nonlocal delivered
        if not delivered:
            delivered = True
            return {"type": "http.request", "body": encoded_body, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message):
        messages.append(message)

    await main.app(scope, receive, send)
    response_start = next(message for message in messages if message["type"] == "http.response.start")
    response_body = b"".join(message.get("body", b"") for message in messages if message["type"] == "http.response.body")
    return response_start["status"], json.loads(response_body) if response_body else None


class RoomCreationTests(unittest.TestCase):
    def test_building_response_contract_requires_directory_fields(self):
        route = next(route for route in main.app.routes if route.path == "/buildings")
        self.assertEqual(route.response_model, list[BuildingResponse])

        response = BuildingResponse.model_validate({
            "id": 4,
            "building_code": "CSE",
            "name": "Computer Science",
            "description": None,
        })
        self.assertEqual(response.building_code, "CSE")
        with self.assertRaises(ValidationError):
            BuildingResponse.model_validate({"id": 4, "building_code": "CSE"})

    valid_room = {
        "building_code": "BU-TEST",
        "room_code": "TEST-101",
        "room_name": "Test Room",
        "floor_number": 1,
        "capacity": 24,
        "room_type": "Classroom",
    }

    def setUp(self):
        self.secret_patch = patch.dict(os.environ, {"JWT_SECRET_KEY": "unit-test-only-secret-key-not-a-real-token"})
        self.secret_patch.start()
        self.db = FakeSession()
        main.app.dependency_overrides[get_db] = lambda: self.db

    def tearDown(self):
        main.app.dependency_overrides.pop(get_db, None)
        self.secret_patch.stop()

    def request(self, *, body=None, user_id=None, role=None):
        token = create_access_token(user_id, role) if user_id is not None else None
        authorization = f"Bearer {token}" if token else None
        return asyncio.run(asgi_request("/rooms", body=body, authorization=authorization))

    def test_anonymous_and_student_cannot_create_rooms(self):
        status, _ = self.request(body=self.valid_room)
        self.assertEqual(status, 401)
        status, body = self.request(body=self.valid_room, user_id=12, role="student")
        self.assertEqual(status, 403)
        self.assertEqual(body["detail"], "Insufficient permissions")

    def test_admin_can_create_room(self):
        status, body = self.request(body=self.valid_room, user_id=11, role="admin")
        self.assertEqual(status, 201)
        self.assertEqual(body["building_id"], 42)
        self.assertEqual(body["room_code"], "TEST-101")
        self.assertEqual(len(self.db.committed), 1)

    def test_created_room_is_available_to_followup_room_list_read(self):
        status, body = self.request(body=self.valid_room, user_id=11, role="admin")
        self.assertEqual(status, 201)
        stored = main.get_rooms(self.db)
        self.assertEqual([room.room_code for room in stored], [body["room_code"]])
        self.assertEqual(stored[0].building_id, self.db.building.id)

    def test_room_name_is_optional_and_blank_name_is_normalized(self):
        payload = dict(self.valid_room, room_name="   ")
        status, body = self.request(body=payload, user_id=11, role="admin")
        self.assertEqual(status, 201)
        self.assertIsNone(body["room_name"])

    def test_missing_or_unknown_building_is_rejected(self):
        missing = dict(self.valid_room)
        missing.pop("building_code")
        status, _ = self.request(body=missing, user_id=11, role="admin")
        self.assertEqual(status, 422)
        unknown = dict(self.valid_room, building_code="UNKNOWN")
        status, body = self.request(body=unknown, user_id=11, role="admin")
        self.assertEqual(status, 404)
        self.assertEqual(body["detail"], "Building not found")

    def test_duplicate_room_code_returns_clear_conflict(self):
        self.db.room_codes.add("TEST-101")
        status, body = self.request(body=self.valid_room, user_id=11, role="admin")
        self.assertEqual(status, 409)
        self.assertIn("room code already exists", body["detail"])
        self.assertEqual(self.db.committed, [])

    def test_invalid_and_oversized_fields_are_rejected(self):
        invalid_payloads = [
            {},
            dict(self.valid_room, room_code="   "),
            dict(self.valid_room, room_type="  "),
            dict(self.valid_room, room_code="R" * 31),
            dict(self.valid_room, room_name="N" * 101),
            dict(self.valid_room, room_type="T" * 31),
            dict(self.valid_room, floor_number="1"),
            dict(self.valid_room, floor_number=1.5),
            dict(self.valid_room, capacity=-1),
            dict(self.valid_room, capacity=1.5),
            {key: value for key, value in self.valid_room.items() if key != "capacity"},
        ]
        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                status, _ = self.request(body=payload, user_id=11, role="admin")
                self.assertEqual(status, 422)
        self.assertEqual(self.db.committed, [])

    def test_integrity_error_rolls_back_without_commit(self):
        class FakePostgresError(Exception):
            diag = SimpleNamespace(constraint_name="rooms_room_code_key")

        self.db.commit_error = IntegrityError("INSERT", {}, FakePostgresError("duplicate"))
        status, body = self.request(body=self.valid_room, user_id=11, role="admin")
        self.assertEqual(status, 409)
        self.assertIn("room code already exists", body["detail"])
        self.assertEqual(self.db.rollback_count, 1)
        self.assertEqual(self.db.committed, [])


if __name__ == "__main__":
    unittest.main()
