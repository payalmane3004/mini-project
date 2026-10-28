"""Idempotently seed clearly fictional CampusSphere records in Neon demo DB."""

import argparse
import getpass
import os
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from demo_db_safety import (
    DemoSetupError,
    require_expected_tables,
    require_expected_schema_objects,
    require_project_confirmation,
    validate_target_url,
)


SEED_BUILDING_CODE = "DEMO-BLDG-01"
SEED_BUILDING_NAME = "DEMO CampusSphere Seed Building"
SEED_BUILDING_DESCRIPTION = "Fictional demo data only; not a real campus building."
SEED_ROOM_CODE = "DEMO-RM-101"
SEED_ROOM_NAME = "DEMO Room 101"
SEED_ADMIN_EMAIL = "admin@campussphere-demo.example.invalid"
SEED_ADMIN_NAME = "DEMO CampusSphere Admin"
SEED_STUDENT_EMAIL = "student@campussphere-demo.example.invalid"
SEED_STUDENT_NAME = "DEMO CampusSphere Student"
SEED_BOOKING_PURPOSE = "DEMO-SEED-V1: fictional student booking request"
SEED_NOTICE_TITLE = "DEMO ONLY [seed-v1]: fictional campus notice"
SEED_NOTICE_CONTENT = "DEMO ONLY: fictional notice for isolated CampusSphere testing."
SEED_ALERT_TITLE = "DEMO ONLY [seed-v1]: fictional low-severity alert"
SEED_ALERT_MESSAGE = "DEMO ONLY: fictional alert; this is not a real campus incident."
SEED_READING_SOURCE = "SIMULATED_DEMO_SEED_V1"
SEED_TABLES = {
    "users",
    "buildings",
    "rooms",
    "room_bookings",
    "notices",
    "emergency_alerts",
    "room_occupancy",
    "energy_readings",
}


def _parser():
    parser = argparse.ArgumentParser(
        description=(
            "Seed only clearly marked demo records into an initialized CampusSphere "
            "Neon demo schema. The seeder never creates or alters tables. Project "
            "and branch IDs are operator-supplied claims, not values independently "
            "verified by PostgreSQL."
        )
    )
    parser.add_argument("--expected-project-id", required=True)
    parser.add_argument("--expected-branch-id", required=True)
    parser.add_argument("--expected-host", required=True, help="Exact host shown for the new demo project")
    parser.add_argument("--expected-database", required=True, help="Exact database name shown for that project")
    parser.add_argument(
        "--confirm-demo-write",
        action="store_true",
        required=True,
        help="Confirm that demo records may be written to the verified isolated target",
    )
    parser.add_argument(
        "--confirm-neon-target-verified",
        action="store_true",
        required=True,
        help="Confirm these exact IDs, host, and database match Neon Console",
    )
    return parser


