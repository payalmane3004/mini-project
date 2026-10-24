"""Offline tests for the explicitly confirmed user provisioning command."""

import contextlib
import io
import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError

import models
import provision_user


HOST = "ep-provision.example.test"
DATABASE = "campussphere_demo"
URL_TEXT = f"postgresql+psycopg://offline:placeholder@{HOST}/{DATABASE}?sslmode=require"
TARGET_ARGS = [
    "--expected-project-id", "project-claim",
    "--expected-branch-id", "branch-claim",
    "--expected-host", HOST,
    "--expected-database", DATABASE,
    "--confirm-neon-target-verified",
    "--confirm-user-write",
]


class FakeQuery:
    def filter(self, *_):
        return self

    def first(self):
        return None


class FakeSession:
    def __init__(self, commit_error=None):
        self.commit_error = commit_error
        self.added = []
        self.commits = 0
        self.rollbacks = 0
        self.closed = False

    def query(self, *_):
        return FakeQuery()

    def add(self, record):
        self.added.append(record)

    def commit(self):
        if self.commit_error:
            raise self.commit_error
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.closed = True


class ProvisionUserTests(unittest.TestCase):
    def _database_module(self, session, url=URL_TEXT):
        engine = SimpleNamespace(url=make_url(url), disposed=False)
        engine.dispose = lambda: setattr(engine, "disposed", True)
        return SimpleNamespace(engine=engine, SessionLocal=Mock(return_value=session))

    def _run(self, *, url=URL_TEXT, session=None, entered=None):
        fake_session = session or FakeSession()
        fake_database = self._database_module(fake_session, url)
        fake_security = SimpleNamespace(hash_password=lambda _password: "offline-hash")
        entries = iter(entered or ("Demo User", "demo@example.invalid", "admin"))
        with patch.dict(os.environ, {"DATABASE_URL": URL_TEXT}), \
             patch.dict(sys.modules, {"database": fake_database, "security": fake_security}), \
             patch("builtins.input", side_effect=lambda _prompt: next(entries)), \
             patch("getpass.getpass", side_effect=("offline-password", "offline-password")), \
             contextlib.redirect_stdout(io.StringIO()) as output:
            result = provision_user.main(TARGET_ARGS)
        return result, fake_session, fake_database, output.getvalue()

    def test_role_validation_accepts_only_admin_and_student(self):
        self.assertEqual(provision_user.normalize_role(" admin "), "ADMIN")
        self.assertEqual(provision_user.normalize_role("STUDENT"), "STUDENT")
        with self.assertRaises(SystemExit):
            provision_user.normalize_role("superuser")

    def test_confirmation_arguments_are_mandatory_before_account_input(self):
        with patch("builtins.input", side_effect=AssertionError("account input must not start")), \
             contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as raised:
                provision_user.main(TARGET_ARGS[:-1])
        self.assertEqual(raised.exception.code, 2)

    def test_missing_process_url_refuses_before_importing_database(self):
        original_import = __import__

        def guarded_import(name, *args, **kwargs):
            if name == "database":
                raise AssertionError("database must not be imported before target validation")
            return original_import(name, *args, **kwargs)

        with patch.dict(os.environ, {"DATABASE_URL": ""}), \
             patch("builtins.__import__", side_effect=guarded_import), \
             patch("builtins.input", side_effect=AssertionError("account input must not start")), \
             contextlib.redirect_stderr(io.StringIO()) as errors:
            result = provision_user.main(TARGET_ARGS)
        self.assertEqual(result, 2)
        self.assertNotIn("placeholder", errors.getvalue())

    def test_target_mismatch_refuses_before_session_creation(self):
        unused_session = FakeSession()
        fake_database = self._database_module(unused_session)
        arguments = [*TARGET_ARGS]
        arguments[arguments.index(HOST)] = "another-host.example.test"
        with patch.dict(os.environ, {"DATABASE_URL": URL_TEXT}), \
             patch.dict(sys.modules, {"database": fake_database}), \
             patch("builtins.input", side_effect=AssertionError("account input must not start")), \
             contextlib.redirect_stderr(io.StringIO()):
            result = provision_user.main(arguments)
        self.assertEqual(result, 2)
        fake_database.SessionLocal.assert_not_called()

    def test_confirmed_provisioning_uses_uppercase_role_and_hashes_password(self):
        result, session, database, output = self._run()
        self.assertEqual(result, 0)
        self.assertEqual(session.commits, 1)
        self.assertEqual(session.rollbacks, 0)
        self.assertTrue(session.closed)
        self.assertTrue(database.engine.disposed)
        self.assertEqual(len(session.added), 1)
        user = session.added[0]
        self.assertEqual(user.full_name, "Demo User")
        self.assertEqual(user.email, "demo@example.invalid")
        self.assertEqual(user.role, "ADMIN")
        self.assertEqual(user.password_hash, "offline-hash")
        self.assertNotIn("offline-password", output)

    def test_integrity_failure_rolls_back_and_does_not_print_database_details(self):
        class FakePostgresError(Exception):
            sqlstate = "23514"

        session = FakeSession(commit_error=IntegrityError("insert", {}, FakePostgresError("private detail")))
        with contextlib.redirect_stderr(io.StringIO()) as errors:
            result, _, database, _ = self._run(session=session)
        self.assertEqual(result, 1)
        self.assertEqual(session.rollbacks, 1)
        self.assertTrue(session.closed)
        self.assertTrue(database.engine.disposed)
        self.assertIn("database check constraint", errors.getvalue())
        self.assertNotIn("private detail", errors.getvalue())

    def test_engine_target_is_rechecked_before_session_creation(self):
        fake_session = FakeSession()
        other_url = URL_TEXT.replace(HOST, "different-host.example.test")
        fake_database = self._database_module(fake_session, other_url)
        entries = iter(("Demo User", "demo@example.invalid", "student"))
        fake_security = SimpleNamespace(hash_password=lambda _password: "offline-hash")
        with patch.dict(os.environ, {"DATABASE_URL": URL_TEXT}), \
             patch.dict(sys.modules, {"database": fake_database, "security": fake_security}), \
             patch("builtins.input", side_effect=lambda _prompt: next(entries)), \
             patch("getpass.getpass", side_effect=("offline-password", "offline-password")), \
             contextlib.redirect_stderr(io.StringIO()) as errors:
            result = provision_user.main(TARGET_ARGS)
        self.assertEqual(result, 2)
        fake_database.SessionLocal.assert_not_called()
        self.assertIn("engine target differs", errors.getvalue())


if __name__ == "__main__":
    unittest.main()
