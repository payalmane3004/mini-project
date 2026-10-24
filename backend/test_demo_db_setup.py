"""Offline tests for guarded demo DB setup; tests never open a DB connection."""

import contextlib
import io
import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from demo_db_safety import (
    DemoSetupError,
    require_expected_schema_objects,
    require_expected_tables,
    require_project_confirmation,
    validate_target_url,
)
import initialize_demo_db
import preflight_demo_db
import seed_demo
from sqlalchemy.engine import URL


HOST = "ep-demo.example.test"
DATABASE = "neondb"
URL_TEXT = f"postgresql+psycopg://demo:never-print-this@{HOST}/{DATABASE}?sslmode=require"


class DemoDatabaseSafetyTests(unittest.TestCase):
    def _args(self, **overrides):
        values = dict(
            expected_project_id="proj-demo-123",
            expected_branch_id="br-demo-456",
            expected_host=HOST,
            expected_database=DATABASE,
            confirm_neon_target_verified=True,
            confirm_demo_write=True,
        )
        values.update(overrides)
        return SimpleNamespace(**values)

    def test_accepts_matching_postgresql_psycopg_target(self):
        parsed = validate_target_url(URL_TEXT, HOST, DATABASE)
        self.assertEqual(parsed.host, HOST)
        self.assertEqual(parsed.database, DATABASE)
        self.assertEqual(parsed.drivername, "postgresql+psycopg")
        url_object = URL.create(
            "postgresql+psycopg", username="demo", password="hidden", host=HOST,
            database=DATABASE, query={"sslmode": "require"},
        )
        self.assertEqual(validate_target_url(url_object, HOST, DATABASE).host, HOST)

    def test_missing_sqlite_and_wrong_driver_urls_are_refused(self):
        for raw in (None, "", "sqlite:///:memory:",
                    f"postgresql://demo:secret@{HOST}/{DATABASE}",
                    f"postgresql+psycopg2://demo:secret@{HOST}/{DATABASE}"):
            with self.subTest(url_kind="missing" if raw is None else str(raw).split(":", 1)[0]):
                with self.assertRaises(DemoSetupError):
                    validate_target_url(raw, HOST, DATABASE)

    def test_rejects_host_or_database_mismatch_without_echoing_secrets(self):
        for raw, host, database, expected_message in (
            (f"postgresql+psycopg://demo:do-not-echo@team.example.test/{DATABASE}?sslmode=require",
             HOST, DATABASE, "host does not match"),
            (f"postgresql+psycopg://demo:do-not-echo@{HOST}/teamdb?sslmode=require",
             HOST, DATABASE, "database does not match"),
        ):
            with self.subTest(expected_message=expected_message):
                with self.assertRaisesRegex(DemoSetupError, expected_message) as error:
                    validate_target_url(raw, host, database)
                self.assertNotIn("do-not-echo", str(error.exception))
                self.assertNotIn("team.example.test", str(error.exception))

    def test_tls_is_required(self):
        with self.assertRaisesRegex(DemoSetupError, "must require TLS"):
            validate_target_url(f"postgresql+psycopg://demo:secret@{HOST}/{DATABASE}", HOST, DATABASE)

    def test_pooled_neon_host_is_refused(self):
        pooled_host = "ep-demo-pooler.example.test"
        pooled_url = f"postgresql+psycopg://demo:secret@{pooled_host}/{DATABASE}?sslmode=require"
        with self.assertRaisesRegex(DemoSetupError, "direct, unpooled"):
            validate_target_url(pooled_url, pooled_host, DATABASE)

    def test_required_project_branch_host_database_and_confirmations(self):
        for field in ("expected_project_id", "expected_branch_id", "expected_host", "expected_database"):
            with self.subTest(field=field), self.assertRaises(DemoSetupError):
                require_project_confirmation(self._args(**{field: "  "}))
        for field in ("confirm_neon_target_verified", "confirm_demo_write"):
            with self.subTest(field=field), self.assertRaises(DemoSetupError):
                require_project_confirmation(self._args(**{field: False}))
        for parser in (initialize_demo_db._parser(), seed_demo._parser()):
            help_text = parser.format_help()
            for option in ("--expected-project-id", "--expected-branch-id", "--expected-host",
                           "--expected-database", "--confirm-neon-target-verified", "--confirm-demo-write"):
                self.assertIn(option, help_text)

    def test_schema_policy_rejects_non_public_schema_and_unexpected_objects(self):
        with self.assertRaisesRegex(DemoSetupError, "non-system schemas"):
            require_expected_schema_objects(unexpected_schemas=["team"], unexpected_objects=[])
        with self.assertRaisesRegex(DemoSetupError, "schema objects"):
            require_expected_schema_objects(unexpected_schemas=[], unexpected_objects=[("view", "x", "v")])
        require_expected_schema_objects(unexpected_schemas=[], unexpected_objects=[])

    def test_seeder_requires_exact_model_table_set(self):
        required = {"users", "buildings", "rooms"}
        require_expected_tables(required, required)
        with self.assertRaisesRegex(DemoSetupError, "incomplete"):
            require_expected_tables({"users", "buildings"}, required)
        with self.assertRaisesRegex(DemoSetupError, "Unexpected user tables"):
            require_expected_tables(required | {"team_records"}, required)

    def test_invalid_target_stops_both_entry_points_before_database_import(self):
        args = ["--expected-project-id", "proj-demo", "--expected-branch-id", "br-demo",
                "--expected-host", HOST, "--expected-database", DATABASE,
                "--confirm-neon-target-verified", "--confirm-demo-write"]
        original_import = __import__

        def guarded_import(name, *positional, **named):
            if name == "database":
                raise AssertionError("database module import should not be reached")
            return original_import(name, *positional, **named)

        with patch.dict(os.environ, {"DATABASE_URL": "sqlite:///:memory:"}), \
             patch("builtins.__import__", side_effect=guarded_import), \
             contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(initialize_demo_db.main(args), 2)
            self.assertEqual(seed_demo.main(args), 2)

    def test_read_only_preflight_refuses_missing_process_url_before_database_import(self):
        args = ["--expected-project-id", "proj-demo", "--expected-branch-id", "br-demo",
                "--expected-host", HOST, "--expected-database", DATABASE,
                "--confirm-neon-target-verified"]
        original_import = __import__

        def guarded_import(name, *positional, **named):
            if name == "database":
                raise AssertionError("database module import should not be reached")
            return original_import(name, *positional, **named)

        with patch.dict(os.environ, {"DATABASE_URL": ""}), \
             patch("builtins.__import__", side_effect=guarded_import), \
             contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(preflight_demo_db.main(args), 2)

    def test_read_only_preflight_never_invokes_schema_or_seed_writes(self):
        help_text = preflight_demo_db._parser().format_help()
        self.assertNotIn("--confirm-demo-write", help_text)
        args = ["--expected-project-id", "proj-demo", "--expected-branch-id", "br-demo",
                "--expected-host", HOST, "--expected-database", DATABASE,
                "--confirm-neon-target-verified"]

        class Connection:
            pass

        class Engine:
            url = URL.create("postgresql+psycopg", username="demo", password="hidden", host=HOST,
                             database=DATABASE, query={"sslmode": "require"})
            disposed = False

            @contextlib.contextmanager
            def connect(self):
                yield Connection()

            def dispose(self):
                self.disposed = True

        engine = Engine()
        fake_database = SimpleNamespace(engine=engine)
        with patch.dict(sys.modules, {"database": fake_database}), \
             patch.dict(os.environ, {"DATABASE_URL": URL_TEXT}), \
             patch.object(preflight_demo_db, "_preflight") as preflight, \
             contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(preflight_demo_db.main(args), 0)
        self.assertEqual(preflight.call_count, 1)
        self.assertTrue(engine.disposed)

    def test_target_mismatch_stops_before_engine_creation_import_or_connection(self):
        args = ["--expected-project-id", "proj-demo", "--expected-branch-id", "br-demo",
                "--expected-host", HOST, "--expected-database", DATABASE,
                "--confirm-neon-target-verified", "--confirm-demo-write"]
        original_import = __import__

        def guarded_import(name, *positional, **named):
            if name == "database":
                raise AssertionError("engine creation/import should not be reached")
            return original_import(name, *positional, **named)

        team_url = f"postgresql+psycopg://demo:secret@team.example.test/{DATABASE}?sslmode=require"
        with patch.dict(os.environ, {"DATABASE_URL": team_url}), \
             patch("builtins.__import__", side_effect=guarded_import), \
             contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(initialize_demo_db.main(args), 2)
            self.assertEqual(seed_demo.main(args), 2)

    def test_initializer_preflight_refuses_unexpected_schema_and_public_objects(self):
        class Result:
            def __init__(self, rows=(), scalar=None, row=None):
                self.rows, self.scalar, self.row = rows, scalar, row

            def one(self): return self.row
            def scalars(self): return self
            def all(self): return list(self.rows if self.rows else self.scalar or ())

        class Connection:
            def __init__(self, unexpected_schema=(), unexpected_public=()):
                self.unexpected_schema = unexpected_schema
                self.unexpected_public = unexpected_public
                self.read_only_started = False

            @contextlib.contextmanager
            def begin(self):
                yield self

            def exec_driver_sql(self, sql):
                self.read_only_started = sql == "SET TRANSACTION READ ONLY"

            def execute(self, statement):
                query = str(statement)
                if "current_database()" in query:
                    return Result(row=(DATABASE, "public", True, True, True, True))
                if "FROM pg_catalog.pg_namespace" in query and "nspname NOT IN" in query:
                    return Result(scalar=self.unexpected_schema)
                return Result(rows=self.unexpected_public)

        for schema, objects in ((["unexpected"], []), ([], [("relation", "extra", "v")])):
            connection = Connection(schema, objects)
            with self.subTest(schema=schema, objects=objects), self.assertRaises(DemoSetupError):
                initialize_demo_db._preflight(connection, DATABASE)
            self.assertTrue(connection.read_only_started)

    def test_seeder_preflight_refuses_missing_tables_and_unexpected_objects(self):
        class Result:
            def __init__(self, rows=(), row=None): self.rows, self.row = rows, row
            def one(self): return self.row
            def all(self): return list(self.rows)
            def scalars(self): return self

        expected = {"users", "buildings", "rooms", "room_bookings", "notices",
                    "emergency_alerts", "room_occupancy", "energy_readings",
                    "maintenance_requests", "building_floor_labels"}

        class Connection:
            def __init__(self, tables, relation_rows=()):
                self.tables, self.relation_rows = tables, relation_rows
                self.read_only_started = False
            def exec_driver_sql(self, sql): self.read_only_started = sql == "SET TRANSACTION READ ONLY"
            def execute(self, statement, params=None):
                query = str(statement)
                if "current_database()" in query:
                    return Result(row=(DATABASE, "public", True, True, True))
                if "nspname NOT IN" in query:
                    return Result()
                if "FROM pg_catalog.pg_tables" in query:
                    return Result(rows=[("public", name) for name in self.tables])
                if "FROM pg_catalog.pg_class c" in query:
                    return Result(rows=self.relation_rows)
                if "has_table_privilege" in query:
                    return Result(row=(True, True, True))
                return Result()

        class Engine:
            def __init__(self, connection): self.connection = connection
            @contextlib.contextmanager
            def connect(self): yield self.connection

        for tables, relation_rows in ((expected - {"rooms"}, []), (expected, [("extra_view",)])):
            connection = Connection(tables, relation_rows)
            with self.subTest(tables=len(tables), relations=relation_rows), self.assertRaises(DemoSetupError):
                seed_demo._preflight_schema(Engine(connection), DATABASE, expected, seed_demo.SEED_TABLES)
            self.assertTrue(connection.read_only_started)

    def test_seed_helpers_preserve_existing_demo_values_and_refuse_conflicts(self):
        class Query:
            def __init__(self, value): self.value = value
            def filter(self, *_): return self
            def limit(self, _): return self
            def all(self): return [] if self.value is None else [self.value]

        existing_user = SimpleNamespace(full_name="DEMO User", role="STUDENT", password_hash="existing-hash")
        existing_record = SimpleNamespace(code="DEMO", name="Original content")
        user_model = SimpleNamespace(email="email")
        record_model = SimpleNamespace()
        session = SimpleNamespace(query=lambda model: Query(existing_user if model is user_model else existing_record),
                                  add=lambda value: self.fail("existing records must not be added"))
        user = seed_demo._ensure_user(session, user_model, SimpleNamespace(lower=lambda x: x),
                                      email="demo@example.invalid", full_name="DEMO User", role="student",
                                      hash_password=lambda _: self.fail("existing password must not be reset"))
        self.assertEqual(user.password_hash, "existing-hash")
        self.assertEqual(user.role, "STUDENT")
        record = seed_demo._ensure_marked(session, record_model, [], expected_fields={"code": "DEMO", "name": "new"},
                                          identity_fields={"code": "DEMO"}, label="fixture")
        self.assertEqual(record.name, "Original content")
        with self.assertRaises(DemoSetupError):
            seed_demo._ensure_marked(session, record_model, [], expected_fields={},
                                     identity_fields={"code": "OTHER"}, label="conflicting fixture")

    def test_new_demo_user_role_is_stored_uppercase(self):
        class Query:
            def filter(self, *_): return self
            def limit(self, _): return self
            def all(self): return []

        class UserModel:
            email = "email"
            def __init__(self, **values): self.__dict__.update(values)

        class Session:
            def __init__(self): self.added = []
            def query(self, _): return Query()
            def add(self, item): self.added.append(item)
            def flush(self): pass

        session = Session()
        with patch.object(seed_demo, "_prompt_password", return_value="offline-hash"):
            user = seed_demo._ensure_user(
                session, UserModel, SimpleNamespace(lower=lambda value: value),
                email="new@example.invalid", full_name="Demo User", role="admin",
                hash_password=lambda _: "unused",
            )
        self.assertEqual(user.role, "ADMIN")
        self.assertEqual(session.added, [user])

    def test_seed_transaction_rolls_back_when_mocked_insert_or_flush_fails(self):
        class Transaction:
            def __init__(self): self.rolled_back = False
            def __enter__(self): return self
            def __exit__(self, exc_type, *_):
                self.rolled_back = exc_type is not None
                return False

        transaction = Transaction()

        class Session:
            def begin(self): return transaction
            def close(self): pass

        class Engine:
            url = URL.create("postgresql+psycopg", username="demo", password="hidden", host=HOST,
                             database=DATABASE, query={"sslmode": "require"})
            def dispose(self): pass

        fake_database = SimpleNamespace(
            engine=Engine(),
            Base=SimpleNamespace(metadata=SimpleNamespace(tables={name: None for name in seed_demo.SEED_TABLES})),
            SessionLocal=Session,
        )
        fake_models = SimpleNamespace()
        fake_security = SimpleNamespace(hash_password=lambda password: "hash")
        args = ["--expected-project-id", "proj-demo", "--expected-branch-id", "br-demo",
                "--expected-host", HOST, "--expected-database", DATABASE,
                "--confirm-neon-target-verified", "--confirm-demo-write"]

        def mocked_seed(session, models, hasher):
            raise RuntimeError("simulated flush failure")

        with patch.dict(sys.modules, {"database": fake_database, "models": fake_models,
                                     "security": fake_security}), \
             patch.dict(os.environ, {"DATABASE_URL": URL_TEXT}), \
             patch.object(seed_demo, "_preflight_schema"), \
             patch.object(seed_demo, "_seed", side_effect=mocked_seed), \
             contextlib.redirect_stderr(io.StringIO()):
            result = seed_demo.main(args)
        self.assertEqual(result, 1)
        self.assertTrue(transaction.rolled_back)


if __name__ == "__main__":
    unittest.main()