def _preflight_schema(engine, expected_database, required_tables, seed_tables):
    from sqlalchemy import text

    with engine.connect() as connection:
        connection.exec_driver_sql("SET TRANSACTION READ ONLY")
        identity = connection.execute(text("""
            SELECT current_database(), current_schema(),
                   EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'public'),
                   has_database_privilege(current_user, current_database(), 'CONNECT'),
                   has_schema_privilege(current_user, 'public', 'USAGE')
        """)).one()
        current_database, current_schema, public_exists, can_connect, can_use = identity
        if current_database != expected_database:
            raise DemoSetupError("Connected database identity does not match --expected-database.")
        if not public_exists or current_schema != "public":
            raise DemoSetupError("The active schema is not the expected public schema.")
        if not can_connect or not can_use:
            raise DemoSetupError("The database role lacks required schema access privileges.")

        unexpected_schemas = connection.execute(text("""
            SELECT nspname
            FROM pg_catalog.pg_namespace
            WHERE nspname NOT IN ('public', 'pg_catalog', 'information_schema')
              AND nspname NOT LIKE 'pg_toast%'
              AND nspname NOT LIKE 'pg_temp%'
            ORDER BY nspname
        """)).scalars().all()
        tables = connection.execute(text("""
            SELECT schemaname, tablename
            FROM pg_catalog.pg_tables
            WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
            ORDER BY schemaname, tablename
        """)).all()
        if any(schema != "public" for schema, _ in tables):
            raise DemoSetupError("User tables exist outside public; refusing to seed.")
        require_expected_tables(
            (table for schema, table in tables),
            required_tables,
        )
        unexpected_relations = connection.execute(text("""
            SELECT c.relname
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND (
                c.relkind NOT IN ('r','p','i','I','S')
                OR (c.relkind IN ('i','I') AND NOT EXISTS (
                    SELECT 1 FROM pg_catalog.pg_depend d
                    JOIN pg_catalog.pg_class parent ON parent.oid=d.refobjid
                    WHERE d.classid='pg_catalog.pg_class'::pg_catalog.regclass
                      AND d.objid=c.oid
                      AND d.refclassid='pg_catalog.pg_class'::pg_catalog.regclass
                      AND d.deptype IN ('i','a') AND parent.relname::text = ANY(CAST(:table_names AS text[]))
                ))
                OR (c.relkind='S' AND NOT EXISTS (
                    SELECT 1 FROM pg_catalog.pg_depend d
                    JOIN pg_catalog.pg_class parent ON parent.oid=d.refobjid
                    WHERE d.classid='pg_catalog.pg_class'::pg_catalog.regclass
                      AND d.objid=c.oid
                      AND d.refclassid='pg_catalog.pg_class'::pg_catalog.regclass
                      AND d.deptype='a' AND parent.relname::text = ANY(CAST(:table_names AS text[]))
                ))
            )
        """), {"table_names": sorted(required_tables)}).all()
        unexpected_types = connection.execute(text("""
            SELECT t.typname FROM pg_catalog.pg_type t
            JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
            WHERE n.nspname='public' AND t.typrelid=0 AND t.typelem=0
        """)).all()
        unexpected_routines = connection.execute(text("""
            SELECT p.proname FROM pg_catalog.pg_proc p
            JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
        """)).all()
        unexpected_misc_objects = []
        for query in (
            """SELECT o.oprname FROM pg_catalog.pg_operator o JOIN pg_catalog.pg_namespace n
               ON n.oid=o.oprnamespace WHERE n.nspname='public'""",
            """SELECT c.collname FROM pg_catalog.pg_collation c JOIN pg_catalog.pg_namespace n
               ON n.oid=c.collnamespace WHERE n.nspname='public'""",
            """SELECT c.conname FROM pg_catalog.pg_conversion c JOIN pg_catalog.pg_namespace n
               ON n.oid=c.connamespace WHERE n.nspname='public'""",
            """SELECT c.opcname FROM pg_catalog.pg_opclass c JOIN pg_catalog.pg_namespace n
               ON n.oid=c.opcnamespace WHERE n.nspname='public'""",
            """SELECT f.opfname FROM pg_catalog.pg_opfamily f JOIN pg_catalog.pg_namespace n
               ON n.oid=f.opfnamespace WHERE n.nspname='public'""",
        ):
            unexpected_misc_objects.extend(connection.execute(text(query)).all())
        unexpected_extensions = connection.execute(text("""
            SELECT e.extname FROM pg_catalog.pg_extension e
            JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace
            WHERE NOT (e.extname='plpgsql' AND n.nspname='pg_catalog')
        """)).all()
        require_expected_schema_objects(
            unexpected_schemas=unexpected_schemas,
            unexpected_objects=(unexpected_relations + unexpected_types + unexpected_routines
                                + unexpected_misc_objects + unexpected_extensions),
        )

        for table_name in seed_tables:
            privileges = connection.execute(text("""
                SELECT has_table_privilege(current_user, format('%I.%I', 'public', :table_name), 'SELECT'),
                       has_table_privilege(current_user, format('%I.%I', 'public', :table_name), 'INSERT'),
                       has_sequence_privilege(
                           current_user,
                           pg_get_serial_sequence(format('%I.%I', 'public', :table_name), 'id'),
                           'USAGE'
                       )
            """), {"table_name": table_name}).one()
            if not all(privileges):
                raise DemoSetupError("The database role lacks SELECT/INSERT/sequence privileges for demo seed tables.")


