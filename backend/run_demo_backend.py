"""Run the backend only against the dedicated populated local demo SQLite DB."""

import importlib
import os
import secrets

from sqlalchemy.engine import URL

from demo_mode import DEMO_DATABASE_PATH, DemoDatabaseError, is_active_demo_engine, require_approved_demo_engine
from generate_demo_data import enable_sqlite_foreign_keys


DEMO_PORT_ENV = "CAMPUSSPHERE_DEMO_PORT"
DEFAULT_DEMO_PORT = 8000


def get_demo_port():
    """Read and validate the isolated demo server's TCP port."""
    raw_port = os.environ.get(DEMO_PORT_ENV)
    if raw_port is None:
        return DEFAULT_DEMO_PORT
    try:
        port = int(raw_port)
    except (TypeError, ValueError):
        raise ValueError(f"{DEMO_PORT_ENV} must be an integer TCP port from 1 to 65535.") from None
    if not 1 <= port <= 65535:
        raise ValueError(f"{DEMO_PORT_ENV} must be an integer TCP port from 1 to 65535.")
    return port


def main():
    port = get_demo_port()
    os.environ["PYTHON_DOTENV_DISABLED"] = "1"
    os.environ["DATABASE_URL"] = URL.create(
        "sqlite", database=str(DEMO_DATABASE_PATH.absolute())
    ).render_as_string(hide_password=False)
    os.environ["JWT_SECRET_KEY"] = secrets.token_urlsafe(32)

    database = importlib.import_module("database")
    engine = require_approved_demo_engine(database.engine)
    enable_sqlite_foreign_keys(engine)
    if not is_active_demo_engine(engine):
        raise DemoDatabaseError(
            "The local demo database is missing or has no completed fixture marker; run the demo generator first."
        )

    application = importlib.import_module("main").app
    import uvicorn

    uvicorn.run(application, host="127.0.0.1", port=port)


if __name__ == "__main__":
    main()
