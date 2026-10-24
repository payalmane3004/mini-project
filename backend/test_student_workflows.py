"""Booking workflow tests with isolated sessions; no database connection is used."""

import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import main
import models
from schemas import BookingCreateRequest, BookingStatusUpdateRequest, EmergencyAlertCreateRequest, NoticeCreateRequest, NoticeUpdateRequest


class FakeQuery:
    def __init__(self, session, entities):
        self.session = session
        self.entities = entities
        self.filters = []

    def filter(self, *expressions):
        self.filters.extend(expressions)
        return self

    def join(self, *args, **kwargs):
        return self

    def outerjoin(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def first(self):
        if len(self.entities) == 1 and self.entities[0] is models.Notice:
            return self.session.notice
        if len(self.entities) == 1 and self.entities[0] is models.Room:
            return self.session.room
        if len(self.entities) == 1 and self.entities[0] is models.RoomBooking.id:
            return SimpleNamespace(id=1) if self.session.conflict else None
        if len(self.entities) == 1 and self.entities[0] is models.RoomBooking:
            return self.session.booking
        if len(self.entities) == 1 and self.entities[0] is models.Building:
            return self.session.building
        return None

    def all(self):
        if len(self.entities) == 1 and self.entities[0] is models.Notice:
            return self.session.notices
        return []


class FakeSession:
    def __init__(self, *, conflict=False, commit_error=None, booking=None, notice=None, notices=None, booking_status_after_refresh=None):
        self.room = SimpleNamespace(id=7, room_code="verified-room", building_id=3)
        self.building = SimpleNamespace(id=3, building_code="BLDG", name="Campus building")
        self.conflict = conflict
        self.commit_error = commit_error
        self.booking = booking
        self.booking_status_after_refresh = booking_status_after_refresh
        self.notice = notice
        self.notices = notices or []
        self.queries = []
        self.statements = []
        self.added = []
        self.commits = 0
        self.rollbacks = 0
        self.dialect = SimpleNamespace(name="sqlite")

    def query(self, *entities):
        query = FakeQuery(self, entities)
        self.queries.append(query)
        return query

    def get_bind(self):
        return SimpleNamespace(dialect=self.dialect)

    def add(self, item):
        self.added.append(item)

    def commit(self):
        if self.commit_error:
            raise self.commit_error
        self.commits += 1

    def refresh(self, item):
        if getattr(item, "id", None) is None:
            item.id = 51
        if getattr(item, "created_at", None) is None:
            item.created_at = datetime.now(timezone.utc)
        if item is self.booking and self.booking_status_after_refresh is not None:
            item.status = self.booking_status_after_refresh

    def execute(self, statement, parameters=None):
        self.statements.append((str(statement), parameters))

    def rollback(self):
        self.rollbacks += 1

    def delete(self, item):
        self.notices.remove(item)


def valid_payload():
    start = datetime.now(timezone.utc) + timedelta(days=1)
    return BookingCreateRequest(
        room_id=7,
        purpose="Study group",
        start_time=start,
        end_time=start + timedelta(hours=1),
    )


class StudentBookingWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.student = SimpleNamespace(id=12, role="STUDENT")

    def test_rejects_naive_or_reversed_booking_times(self):
        start = datetime.now(timezone.utc) + timedelta(days=1)
        with self.assertRaises(ValidationError):
            BookingCreateRequest(room_id=7, purpose="Test", start_time=start.replace(tzinfo=None), end_time=start + timedelta(hours=1))
        with self.assertRaises(ValidationError):
            BookingCreateRequest(room_id=7, purpose="Test", start_time=start + timedelta(hours=1), end_time=start)

    def test_booking_review_accepts_only_database_compatible_review_statuses(self):
        self.assertEqual(BookingStatusUpdateRequest(status="APPROVED").status, "APPROVED")
        self.assertEqual(BookingStatusUpdateRequest(status="REJECTED").status, "REJECTED")
        for status in ("CONFIRMED", "PENDING", "CANCELLED"):
            with self.subTest(status=status), self.assertRaises(ValidationError):
                BookingStatusUpdateRequest(status=status)

    def test_creates_pending_booking_for_authenticated_student(self):
        db = FakeSession()
        result = main.create_booking(valid_payload(), self.student, db)
        self.assertEqual(result["status"], "PENDING")
        self.assertEqual(result["user_id"], self.student.id)
        self.assertEqual(result["room_code"], "verified-room")
        self.assertEqual(result["source"], "DATABASE")
        self.assertEqual(db.commits, 1)

    def test_postgres_booking_path_locks_room_before_conflict_check(self):
        db = FakeSession()
        db.dialect.name = "postgresql"
        main.create_booking(valid_payload(), self.student, db)
        self.assertEqual(len(db.statements), 1)
        self.assertIn("pg_advisory_xact_lock", db.statements[0][0])
        self.assertEqual(db.statements[0][1], {"room_id": 7})

    def test_rejects_nonexistent_room(self):
        db = FakeSession()
        db.room = None
        with self.assertRaises(HTTPException) as raised:
            main.create_booking(valid_payload(), self.student, db)
        self.assertEqual(raised.exception.status_code, 404)
        self.assertEqual(db.commits, 0)

    def test_rejects_overlapping_booking(self):
        db = FakeSession(conflict=True)
        with self.assertRaises(HTTPException) as raised:
            main.create_booking(valid_payload(), self.student, db)
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(db.rollbacks, 1)
        self.assertEqual(db.added, [])
        active_status_filter = next(
            expression for query in db.queries for expression in query.filters
            if isinstance(getattr(getattr(expression, "right", None), "value", None), (tuple, list))
            and set(expression.right.value) == {"PENDING", "APPROVED"}
        )
        self.assertEqual(set(active_status_filter.right.value), {"PENDING", "APPROVED"})

    def test_integrity_error_rolls_back_booking(self):
        db = FakeSession(commit_error=IntegrityError("insert", {}, Exception("constraint")))
        with self.assertRaises(HTTPException) as raised:
            main.create_booking(valid_payload(), self.student, db)
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(db.rollbacks, 1)

    def test_cancellation_rejects_another_students_booking(self):
        db = FakeSession(booking=SimpleNamespace(id=5, user_id=13, status="PENDING"))
        with self.assertRaises(HTTPException) as raised:
            main.cancel_booking(5, self.student, db)
        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(db.commits, 0)

    def test_cancellation_updates_only_own_active_booking(self):
        booking = SimpleNamespace(id=5, user_id=12, room_id=7, status="PENDING")
        db = FakeSession(booking=booking)
        response = main.cancel_booking(5, self.student, db)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(booking.status, "CANCELLED")
        self.assertEqual(db.commits, 1)

    def test_cancellation_allows_approved_booking(self):
        booking = SimpleNamespace(id=5, user_id=12, room_id=7, status="APPROVED")
        db = FakeSession(booking=booking)
        response = main.cancel_booking(5, self.student, db)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(booking.status, "CANCELLED")
        self.assertEqual(db.commits, 1)

    def test_cancellation_uses_same_postgres_room_lock(self):
        booking = SimpleNamespace(id=5, user_id=12, room_id=7, status="PENDING")
        db = FakeSession(booking=booking)
        db.dialect.name = "postgresql"
        main.cancel_booking(5, self.student, db)
        self.assertEqual(len(db.statements), 1)
        self.assertIn("pg_advisory_xact_lock", db.statements[0][0])

    def test_admin_review_rechecks_status_after_acquiring_room_lock(self):
        booking = SimpleNamespace(id=8, user_id=12, room_id=7, status="PENDING", start_time=valid_payload().start_time, end_time=valid_payload().end_time, purpose="Study group", created_at=datetime.now(timezone.utc))
        db = FakeSession(booking=booking, booking_status_after_refresh="CANCELLED")
        with self.assertRaises(HTTPException) as raised:
            main.update_booking_status(8, BookingStatusUpdateRequest(status="APPROVED"), db)
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(db.commits, 0)
        self.assertEqual(db.rollbacks, 1)

    def test_admin_can_approve_pending_booking(self):
        booking = SimpleNamespace(id=8, user_id=12, room_id=7, status="PENDING", start_time=valid_payload().start_time, end_time=valid_payload().end_time, purpose="Study group", created_at=datetime.now(timezone.utc))
        db = FakeSession(booking=booking)
        result = main.update_booking_status(8, BookingStatusUpdateRequest(status="APPROVED"), db)
        self.assertEqual(result["status"], "APPROVED")
        self.assertEqual(db.commits, 1)

    def test_admin_cannot_approve_overlapping_booking(self):
        booking = SimpleNamespace(id=8, user_id=12, room_id=7, status="PENDING", start_time=valid_payload().start_time, end_time=valid_payload().end_time, purpose="Study group", created_at=datetime.now(timezone.utc))
        db = FakeSession(booking=booking, conflict=True)
        with self.assertRaises(HTTPException) as raised:
            main.update_booking_status(8, BookingStatusUpdateRequest(status="APPROVED"), db)
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(db.rollbacks, 1)

    def test_student_booking_list_is_filtered_to_authenticated_user(self):
        db = FakeSession()
        self.assertEqual(main.get_bookings(self.student, db), [])
        ownership_filter = next(
            expression for expression in db.queries[0].filters
            if getattr(getattr(expression, "left", None), "key", None) == "user_id"
        )
        self.assertEqual(ownership_filter.right.value, self.student.id)

    def test_notice_and_alert_expiry_require_timezone_and_future_date(self):
        with self.assertRaises(ValidationError):
            NoticeCreateRequest(title="Notice", content="Message", expires_at=datetime.now() + timedelta(days=1))
        with self.assertRaises(ValidationError):
            EmergencyAlertCreateRequest(title="Alert", message="Message", expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))
        with self.assertRaises(ValidationError):
            EmergencyAlertCreateRequest(title="Alert", message="Message", severity="SEVERE")


