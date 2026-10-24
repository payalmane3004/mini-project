"""Pure safety checks shared by the isolated demo database commands."""

from importlib.util import find_spec

from sqlalchemy.engine import make_url


class DemoSetupError(ValueError):
    """A safe, user-facing refusal that contains no connection credentials."""


def validate_target_url(raw_url, expected_host, expected_database):
    """Validate target identity and driver without creating an engine or connecting."""
    if raw_url is None or (isinstance(raw_url, str) and not raw_url.strip()):
        raise DemoSetupError("DATABASE_URL is not set in this process.")

    try:
        url = make_url(raw_url)
    except Exception as error:
        raise DemoSetupError("DATABASE_URL could not be parsed; its value was suppressed.") from error

    if url.drivername != "postgresql+psycopg":
        raise DemoSetupError("Only a postgresql+psycopg URL is allowed for this Neon workflow.")
    if find_spec("psycopg") is None:
        raise DemoSetupError("The psycopg 3 driver is not installed in this Python environment.")
    sslmode = str(url.query.get("sslmode", "")).casefold()
    if sslmode not in {"require", "verify-ca", "verify-full"}:
        raise DemoSetupError("DATABASE_URL must require TLS with an accepted sslmode.")

    actual_host = (url.host or "").rstrip(".").casefold()
    required_host = (expected_host or "").strip().rstrip(".").casefold()
    if not required_host or not actual_host or actual_host != required_host:
        raise DemoSetupError("DATABASE_URL host does not match --expected-host.")
    if "pooler" in actual_host:
        raise DemoSetupError("DATABASE_URL must use the direct, unpooled Neon hostname.")
    if not expected_database or url.database != expected_database:
        raise DemoSetupError("DATABASE_URL database does not match --expected-database.")
    return url


def require_empty_schema(user_tables, public_relations, *, require_empty_public):
    """Refuse initialization if any user tables exist or public is not empty."""
    if user_tables:
        raise DemoSetupError("User tables already exist; refusing initialization.")
    if require_empty_public and public_relations:
        raise DemoSetupError("The public schema is not empty; refusing initialization.")


def require_expected_tables(existing_tables, required_tables):
    """Require an exact table-name match before the seeder can write."""
    existing = set(existing_tables)
    required = set(required_tables)
    missing = required - existing
    unexpected = existing - required
    if missing:
        raise DemoSetupError("The demo schema is incomplete; run the guarded initializer first.")
    if unexpected:
        raise DemoSetupError("Unexpected user tables exist; refusing to seed this database.")


def require_project_confirmation(
    args,
    *,
    write_confirmation="confirm_demo_write",
    write_flag="--confirm-demo-write",
    write_description="demo write",
):
    """Require explicit target values and a separate Console comparison attestation."""
    for name, label in (
        ("expected_project_id", "--expected-project-id"),
        ("expected_branch_id", "--expected-branch-id"),
        ("expected_host", "--expected-host"),
        ("expected_database", "--expected-database"),
    ):
        if not str(getattr(args, name, "") or "").strip():
            raise DemoSetupError(f"{label} must not be blank.")
    if not args.confirm_neon_target_verified:
        raise DemoSetupError(
            "Compare the supplied project ID, branch ID, host, and database with Neon Console, "
            "then pass --confirm-neon-target-verified. PostgreSQL does not verify project or branch IDs."
        )
    if not getattr(args, write_confirmation, False):
        raise DemoSetupError(f"Pass {write_flag} only after the target is verified and the {write_description} is authorized.")


def require_expected_schema_objects(*, unexpected_schemas, unexpected_objects):
    """Reject user objects outside the documented fresh-project/ORM policy.

    PostgreSQL-owned namespaces allowed by catalog queries are pg_catalog,
    information_schema, pg_toast*, and pg_temp*. The application namespace is
    public. The only tolerated installed extension is PostgreSQL's built-in
    plpgsql in pg_catalog. Initializer callers require no application objects;
    seeder callers may allow only ORM tables and their dependent indexes,
    sequences, and row types.
    """
    if unexpected_schemas:
        raise DemoSetupError("Unexpected non-system schemas exist; refusing demo database operation.")
    if unexpected_objects:
        raise DemoSetupError("Unexpected schema objects exist; refusing demo database operation.")
