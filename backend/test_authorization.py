"""Read-only authorization tests using synthetic users and an in-memory ASGI request."""

import asyncio
import json
import os
import time
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

import main
import models
from database import get_db
from security import TOKEN_LIFETIME_SECONDS, create_access_token


class FakeQuery:
    def __init__(self, entities, users):
        self.entities = entities
        self.users = users
        self.filters = []

    def filter(self, *expressions):
        self.filters.extend(expressions)
        return self

    def first(self):
        if self.entities != (models.User,):
            return None
        for expression in self.filters:
            right = getattr(getattr(expression, "right", None), "value", None)
            left = getattr(expression, "left", None)
            if getattr(left, "key", None) == "id" and right is not None:
                return self.users.get(int(right))
            if getattr(left, "name", None) == "lower" and right is not None:
                column = next(iter(left.clauses), None)
                if getattr(column, "key", None) == "email":
                    return next(
                        (user for user in self.users.values() if user.email.lower() == right),
                        None,
                    )
        return None

    def join(self, *args, **kwargs):
        return self

    def outerjoin(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def all(self):
        return []


class FakeSession:
    def __init__(self, users):
        self.users = users
        self.added = []

    def query(self, *entities):
        return FakeQuery(entities, self.users)

    def add(self, item):
        self.added.append(item)

    def commit(self):
        pass

    def rollback(self):
        pass

    def refresh(self, item):
        item.id = 99
        item.created_at = datetime.now(timezone.utc)


async def asgi_request(path, authorization=None, method="GET", body=None):
    headers = []
    if authorization:
        headers.append((b"authorization", authorization.encode("ascii")))
    if body is not None:
        headers.append((b"content-type", b"application/json"))
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path.split("?", 1)[0],
        "raw_path": path.split("?", 1)[0].encode("ascii"),
        "query_string": path.split("?", 1)[1].encode("ascii") if "?" in path else b"",
        "root_path": "",
        "headers": headers,
        "server": ("testserver", 80),
        "client": ("testclient", 12345),
        "state": {},
    }
    request_delivered = False
    messages = []

    request_body = json.dumps(body).encode("utf-8") if body is not None else b""

    async def receive():
        nonlocal request_delivered
        if not request_delivered:
            request_delivered = True
            return {"type": "http.request", "body": request_body, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message):
        messages.append(message)

    await main.app(scope, receive, send)
    start = next(message for message in messages if message["type"] == "http.response.start")
    body = b"".join(
        message.get("body", b"")
        for message in messages
        if message["type"] == "http.response.body"
    )
    return start["status"], json.loads(body) if body else None


