"""Database configuration and health behavior without touching shared data."""

import os
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

import main
import security


BACKEND_DIR = Path(__file__).resolve().parent


class DatabaseConfigurationTests(unittest.TestCase):
    def test_missing_database_url_fails_with_safe_configuration_message(self):
        environment = os.environ.copy()
        environment.pop("DATABASE_URL", None)
        environment["CAMPUSSPHERE_ENV"] = "production"
        environment["PYTHON_DOTENV_DISABLED"] = "1"
        result = subprocess.run(
            [sys.executable, "-c", "import database"],
            cwd=BACKEND_DIR,
            env=environment,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DATABASE_URL is required", result.stderr)
        self.assertNotIn("postgresql://", result.stderr)

    def test_dotenv_resolution_is_independent_of_working_directory(self):
        environment = os.environ.copy()
        environment.pop("DATABASE_URL", None)
        environment["CAMPUSSPHERE_ENV"] = "production"
        environment.pop("PYTHON_DOTENV_DISABLED", None)
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                f"import sys; sys.path.insert(0, {str(BACKEND_DIR)!r}); import database; print(database.engine.dialect.name)",
            ],
            cwd=BACKEND_DIR.parent,
            env=environment,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "postgresql")

    def test_default_development_uses_the_marked_demo_fixture_without_loading_dotenv(self):
        environment = os.environ.copy()
        environment.pop("DATABASE_URL", None)
        environment.pop("CAMPUSSPHERE_ENV", None)
        environment.pop("PYTHON_DOTENV_DISABLED", None)
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from pathlib import Path; import database; from demo_mode import DEMO_DATABASE_PATH, is_active_demo_engine; "
                "print(database.DATABASE_ENVIRONMENT == 'development' and database.engine.dialect.name == 'sqlite' "
                "and Path(database.engine.url.database).resolve() == DEMO_DATABASE_PATH.resolve() "
                "and is_active_demo_engine(database.engine))",
            ],
            cwd=BACKEND_DIR,
            env=environment,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "True")

    def test_development_refuses_non_sqlite_database_urls_without_connecting(self):
        environment = os.environ.copy()
        environment["CAMPUSSPHERE_ENV"] = "development"
        environment["DATABASE_URL"] = "postgresql://unprinted.invalid/private"
        environment["PYTHON_DOTENV_DISABLED"] = "1"
        result = subprocess.run(
            [sys.executable, "-c", "import database"],
            cwd=BACKEND_DIR,
            env=environment,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("requires CAMPUSSPHERE_ENV=production", result.stderr)
        self.assertNotIn("unprinted.invalid", result.stderr)

    def test_development_jwt_secret_is_process_local_and_stable(self):
        with patch.object(security, "DATABASE_ENVIRONMENT", "development"), patch.dict(os.environ, {}, clear=True), patch.object(
            security, "_DEVELOPMENT_SECRET_KEY", None
        ):
            first = security._secret_key()
            second = security._secret_key()
        self.assertGreaterEqual(len(first), 32)
        self.assertEqual(first, second)

    def test_production_requires_an_explicit_jwt_secret(self):
        with patch.object(security, "DATABASE_ENVIRONMENT", "production"), patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(HTTPException) as raised:
                security._secret_key()
        self.assertEqual(raised.exception.status_code, 503)

    def test_health_reports_active_environment_and_demo_mode(self):
        connection = MagicMock()
        connection.__enter__.return_value.execute.return_value = 1
        with patch.object(main.engine, "connect", return_value=connection), patch.object(
            main, "is_active_demo_engine", return_value=True
        ), patch.object(main, "DATABASE_ENVIRONMENT", "development"):
            result = main.health_check()
        self.assertEqual(result, {
            "status": "healthy",
            "database": "connected",
            "environment": "development",
            "demo_mode": True,
        })

    def test_health_check_hides_connection_exception_details(self):
        with patch.object(main.engine, "connect", side_effect=OSError("private connection detail")):
            with self.assertRaises(HTTPException) as raised:
                main.health_check()
        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(raised.exception.detail, "Database connection failed")
        self.assertNotIn("private connection detail", raised.exception.detail)


if __name__ == "__main__":
    unittest.main()
