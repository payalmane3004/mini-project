"""Compatibility entry point for the complete CampusSphere demo dataset.

The implementation lives in seed_campussphere_dashboard_demo.py. Default is
read-only; inserts require --apply, verified Neon target arguments, and
--confirm-demo-write.
"""
import argparse
import re
import sys
from pathlib import Path


def _safe_database_diagnostic(error):
    """Return a useful class/diagnostic without rendering URLs or hostnames."""
    name = type(error).__name__
    original = getattr(error, "orig", error)
    detail = str(original).lower()
    code = getattr(original, "sqlstate", None) or getattr(original, "pgcode", None)
    if "10013" in detail or "permission denied" in detail:
        message = "network connection denied by the operating system (Windows socket error 10013)"
    elif "name or service not known" in detail or "getaddrinfo failed" in detail:
        message = "database hostname could not be resolved (DNS failure)"
    elif "timed out" in detail or "timeout expired" in detail:
        message = "database connection timed out"
    elif "connection refused" in detail:
        message = "database host refused the connection"
    elif "certificate" in detail or "ssl" in detail or "tls" in detail:
        message = "database TLS negotiation failed"
    elif name in {"OperationalError", "InterfaceError"}:
        message = "database connection failed; check network access and database availability"
    elif name in {"ProgrammingError", "UndefinedTable", "InsufficientPrivilege"}:
        message = "database query failed; check schema and read permissions"
    else:
        message = "database preflight failed; inspect the configured schema and permissions"
    if code:
        return f"{name} (SQLSTATE {code}): {message}"
    return f"{name}: {message}"


def _load_application_modules():
    """Make `python backend/seed_campussphere_demo.py` work from repo root."""
    backend_dir = str(Path(__file__).resolve().parent)
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    try:
        import database
        import models
    except Exception as error:
        if isinstance(error, ValueError) and "DATABASE_URL is missing" in str(error):
            raise RuntimeError("Missing environment configuration: set DATABASE_URL in the process environment or backend/.env") from None
        raise RuntimeError(f"Could not load application database/models ({type(error).__name__}); check backend dependencies and configuration") from None
    return database, models


def _demo_plan(session, models, limit=3):
    buildings = session.query(models.Building).order_by(models.Building.id).all()
    eligible = [building for building in buildings if (
        building.id is not None
        and isinstance(building.building_code, str) and building.building_code.strip()
        and isinstance(building.name, str) and building.name.strip()
    )]
    planned = []
    for building in eligible:
        code = f"DEMO-{building.building_code}-ROOM-101"
        if len(code) > 30:
            code = f"DEMO-{building.id}-ROOM-101"
        if len(code) > 30:
            continue
        if session.query(models.Room).filter(models.Room.room_code == code).first() is None:
            planned.append((building, code))
        if len(planned) >= limit:
            break
    return eligible, planned


def _apply_plan(session, models, planned):
    inserted = 0
    try:
        with session.begin():
            for building, code in planned:
                if session.query(models.Room.id).filter(models.Room.room_code == code).first():
                    continue
                session.add(models.Room(
                    building_id=building.id,
                    room_code=code,
                    room_name="DEMO room for authorized testing",
                    floor_number=0,
                    capacity=0,
                    room_type="DEMO",
                ))
                inserted += 1
        return inserted
    except Exception:
        session.rollback()
        raise


def main(argv=None):
    from seed_campussphere_dashboard_demo import main as comprehensive_main
    return comprehensive_main(argv)


if __name__ == "__main__":
    raise SystemExit(main())