class BackendAuthorizationTests(unittest.TestCase):
    def setUp(self):
        self.secret_patch = patch.dict(os.environ, {"JWT_SECRET_KEY": "unit-test-only-secret-key-not-a-real-token"})
        self.secret_patch.start()
        self.users = {
            11: SimpleNamespace(id=11, full_name="Test Admin", email="admin-test@example.invalid", role="ADMIN", password_hash="test-hash"),
            12: SimpleNamespace(id=12, full_name="Test Student", email="student-test@example.invalid", role="STUDENT", password_hash="test-hash"),
        }
        self.db = FakeSession(self.users)
        main.app.dependency_overrides[get_db] = lambda: self.db

    def tearDown(self):
        main.app.dependency_overrides.pop(get_db, None)
        self.secret_patch.stop()

    def token_for(self, user_id, role):
        return create_access_token(user_id, role)

    def request(self, path, role=None, user_id=None, token=None, method="GET", body=None):
        if token is None and role is not None:
            token = self.token_for(user_id, role)
        authorization = f"Bearer {token}" if token else None
        return asyncio.run(asgi_request(path, authorization, method, body))

    def test_anonymous_requests_to_admin_endpoints_return_401(self):
        for path in ("/energy/readings", "/occupancy", "/analytics/summary"):
            with self.subTest(path=path):
                status, _ = self.request(path)
                self.assertEqual(status, 401)

    def test_student_cannot_access_admin_endpoints(self):
        for path in ("/energy/readings", "/occupancy", "/analytics/summary"):
            with self.subTest(path=path):
                status, body = self.request(path, role="student", user_id=12)
                self.assertEqual(status, 403)
                self.assertEqual(body["detail"], "Insufficient permissions")

    def test_admin_can_access_admin_endpoint(self):
        status, body = self.request("/energy/readings?limit=1", role="admin", user_id=11)
        self.assertEqual(status, 200)
        self.assertEqual(body["readings"], [])

    def test_student_can_access_shared_directory_endpoint(self):
        for path in ("/buildings", "/rooms"):
            with self.subTest(path=path):
                status, body = self.request(path, role="student", user_id=12)
                self.assertEqual(status, 200)
                self.assertEqual(body, [])

    def test_student_can_read_published_notices_alerts_and_own_bookings(self):
        for path in ("/notices", "/emergency/alerts/published", "/bookings"):
            with self.subTest(path=path):
                status, body = self.request(path, role="student", user_id=12)
                self.assertEqual(status, 200)
                self.assertEqual(body, [])

    def test_student_cannot_manage_notices_or_emergency_alerts(self):
        cases = (
            ("/admin/notices", "GET", None),
            ("/notices", "POST", {"title": "Test", "content": "Test"}),
            ("/notices/1", "PATCH", {"published": False}),
            ("/notices/1", "DELETE", None),
            ("/emergency/alerts", "POST", {"title": "Test", "message": "Test", "severity": "LOW"}),
            ("/emergency/alerts", "GET", None),
            ("/bookings/5/status", "PATCH", {"status": "APPROVED"}),
        )
        for path, method, body in cases:
            with self.subTest(path=path, method=method):
                status, result = self.request(path, role="student", user_id=12, method=method, body=body)
                self.assertEqual(status, 403)
                self.assertEqual(result["detail"], "Insufficient permissions")

    def test_admin_is_read_and_review_only_for_student_booking_creation(self):
        start = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        end = (datetime.now(timezone.utc).replace(microsecond=0) + timedelta(hours=1)).isoformat()
        status, result = self.request(
            "/bookings", role="admin", user_id=11, method="POST",
            body={"room_id": 1, "purpose": "Test", "start_time": start, "end_time": end},
        )
        self.assertEqual(status, 403)
        self.assertEqual(result["detail"], "Insufficient permissions")

    def test_admin_can_publish_notice_and_emergency_alert(self):
        status, notice = self.request(
            "/notices", role="admin", user_id=11, method="POST",
            body={"title": "Verified notice", "content": "Approved campus message"},
        )
        self.assertEqual(status, 201)
        self.assertEqual(notice["title"], "Verified notice")
        self.assertTrue(self.db.added[-1].published)

        status, notices = self.request("/admin/notices", role="admin", user_id=11)
        self.assertEqual(status, 200)
        self.assertEqual(notices, [])

        status, alert = self.request(
            "/emergency/alerts", role="admin", user_id=11, method="POST",
            body={"title": "Alert", "message": "Verified alert details", "severity": "HIGH"},
        )
        self.assertEqual(status, 201)
        self.assertEqual(alert["severity"], "HIGH")
        self.assertTrue(self.db.added[-1].active)

    def test_admin_only_read_endpoints_remain_denied_to_students(self):
        for path in ("/energy/readings", "/occupancy", "/analytics/summary", "/emergency/alerts"):
            with self.subTest(path=path):
                status, _ = self.request(path, role="student", user_id=12)
                self.assertEqual(status, 403)

    def test_invalid_token_returns_401(self):
        status, _ = self.request("/analytics/summary", token="invalid.test.token")
        self.assertEqual(status, 401)

    def test_expired_token_returns_401(self):
        expired = create_access_token(
            11,
            "admin",
            now=int(time.time()) - TOKEN_LIFETIME_SECONDS - 1,
        )
        status, _ = self.request("/analytics/summary", token=expired)
        self.assertEqual(status, 401)

    def test_token_role_must_match_current_database_user(self):
        status, _ = self.request("/energy/readings?limit=1", role="admin", user_id=12)
        self.assertEqual(status, 401)

    def test_deleted_user_token_returns_401(self):
        status, _ = self.request("/auth/me", role="admin", user_id=99)
        self.assertEqual(status, 401)

    def test_auth_me_returns_server_verified_profile(self):
        status, body = self.request("/auth/me", role="student", user_id=12)
        self.assertEqual(status, 200)
        self.assertEqual(body, {
            "id": 12,
            "full_name": "Test Student",
            "email": "student-test@example.invalid",
            "role": "student",
        })

    def test_login_normalizes_uppercase_stored_role_and_issued_token(self):
        with patch.object(main, "verify_password", return_value=True):
            status, body = self.request(
                "/auth/login", method="POST",
                body={"email": " STUDENT-TEST@EXAMPLE.INVALID ", "password": "offline-test-password"},
            )

        self.assertEqual(status, 200)
        self.assertEqual(body["user"]["role"], "student")
        profile_status, profile = self.request("/auth/me", token=body["access_token"])
        self.assertEqual(profile_status, 200)
        self.assertEqual(profile["role"], "student")


if __name__ == "__main__":
    unittest.main()
