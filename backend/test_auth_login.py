"""Login verification tests using an isolated in-memory SQLite database."""

import unittest
from unittest.mock import Mock, patch

from fastapi import HTTPException, Response
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

import main
import models
from schemas import LoginRequest
from security import hash_password


class LoginTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        models.Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.db.add(models.User(
            id=1,
            full_name="Test Admin",
            email="admin@example.invalid",
            role="ADMIN",
            password_hash=hash_password("Test-Admin-Password-2026!"),
        ))
        self.db.commit()
        self.secret = patch.dict("os.environ", {"JWT_SECRET_KEY": "unit-test-only-key-that-is-not-a-secret"})
        self.secret.start()

    def tearDown(self):
        self.secret.stop()
        self.db.close()
        self.engine.dispose()

    def test_successful_login_verifies_password_and_returns_user(self):
        result = main.login(
            LoginRequest(email=" ADMIN@EXAMPLE.INVALID ", password="Test-Admin-Password-2026!"),
            Response(), self.db,
        )
        self.assertEqual(result["user"]["email"], "admin@example.invalid")
        self.assertEqual(result["user"]["role"], "admin")
        self.assertTrue(result["access_token"])

    def test_invalid_password_is_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            main.login(LoginRequest(email="admin@example.invalid", password="wrong-password"), Response(), self.db)
        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(raised.exception.detail, "Invalid email or password")

    def test_unknown_user_is_rejected_without_disclosing_account_state(self):
        with self.assertRaises(HTTPException) as raised:
            main.login(LoginRequest(email="unknown@example.invalid", password="wrong-password"), Response(), self.db)
        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(raised.exception.detail, "Invalid email or password")

    def test_database_query_error_returns_sanitized_service_unavailable(self):
        broken_db = Mock()
        broken_db.query.return_value.filter.return_value.first.side_effect = OperationalError(
            "SELECT users", {}, OSError("private connection details")
        )
        with self.assertRaises(HTTPException) as raised:
            main.login(LoginRequest(email="admin@example.invalid", password="some-password"), Response(), broken_db)
        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(raised.exception.detail, "Authentication database is unavailable")
        self.assertNotIn("private", raised.exception.detail)


if __name__ == "__main__":
    unittest.main()