class NoticeManagementTests(unittest.TestCase):
    def test_notice_update_requires_fields_and_rejects_blank_content(self):
        with self.assertRaises(ValidationError):
            NoticeUpdateRequest()
        with self.assertRaises(ValidationError):
            NoticeUpdateRequest(title="  ")
        with self.assertRaises(ValidationError):
            NoticeUpdateRequest(published=None)

    def test_expired_notice_must_be_extended_or_cleared_before_republishing(self):
        notice = SimpleNamespace(id=4, title="Expired", content="Body", published=False, expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))
        db = FakeSession(notice=notice)
        with self.assertRaises(HTTPException) as raised:
            main.update_notice(4, NoticeUpdateRequest(published=True), db)
        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(db.commits, 0)

    def test_admin_notice_list_includes_drafts_and_published(self):
        drafts = [SimpleNamespace(id=1, published=False), SimpleNamespace(id=2, published=True)]
        db = FakeSession(notices=drafts)
        self.assertEqual(main.get_admin_notices(db), drafts)

    def test_student_notice_feed_filters_to_published_and_unexpired(self):
        engine = create_engine("sqlite:///:memory:")
        models.User.__table__.create(engine)
        models.Notice.__table__.create(engine)
        now = datetime.now(timezone.utc)
        with Session(engine) as db:
            db.add_all([
                models.Notice(id=1, title="Published", content="Visible", published=True),
                models.Notice(id=2, title="Draft", content="Hidden", published=False),
                models.Notice(id=3, title="Expired", content="Hidden", published=True, expires_at=now - timedelta(minutes=1)),
                models.Notice(id=4, title="Current", content="Visible", published=True, expires_at=now + timedelta(days=1)),
            ])
            db.commit()
            rows = main.get_published_notices(db)
            self.assertEqual({row.title for row in rows}, {"Published", "Current"})
        engine.dispose()

    def test_student_alert_feed_filters_to_active_and_unexpired(self):
        engine = create_engine("sqlite:///:memory:")
        models.User.__table__.create(engine)
        models.EmergencyAlert.__table__.create(engine)
        now = datetime.now(timezone.utc)
        with Session(engine) as db:
            db.add_all([
                models.EmergencyAlert(id=1, title="Active", message="Visible", severity="LOW", active=True),
                models.EmergencyAlert(id=2, title="Inactive", message="Hidden", severity="LOW", active=False),
                models.EmergencyAlert(id=3, title="Expired", message="Hidden", severity="LOW", active=True, expires_at=now - timedelta(minutes=1)),
                models.EmergencyAlert(id=4, title="Current", message="Visible", severity="LOW", active=True, expires_at=now + timedelta(days=1)),
            ])
            db.commit()
            rows = main.get_published_emergency_alerts(db)
            self.assertEqual({row.title for row in rows}, {"Active", "Current"})
        engine.dispose()

    def test_admin_can_create_draft_notice(self):
        db = FakeSession()
        admin = SimpleNamespace(id=11)
        notice = main.create_notice(NoticeCreateRequest(title="Draft", content="Message", published=False), admin, db)
        self.assertFalse(notice.published)
        self.assertEqual(db.commits, 1)

    def test_admin_can_update_notice_and_integrity_failure_rolls_back(self):
        notice = SimpleNamespace(id=4, title="Old", content="Body", published=False, expires_at=None)
        db = FakeSession(notice=notice)
        result = main.update_notice(4, NoticeUpdateRequest(title="Updated", published=True), db)
        self.assertEqual(result.title, "Updated")
        self.assertTrue(result.published)
        self.assertEqual(db.commits, 1)

        failing = FakeSession(notice=SimpleNamespace(id=4, title="Old", content="Body", published=False, expires_at=None), commit_error=IntegrityError("update", {}, Exception("constraint")))
        with self.assertRaises(HTTPException) as raised:
            main.update_notice(4, NoticeUpdateRequest(published=True), failing)
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(failing.rollbacks, 1)

    def test_published_notice_must_be_unpublished_before_delete(self):
        published = SimpleNamespace(id=5, published=True)
        db = FakeSession(notice=published)
        with self.assertRaises(HTTPException) as raised:
            main.delete_draft_notice(5, db)
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(db.commits, 0)


if __name__ == "__main__":
    unittest.main()