def _prompt_password(label, hash_password):
    while True:
        password = getpass.getpass(f"Set {label} password (minimum 12 characters): ")
        confirmation = getpass.getpass("Confirm password: ")
        if password != confirmation:
            print("Passwords did not match; try again.", file=sys.stderr)
            continue
        try:
            hashed = hash_password(password)
        except ValueError:
            print("Password does not meet the existing password policy; try again.", file=sys.stderr)
            continue
        password = ""
        confirmation = ""
        return hashed


def _one_or_none(query, description):
    rows = query.limit(2).all()
    if len(rows) > 1:
        raise DemoSetupError(f"Multiple records match the planned {description}; refusing to choose one.")
    return rows[0] if rows else None


def _ensure_user(session, model, func, *, email, full_name, role, hash_password):
    normalized_role = role.strip().upper()
    existing = _one_or_none(
        session.query(model).filter(func.lower(model.email) == email.lower()),
        f"demo user {email}",
    )
    if existing is not None:
        if existing.full_name != full_name or (existing.role or "").strip().upper() != normalized_role:
            raise DemoSetupError(f"A non-matching account uses the planned demo email {email}.")
        return existing

    password_hash = _prompt_password(normalized_role, hash_password)
    user = model(full_name=full_name, email=email, password_hash=password_hash, role=normalized_role)
    session.add(user)
    session.flush()
    return user


def _ensure_marked(session, model, filters, *, expected_fields, identity_fields, label):
    existing = _one_or_none(session.query(model).filter(*filters), label)
    if existing is not None:
        for field, expected in identity_fields.items():
            if getattr(existing, field) != expected:
                raise DemoSetupError(f"A conflicting non-demo record matches planned {label}; refusing to overwrite it.")
        return existing

    created = model(**expected_fields)
    session.add(created)
    session.flush()
    return created


