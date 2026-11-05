"""Idempotently add illustrative maintenance entries to the approved local fixture only."""

import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import inspect
from sqlalchemy.engine import URL

from demo_mode import DEMO_DATABASE_PATH, is_active_demo_engine

os.environ["CAMPUSSPHERE_ENV"] = "development"
os.environ["PYTHON_DOTENV_DISABLED"] = "1"
os.environ["DATABASE_URL"] = URL.create("sqlite", database=str(DEMO_DATABASE_PATH.resolve())).render_as_string(hide_password=False)

import database
import models

ISSUES = (
    ("Ceiling fan is not working.", "HIGH", "IN_PROGRESS"),
    ("Projector is not displaying output.", "MEDIUM", "OPEN"),
    ("Tube lights are flickering.", "MEDIUM", "OPEN"),
    ("Air conditioner is not cooling.", "HIGH", "IN_PROGRESS"),
    ("Water leakage near washbasin.", "HIGH", "OPEN"),
    ("Electrical socket is damaged.", "CRITICAL", "OPEN"),
    ("Classroom door lock is jammed.", "MEDIUM", "OPEN"),
    ("Wi-Fi connectivity is unstable.", "LOW", "RESOLVED"),
    ("Laboratory computer is not starting.", "HIGH", "IN_PROGRESS"),
    ("Broken student desk.", "LOW", "OPEN"),
    ("Washroom flush is not working.", "MEDIUM", "OPEN"),
    ("Unusual noise from ceiling fan.", "MEDIUM", "RESOLVED"),
)
ASSIGNEES = ("Electrical Maintenance", "IT Support", "Facilities Team", "Plumbing Maintenance")


def main():
    engine = database.engine
    if not is_active_demo_engine(engine):
        raise RuntimeError("Refusing maintenance seed: active database is not the approved marked local SQLite fixture.")
    if "assignee_name" not in {column["name"] for column in inspect(engine).get_columns("maintenance_requests")}:
        raise RuntimeError("Local database schema is not ready; start the local backend once to apply its additive fixture update.")
    session = database.SessionLocal()
    try:
        rooms = session.query(models.Room).join(models.Building).order_by(models.Room.id).all()
        if len(rooms) != 40 or session.query(models.Building).count() != 10:
            raise RuntimeError("Expected the existing 40 rooms and 10 buildings in the approved fixture.")
        existing_rows = session.query(models.MaintenanceRequest).all()
        existing = {(row.room_id, row.title) for row in existing_rows}
        now = datetime.now(timezone.utc)
        inserted = 0
        for index, room in enumerate(rooms):
            title, priority, status = ISSUES[index % len(ISSUES)]
            legacy = next((row for row in existing_rows if row.room_id == room.id and (row.title or "").upper().startswith("DEMO FIXTURE REQUEST")), None)
            if legacy:
                legacy.title, legacy.description = title, title
                legacy.priority, legacy.status = priority, status
                legacy.assignee_name = ASSIGNEES[index % len(ASSIGNEES)]
                legacy.created_at = now - timedelta(days=(index % 28) + 1, hours=index % 8)
                legacy.resolved_at = legacy.created_at + timedelta(hours=5) if status == "RESOLVED" else None
                continue
            if (room.id, title) in existing:
                continue
            created = now - timedelta(days=(index % 28) + 1, hours=index % 8)
            session.add(models.MaintenanceRequest(
                room_id=room.id, reported_by=None, title=title,
                description=title, priority=priority, status=status,
                assignee_name=ASSIGNEES[index % len(ASSIGNEES)],
                created_at=created,
                resolved_at=created + timedelta(hours=5) if status == "RESOLVED" else None,
            ))
            inserted += 1
        session.commit()
        print(f"Inserted {inserted} illustrative local maintenance records; database now has {session.query(models.MaintenanceRequest).count()}.")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
        engine.dispose()


if __name__ == "__main__":
    main()
