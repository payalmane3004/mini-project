"""Safe identity checks for the explicitly isolated local demo database."""

from pathlib import Path

from sqlalchemy import Column, MetaData, String, Table, text


DEMO_DATABASE_PATH = Path(__file__).resolve().parent / "campussphere_demo.sqlite3"
DEMO_METADATA_TABLE = "campussphere_demo_metadata"
DEMO_MARKER_KEY = "dataset"
DEMO_MARKER_VALUE = "campussphere-local-demo-v1"

demo_metadata = MetaData()
demo_marker = Table(
    DEMO_METADATA_TABLE,
    demo_metadata,
    Column("key", String(80), primary_key=True),
    Column("value", String(100), nullable=False),
)


class DemoDatabaseError(ValueError):
    """Safe refusal message for invalid local demo database targets."""


def is_approved_demo_engine(engine) -> bool:
    """Return whether the effective engine targets the exact local demo file."""
    if engine is None or getattr(getattr(engine, "dialect", None), "name", None) != "sqlite":
        return False
    url = getattr(engine, "url", None)
    if url is None or getattr(url, "drivername", None) != "sqlite" or getattr(url, "query", None):
        return False
    database_path = getattr(url, "database", None)
    if not database_path or database_path == ":memory:":
        return False
    try:
        if DEMO_DATABASE_PATH.is_symlink():
            return False
        actual = Path(database_path).absolute()
        expected = DEMO_DATABASE_PATH.absolute()
    except (OSError, TypeError, ValueError):
        return False
    return actual == expected


def require_approved_demo_engine(engine):
    if not is_approved_demo_engine(engine):
        raise DemoDatabaseError("Refusing database access: the engine is not the approved local demo SQLite file.")
    return engine


def is_active_demo_engine(engine) -> bool:
    """Check the marker only after the effective engine is proven local."""
    if not is_approved_demo_engine(engine) or not DEMO_DATABASE_PATH.is_file():
        return False
    try:
        with engine.connect() as connection:
            value = connection.execute(
                text(f"SELECT value FROM {DEMO_METADATA_TABLE} WHERE key = :marker_key"),
                {"marker_key": DEMO_MARKER_KEY},
            ).scalar_one_or_none()
        return value == DEMO_MARKER_VALUE
    except Exception:
        return False
