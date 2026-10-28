"""Read-only preflight for an explicitly selected, isolated Neon demo database."""

import argparse
import os
import sys

from demo_db_safety import DemoSetupError, validate_target_url
from initialize_demo_db import _preflight


def _parser():
    parser = argparse.ArgumentParser(
        description=(
            "Connect to the explicitly selected Neon target and check that the public "
            "schema is empty and required privileges exist. This command performs "
            "read-only checks only. Project and branch IDs are operator-supplied claims."
        )
    )
    parser.add_argument("--expected-project-id", required=True)
    parser.add_argument("--expected-branch-id", required=True)
    parser.add_argument("--expected-host", required=True, help="Direct, unpooled host from Neon Console")
    parser.add_argument("--expected-database", required=True)
    parser.add_argument(
        "--confirm-neon-target-verified",
        action="store_true",
        required=True,
        help="Confirm these exact IDs, host, and database match Neon Console",
    )
    return parser


def main(argv=None):
    args = _parser().parse_args(argv)
    engine = None
    try:
        for name, option in (
            ("expected_project_id", "--expected-project-id"),
            ("expected_branch_id", "--expected-branch-id"),
            ("expected_host", "--expected-host"),
            ("expected_database", "--expected-database"),
        ):
            if not getattr(args, name, "").strip():
                raise DemoSetupError(f"{option} must not be blank.")
        if not args.confirm_neon_target_verified:
            raise DemoSetupError("Compare the supplied target details with Neon Console first.")

        url = validate_target_url(
            os.environ.get("DATABASE_URL"), args.expected_host, args.expected_database
        )

        # Import only after the required process-level URL has been validated.
        import database

        engine = database.engine
        validate_target_url(engine.url, args.expected_host, args.expected_database)
        with engine.connect() as connection:
            _preflight(connection, args.expected_database)

        print(
            f"Read-only preflight passed for project claim {args.expected_project_id}; "
            f"branch claim {args.expected_branch_id}; host {url.host}; database {url.database}. "
            "Project and branch IDs are operator-supplied claims, not independently verified by PostgreSQL."
        )
        return 0
    except DemoSetupError as error:
        print(f"Refused: {error}", file=sys.stderr)
        return 2
    except Exception:
        print("Preflight failed; database error details were suppressed.", file=sys.stderr)
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
