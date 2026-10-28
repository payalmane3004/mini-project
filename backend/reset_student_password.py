"""Local development recovery for one existing CampusSphere student account.

Requires CAMPUSSPHERE_RESET_DATABASE_URL to point to a SQLite file. This is
intentionally separate from backend/.env, which may point at a remote database.
"""

import getpass
import os
from pathlib import Path

from sqlalchemy import func, or_
from sqlalchemy.engine import make_url


BACKEND_DIR = Path(__file__).resolve().parent


def verified_local_database_url() -> tuple[str, Path]:
    configured = os.environ.get("CAMPUSSPHERE_RESET_DATABASE_URL", "").strip()
    if not configured:
        raise SystemExit(
            "Set CAMPUSSPHERE_RESET_DATABASE_URL to a local SQLite development database."
        )
    try:
        parsed = make_url(configured)
    except Exception as error:
        raise SystemExit("The reset database URL is invalid.") from error
    if (
        parsed.get_backend_name() != "sqlite"
        or not parsed.database
        or parsed.database == ":memory:"
        or parsed.query
        or parsed.fragment
    ):
        raise SystemExit("Password recovery only accepts a local SQLite database file.")

    database_path = Path(parsed.database)
    if not database_path.is_absolute():
        database_path = (Path.cwd() / database_path).resolve()
    else:
        database_path = database_path.resolve()
    try:
        database_path.relative_to(BACKEND_DIR)
    except ValueError as error:
        raise SystemExit(f"The SQLite database must be inside {BACKEND_DIR}.") from error
    if not database_path.is_file():
        raise SystemExit("The SQLite database file does not exist; refusing to create a new database.")
    return configured, database_path


def change_student_password(db, user, new_password: str, *, confirmed: bool) -> None:
    """Change one verified student row, keeping all other account data intact."""
    from security import hash_password

    if not confirmed:
        raise ValueError("Explicit confirmation is required.")
    if (user.role or "").strip().lower() != "student":
        raise ValueError("The selected account is not a student account.")
    new_hash = hash_password(new_password)
    user.password_hash = new_hash
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise


def main() -> None:
    reset_url, database_path = verified_local_database_url()
    # database.py uses DATABASE_URL to construct the project's standard engine
    # and SessionLocal. Set it before importing that module so .env cannot win.
    os.environ["DATABASE_URL"] = reset_url
    from database import SessionLocal
    import models

    print(f"Verified local SQLite database: {database_path}")
    identifier = input("Student email, full name, or numeric user ID: ").strip()
    if not identifier:
        raise SystemExit("An account identifier is required.")

    db = SessionLocal()
    try:
        predicates = [
            func.lower(models.User.email) == identifier.lower(),
            func.lower(models.User.full_name) == identifier.lower(),
        ]
        if identifier.isdecimal():
            predicates.append(models.User.id == int(identifier))
        candidates = db.query(models.User).filter(or_(*predicates)).all()
        if not candidates:
            raise SystemExit("No account matched that identifier in the verified local database.")
        if len(candidates) != 1:
            raise SystemExit("That identifier matches multiple accounts; use the exact email or numeric ID.")
        user = candidates[0]
        if (user.role or "").strip().lower() != "student":
            raise SystemExit("The selected account is not a student; no password was changed.")

        print(f"Selected student ID: {user.id}")
        print(f"Name: {user.full_name}")
        print(f"Email: {user.email}")
        confirmation = input(
            f'Type RESET {user.id} {database_path} to confirm this account and database: '
        )
        expected = f"RESET {user.id} {database_path}"
        if confirmation != expected:
            raise SystemExit("Confirmation did not match; no password was changed.")

        password = getpass.getpass("New password (minimum 12 characters): ")
        repeated = getpass.getpass("Confirm new password: ")
        if password != repeated:
            raise SystemExit("Passwords do not match; no password was changed.")
        change_student_password(db, user, password, confirmed=True)
        print(f"Password updated for student ID {user.id}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
