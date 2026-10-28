"""Interactively provision one ADMIN or STUDENT in an explicitly verified Neon target."""

import argparse
import getpass
import os
import re
import sys

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from demo_db_safety import DemoSetupError, require_project_confirmation, validate_target_url


def _parser():
    parser = argparse.ArgumentParser(
        description=(
            "Create one account only after the direct Neon target has been compared with Console. "
            "Project and branch IDs are operator-supplied claims, not independently verified by PostgreSQL."
        )
    )
    parser.add_argument("--expected-project-id", required=True)
    parser.add_argument("--expected-branch-id", required=True)
    parser.add_argument("--expected-host", required=True, help="Direct, unpooled host from Neon Console")
    parser.add_argument("--expected-database", required=True)
    parser.add_argument(
        "--confirm-neon-target-verified", action="store_true", required=True,
        help="Confirm these exact project/branch IDs, host, and database match Neon Console",
    )
    parser.add_argument(
        "--confirm-user-write", action="store_true", required=True,
        help="Confirm that creating one user in this verified target is authorized",
    )
    return parser


def normalize_role(value: str) -> str:
    role = value.strip().upper()
    if role not in {"ADMIN", "STUDENT"}:
        raise SystemExit("Role must be admin or student.")
    return role


def _validate_account_input():
    full_name = input("Full name: ").strip()
    email = input("Email: ").strip().lower()
    role = normalize_role(input("Role (admin/student): "))

    if not full_name or len(full_name) > 100:
        raise SystemExit("Full name must contain 1 to 100 characters.")
    if len(email) > 255 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise SystemExit("Enter a valid email address (maximum 255 characters).")
    password = getpass.getpass("Password (minimum 12 characters): ")
    confirmation = getpass.getpass("Confirm password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match.")
    return full_name, email, role, password


def main(argv=None):
    args = _parser().parse_args(argv)
    try:
        require_project_confirmation(
            args,
            write_confirmation="confirm_user_write",
            write_flag="--confirm-user-write",
            write_description="user provisioning write",
        )
        raw_url = os.environ.get("DATABASE_URL")
        target_url = validate_target_url(raw_url, args.expected_host, args.expected_database)
    except DemoSetupError as error:
        print(f"Refused: {error}", file=sys.stderr)
        return 2

    print(
        f"Provisioning target claim: project {args.expected_project_id}; branch {args.expected_branch_id}; "
        f"host {target_url.host}; database {target_url.database}. "
        "Project and branch IDs are operator-supplied claims, not independently verified by PostgreSQL."
    )

    try:
        full_name, email, role, password = _validate_account_input()
        from security import hash_password

        password_hash = hash_password(password)
    except ValueError as error:
        print(str(error), file=sys.stderr)
        return 2
    finally:
        password = ""

    database = None
    db = None
    try:
        # Importing database constructs an engine but does not connect. Validate
        # that its resolved URL is exactly the target approved above before use.
        import database as database_module
        import models

        database = database_module
        if database.engine.url != target_url:
            print("Refused: the backend engine target differs from the confirmed target.", file=sys.stderr)
            return 2

        db = database.SessionLocal()
        if db.query(models.User.id).filter(func.lower(models.User.email) == email).first():
            print("An account with that email already exists.", file=sys.stderr)
            return 2

        db.add(models.User(full_name=full_name, email=email, password_hash=password_hash, role=role))
        db.commit()
    except IntegrityError as error:
        if db is not None:
            db.rollback()
        original = error.orig
        sqlstate = getattr(original, "sqlstate", None) or getattr(original, "pgcode", None)
        constraint = getattr(getattr(original, "diag", None), "constraint_name", None)
        if sqlstate == "23505" and constraint == "users_email_key":
            message = "An account with that email already exists."
        elif sqlstate == "23514":
            message = "The account was rejected by a database check constraint."
        else:
            message = "The account could not be created because of a database integrity constraint."
        print(message, file=sys.stderr)
        return 1
    except Exception:
        if db is not None:
            try:
                db.rollback()
            except Exception:
                pass
        print("Account provisioning failed; database error details were suppressed.", file=sys.stderr)
        return 1
    finally:
        if db is not None:
            try:
                db.close()
            except Exception:
                pass
        if database is not None:
            try:
                database.engine.dispose()
            except Exception:
                pass

    print(f"Created {role.lower()} account for {email}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
