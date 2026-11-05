"""Run CampusSphere against the configured Neon PostgreSQL database."""

import importlib
import os


PORT_ENV = "PORT"
DEFAULT_PORT = 8001


def get_port():
    raw_port = os.environ.get(PORT_ENV)
    if raw_port is None:
        return DEFAULT_PORT
    try:
        port = int(raw_port)
    except (TypeError, ValueError):
        raise ValueError(f"{PORT_ENV} must be an integer TCP port from 1 to 65535.") from None
    if not 1 <= port <= 65535:
        raise ValueError(f"{PORT_ENV} must be an integer TCP port from 1 to 65535.")
    return port


def main():
    # Force the production configuration path. Render supplies the database
    # and signing key as process variables; local runs can load backend/.env.
    os.environ["CAMPUSSPHERE_ENV"] = "production"

    database = importlib.import_module("database")
    if database.engine.dialect.name != "postgresql":
        raise RuntimeError("The Neon backend requires a PostgreSQL database configuration.")

    application = importlib.import_module("main").app
    import uvicorn

    uvicorn.run(application, host="0.0.0.0", port=get_port())


if __name__ == "__main__":
    main()
