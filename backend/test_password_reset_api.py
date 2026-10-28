"""Password recovery API tests run only against a temporary in-memory database."""

import unittest
from contextlib import ExitStack
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse, parse_qs
from unittest.mock import patch

from fastapi import HTTPException
from starlette.requests import Request
from starlette.responses import Response
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import main
import models
from security import hash_password
from schemas import ForgotPasswordRequest, LoginRequest, PasswordResetRequest


class PasswordResetApiTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        models.Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine)
        with self.session_factory() as db:
            db.add_all([
                models.User(id=71, full_name="Demo Student", email="student@campussphere-demo.example.invalid",
                            role="STUDENT", password_hash=hash_password("Original-Student-Pass-2026!")),
                models.User(id=72, full_name="Demo Admin", email="admin@campussphere-demo.example.invalid",
                            role="ADMIN", password_hash=hash_password("Original-Admin-Pass-2026!")),
            ])
            db.commit()

        self.stack = ExitStack()
        self.stack.enter_context(patch.object(main, "engine", self.engine))
        self.stack.enter_context(patch.object(main, "DATABASE_ENVIRONMENT", "development"))
        self.stack.enter_context(patch.object(main, "USES_APPROVED_DEMO_FIXTURE", True))
        self.stack.enter_context(patch.object(main, "is_active_demo_engine", return_value=True))
        self.stack.enter_context(patch.object(main, "require_approved_demo_engine", return_value=self.engine))
        self.request = Request({
            "type": "http", "method": "POST", "path": "/auth/password-reset/request",
            "headers": [], "query_string": b"", "server": ("127.0.0.1", 8000),
            "client": ("127.0.0.1", 12345), "scheme": "http", "http_version": "1.1",
        })
        self.response = Response()

    def tearDown(self):
        self.stack.close()
        self.engine.dispose()

    def request_reset(self, email):
        return main.request_password_reset(ForgotPasswordRequest(email=email), self.request, Response())

    def request_link(self, email="student@campussphere-demo.example.invalid"):
        self.request_reset(email)
        with self.session_factory() as db:
            return main.create_demo_reset_link(
                ForgotPasswordRequest(email=email), self.request, Response(), db
            )

    def token_from(self, response):
        path = urlparse(response["reset_url"])
        return parse_qs(path.query)["token"][0]

    def test_unknown_email_has_same_public_response_and_no_demo_link(self):
        known = self.request_reset("student@campussphere-demo.example.invalid")
        unknown = self.request_reset("nobody@example.invalid")
        self.assertEqual(known, unknown)
        link = self.request_link("nobody@example.invalid")
        self.assertIsNone(link["reset_url"])

    def test_rejects_bad_email_input(self):
        with self.assertRaises(Exception):
            ForgotPasswordRequest(email="x")

    def test_invalid_weak_and_mismatched_reset_requests_fail(self):
        token = self.token_from(self.request_link())
        with self.assertRaises(Exception):
            PasswordResetRequest(token=token, new_password="weak", confirm_password="weak")
        with self.assertRaises(Exception):
            PasswordResetRequest(token=token, new_password="New-Student-Password-2026!", confirm_password="different")
        with self.assertRaises(HTTPException) as invalid:
            self.complete("x" * 43, "New-Student-Password-2026!", "New-Student-Password-2026!")
        self.assertEqual(invalid.exception.status_code, 400)

    def test_expired_token_fails(self):
        token = self.token_from(self.request_link())
        with self.session_factory() as db:
            reset = db.query(models.PasswordResetToken).one()
            reset.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
            db.commit()
        with self.assertRaises(HTTPException) as expired:
            self.complete(token, "New-Student-Password-2026!", "New-Student-Password-2026!")
        self.assertEqual(expired.exception.status_code, 400)

    def test_successful_reset_logs_in_and_token_cannot_be_reused(self):
        token = self.token_from(self.request_link())
        new_password = "New-Student-Password-2026!"
        payload = {"token": token, "new_password": new_password, "confirm_password": new_password}
        self.assertIn("Password updated", self.complete(token, new_password, new_password)["message"])
        login = main.login(LoginRequest(email="student@campussphere-demo.example.invalid", password=new_password), Response(), self.open_db())
        self.assertEqual(login["user"]["role"], "student")
        with self.assertRaises(HTTPException) as reused:
            self.complete(token, new_password, new_password)
        self.assertEqual(reused.exception.status_code, 400)

    def test_new_link_invalidates_previous_link(self):
        old_token = self.token_from(self.request_link())
        self.token_from(self.request_link())
        with self.assertRaises(HTTPException) as invalidated:
            self.complete(old_token, "New-Student-Password-2026!", "New-Student-Password-2026!")
        self.assertEqual(invalidated.exception.status_code, 400)

    def test_shared_database_configuration_refuses_reset(self):
        with patch.object(main, "DATABASE_ENVIRONMENT", "production"):
            with self.assertRaises(Exception):
                main._require_demo_password_reset()
        with patch.object(main, "DATABASE_ENVIRONMENT", "development"), \
                patch.object(main, "USES_APPROVED_DEMO_FIXTURE", False):
            with self.assertRaises(Exception):
                main._require_demo_password_reset()
        with patch.object(main, "is_active_demo_engine", return_value=False):
            with self.assertRaises(Exception):
                main._require_demo_password_reset()

    def test_token_storage_contains_only_a_digest(self):
        token = self.token_from(self.request_link())
        with self.session_factory() as db:
            stored = db.query(models.PasswordResetToken.token_hash).one()[0]
        import hashlib
        self.assertEqual(len(stored), 64)
        self.assertNotEqual(stored, token)
        self.assertEqual(stored, hashlib.sha256(token.encode()).hexdigest())

    def open_db(self):
        return self.session_factory()

    def complete(self, token, password, confirmation):
        with self.session_factory() as db:
            return main.complete_password_reset(
                PasswordResetRequest(token=token, new_password=password, confirm_password=confirmation),
                self.request, Response(), db,
            )


if __name__ == "__main__":
    unittest.main()
