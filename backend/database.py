
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import sessionmaker, declarative_base
from demo_mode import DEMO_DATABASE_PATH, DemoDatabaseError, is_active_demo_engine

BACKEND_DIR = Path(__file__).resolve().parent
DATABASE_ENVIRONMENT = os.environ.get("CAMPUSSPHERE_ENV", "development").strip().lower()
process_database_url = os.environ.get("DATABASE_URL")
USES_APPROVED_DEMO_FIXTURE = False

if DATABASE_ENVIRONMENT == "production":
    # Production keeps the previous env/.env configuration path. The explicit
    # mode prevents a local uvicorn command from silently selecting shared DBs.
    load_dotenv(dotenv_path=BACKEND_DIR / ".env", override=False)
    DATABASE_URL = os.environ.get("DATABASE_URL")
elif DATABASE_ENVIRONMENT == "test":
    DATABASE_URL = process_database_url or "sqlite:///:memory:"
elif DATABASE_ENVIRONMENT == "development":
    if process_database_url:
        try:
            configured_url = make_url(process_database_url)
        except Exception:
            raise ValueError("DATABASE_URL is invalid; local development requires the approved SQLite fixture.") from None
        if configured_url.get_backend_name() != "sqlite":
            raise ValueError(
                "A non-SQLite DATABASE_URL requires CAMPUSSPHERE_ENV=production; "
                "local development uses the approved SQLite fixture."
            )
        configured_path = configured_url.database
        if configured_path not in {None, "", ":memory:"}:
            actual_path = Path(configured_path).resolve()
            if actual_path != DEMO_DATABASE_PATH.resolve():
                raise ValueError("Local development DATABASE_URL must target the approved SQLite fixture.")
            USES_APPROVED_DEMO_FIXTURE = True
        DATABASE_URL = process_database_url
    else:
        DATABASE_URL = URL.create("sqlite", database=str(DEMO_DATABASE_PATH.resolve())).render_as_string(
            hide_password=False
        )
        USES_APPROVED_DEMO_FIXTURE = True
else:
    raise ValueError("CAMPUSSPHERE_ENV must be development, test, or production.")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is required when CAMPUSSPHERE_ENV=production.")

if DATABASE_ENVIRONMENT == "development" and USES_APPROVED_DEMO_FIXTURE:
    if DEMO_DATABASE_PATH.is_symlink() or not DEMO_DATABASE_PATH.is_file():
        raise DemoDatabaseError("The approved local demo SQLite fixture is missing or unsafe; refusing to start.")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True
)

if DATABASE_ENVIRONMENT == "development" and USES_APPROVED_DEMO_FIXTURE and not is_active_demo_engine(engine):
    engine.dispose()
    raise DemoDatabaseError("Local development requires the marked approved demo SQLite fixture; refusing to start.")

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def test_connection():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        print("Database connection successful:", result.scalar())


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
