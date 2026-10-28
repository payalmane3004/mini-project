"""Initialize model tables in a verified, fresh Neon demo database.

The preflight and create_all are separate operations. A session advisory lock
serializes instances of this initializer that use the same lock key. Other
clients can still change the schema unless they follow the same protocol.
PostgreSQL-owned namespaces (pg_catalog, information_schema, pg_toast*, and
pg_temp*) and the built-in plpgsql extension are allowed. Only public may be
an application schema, and it must have no user-created objects.
"""

import argparse
import os
import sys

from demo_db_safety import (
    DemoSetupError,
    require_expected_schema_objects,
    require_project_confirmation,
    validate_target_url,
)


def _parser():
    parser = argparse.ArgumentParser(
        description=(
            "Create current SQLAlchemy model tables in a verified fresh demo database. "
            "This does not migrate schemas. Project and branch IDs are operator-supplied "
            "claims and are not independently verified by PostgreSQL."
        )
    )
    parser.add_argument("--expected-project-id", required=True)
    parser.add_argument("--expected-branch-id", required=True)
    parser.add_argument("--expected-host", required=True)
    parser.add_argument("--expected-database", required=True)
    parser.add_argument(
        "--confirm-neon-target-verified", action="store_true", required=True,
        help="Confirm these exact IDs, host, and database match Neon Console",
    )
    parser.add_argument(
        "--confirm-demo-write", action="store_true", required=True,
        help="Confirm table creation is authorized in the verified target",
    )
    return parser


def _unexpected_schema_names(connection):
    from sqlalchemy import text

    return connection.execute(text("""
        SELECT nspname
        FROM pg_catalog.pg_namespace
        WHERE nspname NOT IN ('public', 'pg_catalog', 'information_schema')
          AND nspname NOT LIKE 'pg_toast%'
          AND nspname NOT LIKE 'pg_temp%'
        ORDER BY nspname
    """)).scalars().all()


def _public_objects(connection):
    from sqlalchemy import text

    queries = (
        """SELECT 'relation', c.relname, c.relkind::text
           FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public'""",
        """SELECT 'type', t.typname, t.typtype::text FROM pg_catalog.pg_type t
           JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
           WHERE n.nspname='public' AND t.typrelid=0 AND t.typelem=0""",
        """SELECT 'routine', p.proname, p.prokind::text FROM pg_catalog.pg_proc p
           JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'""",
        """SELECT 'operator', o.oprname, '' FROM pg_catalog.pg_operator o
           JOIN pg_catalog.pg_namespace n ON n.oid=o.oprnamespace WHERE n.nspname='public'""",
        """SELECT 'collation', c.collname, '' FROM pg_catalog.pg_collation c
           JOIN pg_catalog.pg_namespace n ON n.oid=c.collnamespace WHERE n.nspname='public'""",
        """SELECT 'conversion', c.conname, '' FROM pg_catalog.pg_conversion c
           JOIN pg_catalog.pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'""",
        """SELECT 'operator class', c.opcname, '' FROM pg_catalog.pg_opclass c
           JOIN pg_catalog.pg_namespace n ON n.oid=c.opcnamespace WHERE n.nspname='public'""",
        """SELECT 'operator family', f.opfname, '' FROM pg_catalog.pg_opfamily f
           JOIN pg_catalog.pg_namespace n ON n.oid=f.opfnamespace WHERE n.nspname='public'""",
        """SELECT 'extension', e.extname, n.nspname FROM pg_catalog.pg_extension e
           JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace
           WHERE NOT (e.extname='plpgsql' AND n.nspname='pg_catalog')""",
    )
    return [row for query in queries for row in connection.execute(text(query)).all()]


def _preflight(connection, expected_database):
    from sqlalchemy import text

    with connection.begin():
        # Must be the first SQL command in this transaction.
        connection.exec_driver_sql("SET TRANSACTION READ ONLY")
        identity = connection.execute(text("""
            SELECT current_database(), current_schema(),
                   EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='public'),
                   has_database_privilege(current_user,current_database(),'CONNECT'),
                   has_schema_privilege(current_user,'public','USAGE'),
                   has_schema_privilege(current_user,'public','CREATE')
        """)).one()
        db_name, schema_name, public_exists, can_connect, can_use, can_create = identity
        if db_name != expected_database:
            raise DemoSetupError("Connected database identity does not match --expected-database.")
        if not public_exists or schema_name != "public":
            raise DemoSetupError("The active schema is not the expected public schema.")
        if not can_connect or not can_use or not can_create:
            raise DemoSetupError("The database role lacks CONNECT or public schema USAGE/CREATE privileges.")
        require_expected_schema_objects(
            unexpected_schemas=_unexpected_schema_names(connection),
            unexpected_objects=_public_objects(connection),
        )


def _acquire_initializer_lock(connection):
    from sqlalchemy import text

    acquired = connection.execute(text("SELECT pg_try_advisory_lock(741205, 11011)")).scalar_one()
    connection.commit()  # Session-level advisory locks survive transaction commit.
    if not acquired:
        raise DemoSetupError("Another cooperating initializer holds the schema lock; refusing to continue.")


def _release_initializer_lock(connection):
    from sqlalchemy import text

    # Clear a failed DDL transaction if necessary; successful DDL is committed
    # explicitly by main before entering this helper.
    connection.rollback()
    connection.execute(text("SELECT pg_advisory_unlock(741205, 11011)"))
    connection.commit()


def main(argv=None):
    args = _parser().parse_args(argv)
    engine = None
    try:
        require_project_confirmation(args)
        # Require the explicit process URL before database.py can construct an engine.
        url = validate_target_url(os.environ.get("DATABASE_URL"), args.expected_host, args.expected_database)
        print(
            f"Target claim: project {args.expected_project_id}; branch {args.expected_branch_id}; "
            f"host {url.host}; database {url.database}. Project/branch IDs are operator-supplied "
            "claims, not independently verified by PostgreSQL."
        )

        import database
        import models  # Register all existing mapped tables on Base.metadata.

        engine = database.engine
        validate_target_url(engine.url, args.expected_host, args.expected_database)
        with engine.connect() as connection:
            _acquire_initializer_lock(connection)
            try:
                # Recheck after lock acquisition. Unrelated clients that ignore this
                # protocol can still race between this read-only check and DDL.
                _preflight(connection, args.expected_database)
                database.Base.metadata.create_all(bind=connection, checkfirst=True)
                connection.commit()
            finally:
                _release_initializer_lock(connection)
        print(f"Initialized CampusSphere model tables on {url.host}/{url.database}.")
        return 0
    except DemoSetupError as error:
        print(f"Refused: {error}", file=sys.stderr)
        return 2
    except Exception:
        print("Initialization failed; database error details were suppressed.", file=sys.stderr)
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
