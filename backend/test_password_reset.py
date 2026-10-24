"""Tests for local password recovery without connecting to a configured database."""

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from reset_student_password import change_student_password, verified_local_database_url
from security import hash_password, verify_password


class RecordingSession:
    def __init__(self):
        self.commits = 0
        self.rollbacks = 0

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


class PasswordResetTests(unittest.TestCase):
    def test_hash_verification_accepts_only_matching_password(self):
        encoded = hash_password("correct horse battery staple")
        self.assertTrue(verify_password("correct horse battery staple", encoded))
        self.assertFalse(verify_password("different password", encoded))
        self.assertNotEqual(encoded, "correct horse battery staple")

    def test_reset_preserves_student_identity_role_and_related_records(self):
        original_hash = hash_password("original student password")
        student = SimpleNamespace(
            id=25,
            full_name="Student Example",
            email="student@example.invalid",
            role="STUDENT",
            password_hash=original_hash,
        )
        other_user = SimpleNamespace(id=26, role="ADMIN", password_hash=hash_password("admin password"))
        related_records = [{"booking_id": 88, "user_id": 25, "status": "PENDING"}]
        student_identity = (student.id, student.full_name, student.email, student.role)
        other_user_before = other_user.password_hash
        bookings_before = [record.copy() for record in related_records]
        db = RecordingSession()

        change_student_password(db, student, "new secure student password", confirmed=True)

        self.assertTrue(verify_password("new secure student password", student.password_hash))
        self.assertEqual((student.id, student.full_name, student.email, student.role), student_identity)
        self.assertEqual(other_user.password_hash, other_user_before)
        self.assertEqual(related_records, bookings_before)
        self.assertEqual(db.commits, 1)

    def test_reset_rejects_unconfirmed_and_admin_accounts(self):
        db = RecordingSession()
        student = SimpleNamespace(role="STUDENT", password_hash=hash_password("original student password"))
        with self.assertRaises(ValueError):
            change_student_password(db, student, "new secure student password", confirmed=False)
        admin = SimpleNamespace(role="ADMIN", password_hash=hash_password("original admin password"))
        with self.assertRaises(ValueError):
            change_student_password(db, admin, "new secure admin password", confirmed=True)
        self.assertEqual(db.commits, 0)

    def test_database_guard_rejects_configured_neon_url(self):
        with patch.dict("os.environ", {"CAMPUSSPHERE_RESET_DATABASE_URL": "postgresql://user:pass@db.neon.tech/neondb"}):
            with self.assertRaises(SystemExit):
                verified_local_database_url()


if __name__ == "__main__":
    unittest.main()