def _seed(session, models, hash_password):
    from sqlalchemy import func

    admin = _ensure_user(
        session, models.User, func,
        email=SEED_ADMIN_EMAIL,
        full_name=SEED_ADMIN_NAME,
        role="ADMIN",
        hash_password=hash_password,
    )
    student = _ensure_user(
        session, models.User, func,
        email=SEED_STUDENT_EMAIL,
        full_name=SEED_STUDENT_NAME,
        role="STUDENT",
        hash_password=hash_password,
    )

    building = _ensure_marked(
        session,
        models.Building,
        [models.Building.building_code == SEED_BUILDING_CODE],
        expected_fields={
            "building_code": SEED_BUILDING_CODE,
            "name": SEED_BUILDING_NAME,
            "description": SEED_BUILDING_DESCRIPTION,
        },
        identity_fields={"building_code": SEED_BUILDING_CODE, "name": SEED_BUILDING_NAME},
        label="demo building",
    )
    room = _ensure_marked(
        session,
        models.Room,
        [models.Room.room_code == SEED_ROOM_CODE],
        expected_fields={
            "building_id": building.id,
            "room_code": SEED_ROOM_CODE,
            "room_name": SEED_ROOM_NAME,
            "floor_number": 1,
            "capacity": 24,
            "room_type": "Classroom",
        },
        identity_fields={
            "building_id": building.id,
            "room_code": SEED_ROOM_CODE,
            "room_name": SEED_ROOM_NAME,
        },
        label="demo room",
    )

    booking = _one_or_none(
        session.query(models.RoomBooking).filter(
            models.RoomBooking.room_id == room.id,
            models.RoomBooking.user_id == student.id,
            models.RoomBooking.purpose == SEED_BOOKING_PURPOSE,
        ),
        "demo booking",
    )
    if booking is None:
        start = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=2)
        booking = models.RoomBooking(
            room_id=room.id,
            user_id=student.id,
            purpose=SEED_BOOKING_PURPOSE,
            start_time=start,
            end_time=start + timedelta(hours=1),
            status="PENDING",
        )
        session.add(booking)

    _ensure_marked(
        session,
        models.Notice,
        [models.Notice.title == SEED_NOTICE_TITLE],
        expected_fields={
            "title": SEED_NOTICE_TITLE,
            "content": SEED_NOTICE_CONTENT,
            "created_by": admin.id,
            "published": True,
            "expires_at": None,
        },
        identity_fields={"title": SEED_NOTICE_TITLE, "created_by": admin.id},
        label="demo notice",
    )
    _ensure_marked(
        session,
        models.EmergencyAlert,
        [models.EmergencyAlert.title == SEED_ALERT_TITLE],
        expected_fields={
            "title": SEED_ALERT_TITLE,
            "message": SEED_ALERT_MESSAGE,
            "severity": "LOW",
            "active": True,
            "created_by": admin.id,
            "expires_at": None,
        },
        identity_fields={"title": SEED_ALERT_TITLE, "created_by": admin.id},
        label="demo alert",
    )
    _ensure_marked(
        session,
        models.RoomOccupancy,
        [
            models.RoomOccupancy.room_id == room.id,
            models.RoomOccupancy.source == SEED_READING_SOURCE,
        ],
        expected_fields={
            "room_id": room.id,
            "occupied_count": 5,
            "source": SEED_READING_SOURCE,
        },
        identity_fields={"room_id": room.id, "source": SEED_READING_SOURCE},
        label="demo occupancy reading",
    )
    _ensure_marked(
        session,
        models.EnergyReading,
        [
            models.EnergyReading.building_id == building.id,
            models.EnergyReading.reading_source == SEED_READING_SOURCE,
        ],
        expected_fields={
            "building_id": building.id,
            "energy_kwh": Decimal("123.450"),
            "reading_source": SEED_READING_SOURCE,
        },
        identity_fields={"building_id": building.id, "reading_source": SEED_READING_SOURCE},
        label="demo energy reading",
    )


def main(argv=None):
    args = _parser().parse_args(argv)
    engine = None
    try:
        require_project_confirmation(args)

        url = validate_target_url(
            os.environ.get("DATABASE_URL"), args.expected_host, args.expected_database
        )
        print(
            f"Target claim: project {args.expected_project_id}; branch {args.expected_branch_id}; "
            f"host {url.host}; database {url.database}. Project/branch IDs are operator-supplied "
            "claims, not independently verified by PostgreSQL."
        )

        import database
        import models
        from security import hash_password

        engine = database.engine
        validate_target_url(engine.url, args.expected_host, args.expected_database)
        required_tables = set(database.Base.metadata.tables)
        if not SEED_TABLES.issubset(required_tables):
            raise DemoSetupError("The registered ORM models do not include the expected demo workflow tables.")
        _preflight_schema(engine, args.expected_database, required_tables, SEED_TABLES)

        session = database.SessionLocal()
        try:
            with session.begin():
                _seed(session, models, hash_password)
        finally:
            session.close()

        print(f"Demo records are ready on {url.host}/{url.database}; existing matching demo records were preserved.")
        return 0
    except DemoSetupError as error:
        print(f"Refused: {error}", file=sys.stderr)
        return 2
    except Exception:
        # Driver and SQLAlchemy exceptions can include a rendered connection URL.
        print("Seeding failed; database error details were suppressed and the transaction was rolled back.", file=sys.stderr)
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
