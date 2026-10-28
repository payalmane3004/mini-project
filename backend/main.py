
from datetime import datetime, timedelta, timezone
import hashlib
import ipaddress
import secrets

from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, HTTPException, Query, Request, Response
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from database import DATABASE_ENVIRONMENT, USES_APPROVED_DEMO_FIXTURE, engine, get_db
from demo_mode import is_active_demo_engine, require_approved_demo_engine
import models
from schemas import (
    AnalyticsSummaryResponse,
    AuthUserResponse,
    BuildingResponse,
    BookingCreateRequest,
    BookingResponse,
    BookingStatusUpdateRequest,
    EmergencyAlertCreateRequest,
    EmergencyAlertResponse,
    EnergyReadingsResponse,
    LoginRequest,
    LoginResponse,
    ForgotPasswordRequest,
    DemoResetLinkResponse,
    PasswordResetRequest,
    MaintenanceRequestCreateRequest,
    MaintenanceRequestResponse,
    MaintenanceRequestStatusUpdateRequest,
    NoticeCreateRequest,
    NoticeResponse,
    NoticeUpdateRequest,
    OccupancyDashboardResponse,
    RoomCreateRequest,
    RoomResponse,
)
from security import create_access_token, get_current_user, require_roles, verify_password
from security import hash_password


DEMO_RESET_ACCOUNTS = {
    "admin@campussphere-demo.example.invalid": "admin",
    "student@campussphere-demo.example.invalid": "student",
}
DEMO_RESET_LIFETIME = timedelta(minutes=15)
DEMO_RESET_MESSAGE = "If this is a documented local demo account, a reset link is available in this demo session."


def _require_demo_password_reset(request: Request | None = None):
    if (
        DATABASE_ENVIRONMENT != "development"
        or not USES_APPROVED_DEMO_FIXTURE
        or not is_active_demo_engine(engine)
    ):
        raise HTTPException(status_code=404, detail="Password reset is unavailable.")
    try:
        require_approved_demo_engine(engine)
    except Exception:
        raise HTTPException(status_code=404, detail="Password reset is unavailable.") from None
    if request is not None:
        try:
            client_ip = ipaddress.ip_address(request.client.host)
        except (ValueError, AttributeError):
            raise HTTPException(status_code=404, detail="Password reset is unavailable.") from None
        if not client_ip.is_loopback:
            raise HTTPException(status_code=404, detail="Password reset is unavailable.")


def _ensure_reset_token_table():
    # Schema changes are limited to the proven marked demo fixture.
    models.PasswordResetToken.__table__.create(bind=engine, checkfirst=True)


def _find_documented_demo_user(db, email):
    normalized = email.strip().lower()
    expected_role = DEMO_RESET_ACCOUNTS.get(normalized)
    if expected_role is None:
        return None
    user = db.query(models.User).filter(func.lower(models.User.email) == normalized).first()
    if user is None or (user.role or "").strip().lower() != expected_role:
        return None
    return user

app = FastAPI(title="CampusSphere API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Home endpoint
@app.get("/")
def home():
    return {
        "message": "CampusSphere Backend is running!"
    }


# Check database connection
@app.get("/health")
def health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "healthy",
            "database": "connected",
            "environment": DATABASE_ENVIRONMENT,
            "demo_mode": is_active_demo_engine(engine),
        }

    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed"
        )


@app.get("/demo/status")
def demo_status():
    """Report demo mode only for the marked, dedicated local SQLite fixture."""
    return {"demo_mode": is_active_demo_engine(engine)}


def _is_demo_room(room):
    return bool(getattr(room, "is_demo", False)) or (
        isinstance(getattr(room, "room_code", None), str)
        and room.room_code.upper().startswith("DEMO-")
    )


def _is_demo_building(building):
    return bool(getattr(building, "is_demo", False)) or (
        isinstance(getattr(building, "building_code", None), str)
        and building.building_code.upper().startswith("DEMO-")
    )


def _local_demo_is_active():
    return is_active_demo_engine(engine)


def _is_demo_alert(alert):
    return bool(getattr(alert, "is_demo", False)) or (
        isinstance(getattr(alert, "title", None), str)
        and alert.title.upper().startswith("DEMO ")
    )


@app.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    email = payload.email.strip().lower()
    user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if not verify_password(payload.password, user.password_hash if user else None):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    role = (user.role or "").lower()
    if role not in {"admin", "student"}:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "access_token": create_access_token(user.id, role),
        "token_type": "bearer",
        "expires_in": 30 * 60,
        "user": {"id": user.id, "full_name": user.full_name, "email": user.email, "role": role},
    }


@app.post("/auth/password-reset/request")
def request_password_reset(payload: ForgotPasswordRequest, request: Request, response: Response):
    _require_demo_password_reset(request)
    response.headers["Cache-Control"] = "no-store"
    # Keep the public request response identical for known and unknown addresses.
    return {"message": DEMO_RESET_MESSAGE}


@app.post("/auth/password-reset/demo-link", response_model=DemoResetLinkResponse)
def create_demo_reset_link(
    payload: ForgotPasswordRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    _require_demo_password_reset(request)
    response.headers["Cache-Control"] = "no-store"
    _ensure_reset_token_table()
    user = _find_documented_demo_user(db, payload.email)
    if user is None:
        return {"message": DEMO_RESET_MESSAGE, "reset_url": None}

    now = datetime.now(timezone.utc)
    db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.user_id == user.id,
        models.PasswordResetToken.used_at.is_(None),
    ).update({models.PasswordResetToken.used_at: now}, synchronize_session=False)
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    db.add(models.PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=now + DEMO_RESET_LIFETIME,
    ))
    db.commit()
    return {
        "message": DEMO_RESET_MESSAGE,
        "reset_url": f"/reset-password?token={token}",
    }


@app.post("/auth/password-reset/complete")
def complete_password_reset(
    payload: PasswordResetRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    _require_demo_password_reset(request)
    response.headers["Cache-Control"] = "no-store"
    _ensure_reset_token_table()
    token_hash = hashlib.sha256(payload.token.encode("utf-8")).hexdigest()
    reset = db.query(models.PasswordResetToken).filter_by(token_hash=token_hash).first()
    now = datetime.now(timezone.utc)
    expires_at = reset.expires_at if reset else None
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if reset is None or reset.used_at is not None or expires_at <= now:
        raise HTTPException(status_code=400, detail="This reset link is invalid or expired. Request a new demo reset link.")
    user = db.query(models.User).filter_by(id=reset.user_id).first()
    expected_role = DEMO_RESET_ACCOUNTS.get((user.email or "").strip().lower()) if user else None
    if user is None or expected_role is None or (user.role or "").strip().lower() != expected_role:
        raise HTTPException(status_code=400, detail="This reset link is invalid or expired. Request a new demo reset link.")

    try:
        user.password_hash = hash_password(payload.new_password)
        reset.used_at = now
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"message": "Password updated. You can now sign in with your new password."}


@app.get("/auth/me", response_model=AuthUserResponse)
def get_authenticated_user(response: Response, user: models.User = Depends(get_current_user)):
    response.headers["Cache-Control"] = "no-store"
    return {"id": user.id, "full_name": user.full_name, "email": user.email, "role": user.role.lower()}


@app.get(
    "/notices",
    response_model=list[NoticeResponse],
    dependencies=[Depends(require_roles("admin", "student"))],
)
def get_published_notices(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    return (
        db.query(models.Notice)
        .filter(models.Notice.published.is_(True))
        .filter(func.upper(models.Notice.title).notlike("DEMO %"))
        .filter((models.Notice.expires_at.is_(None)) | (models.Notice.expires_at > now))
        .order_by(models.Notice.created_at.desc(), models.Notice.id.desc())
        .all()
    )


@app.get(
    "/admin/notices",
    response_model=list[NoticeResponse],
    dependencies=[Depends(require_roles("admin"))],
)
def get_admin_notices(db: Session = Depends(get_db)):
    return db.query(models.Notice).order_by(
        models.Notice.created_at.desc(), models.Notice.id.desc()
    ).all()


@app.post(
    "/notices",
    response_model=NoticeResponse,
    status_code=201,
    dependencies=[Depends(require_roles("admin"))],
)
def create_notice(payload: NoticeCreateRequest, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    notice = models.Notice(
        title=payload.title,
        content=payload.content,
        created_by=user.id,
        published=payload.published,
        expires_at=payload.expires_at,
    )
    try:
        db.add(notice)
        db.commit()
        db.refresh(notice)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Notice could not be saved") from error
    return notice


@app.patch(
    "/notices/{notice_id}",
    response_model=NoticeResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def update_notice(notice_id: int, payload: NoticeUpdateRequest, db: Session = Depends(get_db)):
    notice = db.query(models.Notice).filter(models.Notice.id == notice_id).first()
    if notice is None:
        raise HTTPException(status_code=404, detail="Notice not found")
    if payload.published is True and "expires_at" not in payload.model_fields_set and notice.expires_at is not None:
        existing_expiry = notice.expires_at
        if existing_expiry.tzinfo is None:
            existing_expiry = existing_expiry.replace(tzinfo=timezone.utc)
        if existing_expiry <= datetime.now(timezone.utc):
            raise HTTPException(status_code=422, detail="Set a future expiry or clear the expired expiry before publishing")
    for field in payload.model_fields_set:
        setattr(notice, field, getattr(payload, field))
    try:
        db.commit()
        db.refresh(notice)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Notice could not be updated") from error
    return notice


@app.delete(
    "/notices/{notice_id}",
    status_code=204,
    dependencies=[Depends(require_roles("admin"))],
)
def delete_draft_notice(notice_id: int, db: Session = Depends(get_db)):
    notice = db.query(models.Notice).filter(models.Notice.id == notice_id).first()
    if notice is None:
        raise HTTPException(status_code=404, detail="Notice not found")
    if notice.published:
        raise HTTPException(status_code=409, detail="Unpublish this notice before deleting it")
    try:
        db.delete(notice)
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Notice could not be deleted") from error
    return Response(status_code=204)


def _booking_payload(booking, room, building):
    return {
        "id": booking.id,
        "user_id": booking.user_id,
        "room_id": room.id,
        "room_code": room.room_code,
        "room_name": getattr(room, "room_name", None),
        "is_demo": _is_demo_room(room),
        "building_code": building.building_code if building else None,
        "purpose": booking.purpose,
        "start_time": booking.start_time,
        "end_time": booking.end_time,
        "status": booking.status,
        "source": "DATABASE",
        "created_at": booking.created_at,
    }


def _lock_room_booking_scope(db: Session, room_id: int) -> None:
    """Serialize booking mutations for a room on PostgreSQL."""
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(:room_id)"), {"room_id": int(room_id)})


@app.get(
    "/bookings",
    response_model=list[BookingResponse],
    dependencies=[Depends(require_roles("admin", "student"))],
)
def get_bookings(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(models.RoomBooking, models.Room, models.Building).join(
        models.Room, models.Room.id == models.RoomBooking.room_id
    ).outerjoin(models.Building, models.Building.id == models.Room.building_id)
    if (user.role or "").lower() == "student":
        query = query.filter(models.RoomBooking.user_id == user.id)
    rows = query.order_by(models.RoomBooking.start_time, models.RoomBooking.id).all()
    return [_booking_payload(booking, room, building) for booking, room, building in rows]


@app.post(
    "/bookings",
    response_model=BookingResponse,
    status_code=201,
    dependencies=[Depends(require_roles("student"))],
)
def create_booking(payload: BookingCreateRequest, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    room = db.query(models.Room).filter(models.Room.id == payload.room_id).first()
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    if _is_demo_room(room) and not _local_demo_is_active():
        raise HTTPException(status_code=409, detail="Demo rooms are available for bookings only in the approved isolated local demo")
    building = db.query(models.Building).filter(models.Building.id == room.building_id).first() if room.building_id else None

    try:
        # Serialize competing booking attempts for this room on PostgreSQL.
        # This keeps overlap prevention effective without a schema migration.
        _lock_room_booking_scope(db, room.id)
        conflict = db.query(models.RoomBooking.id).filter(
            models.RoomBooking.room_id == room.id,
            func.upper(models.RoomBooking.status).in_(("PENDING", "APPROVED")),
            models.RoomBooking.start_time < payload.end_time,
            models.RoomBooking.end_time > payload.start_time,
        ).first()
        if conflict:
            db.rollback()
            raise HTTPException(status_code=409, detail="This room is already booked during the requested time")

        booking = models.RoomBooking(
            room_id=room.id,
            user_id=user.id,
            purpose=(
                f"DEMO | {payload.purpose[:248]}"
                if _is_demo_room(room) and not payload.purpose.upper().startswith("DEMO ")
                else payload.purpose
            ),
            start_time=payload.start_time.astimezone(timezone.utc),
            end_time=payload.end_time.astimezone(timezone.utc),
            status="PENDING",
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        return _booking_payload(booking, room, building)
    except HTTPException:
        raise
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Booking conflicts with existing database records") from error


@app.delete(
    "/bookings/{booking_id}",
    status_code=204,
    dependencies=[Depends(require_roles("student"))],
)
def cancel_booking(booking_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(models.RoomBooking).filter(models.RoomBooking.id == booking_id).first()
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != user.id:
        raise HTTPException(status_code=403, detail="You may only cancel your own bookings")
    room = db.query(models.Room).filter(models.Room.id == booking.room_id).first()
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    if _is_demo_room(room) and not _local_demo_is_active():
        raise HTTPException(status_code=409, detail="Demo bookings are available only in the isolated local demo")
    if (booking.status or "").upper() not in {"PENDING", "APPROVED"}:
        raise HTTPException(status_code=409, detail="This booking cannot be cancelled")
    try:
        _lock_room_booking_scope(db, booking.room_id)
        db.refresh(booking)
        if booking.user_id != user.id:
            raise HTTPException(status_code=403, detail="You may only cancel your own bookings")
        if (booking.status or "").upper() not in {"PENDING", "APPROVED"}:
            raise HTTPException(status_code=409, detail="This booking can no longer be cancelled")
        booking.status = "CANCELLED"
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Booking could not be cancelled") from error
    return Response(status_code=204)


@app.patch(
    "/bookings/{booking_id}/status",
    response_model=BookingResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def update_booking_status(booking_id: int, payload: BookingStatusUpdateRequest, db: Session = Depends(get_db)):
    booking = db.query(models.RoomBooking).filter(models.RoomBooking.id == booking_id).first()
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found")
    room = db.query(models.Room).filter(models.Room.id == booking.room_id).first()
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    if _is_demo_room(room) and not _local_demo_is_active():
        raise HTTPException(status_code=409, detail="Demo bookings are available only in the isolated local demo")
    building = db.query(models.Building).filter(models.Building.id == room.building_id).first() if room.building_id else None
    try:
        _lock_room_booking_scope(db, room.id)
        db.refresh(booking)
        if (booking.status or "").upper() != "PENDING":
            db.rollback()
            raise HTTPException(status_code=409, detail="Only pending bookings can be reviewed")
        if payload.status == "APPROVED":
            conflict = db.query(models.RoomBooking.id).filter(
                models.RoomBooking.room_id == room.id,
                models.RoomBooking.id != booking.id,
                func.upper(models.RoomBooking.status).in_(("PENDING", "APPROVED")),
                models.RoomBooking.start_time < booking.end_time,
                models.RoomBooking.end_time > booking.start_time,
            ).first()
            if conflict:
                db.rollback()
                raise HTTPException(status_code=409, detail="Another booking overlaps this time; this request cannot be approved")
        booking.status = payload.status
        db.commit()
        db.refresh(booking)
        return _booking_payload(booking, room, building)
    except HTTPException:
        raise
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Booking status could not be updated") from error


def _maintenance_request_query(db: Session):
    return db.query(
        models.MaintenanceRequest,
        models.Room,
        models.Building,
        models.User,
    ).join(
        models.Room, models.Room.id == models.MaintenanceRequest.room_id
    ).outerjoin(
        models.Building, models.Building.id == models.Room.building_id
    ).outerjoin(
        models.User, models.User.id == models.MaintenanceRequest.reported_by
    )


def _maintenance_request_payload(request, room, building, reporter):
    return {
        "id": request.id,
        "room_id": room.id,
        "room_code": room.room_code,
        "is_demo": _is_demo_room(room),
        "room_name": room.room_name,
        "building_code": building.building_code if building else None,
        "building_name": building.name if building else None,
        "reported_by": request.reported_by,
        "reporter_name": reporter.full_name if reporter else None,
        "title": request.title,
        "description": request.description,
        "priority": (request.priority or "MEDIUM").upper(),
        "status": (request.status or "OPEN").upper(),
        "created_at": request.created_at,
        "resolved_at": request.resolved_at,
    }


@app.post(
    "/maintenance/requests",
    response_model=MaintenanceRequestResponse,
    status_code=201,
    dependencies=[Depends(require_roles("student"))],
)
def create_maintenance_request(
    payload: MaintenanceRequestCreateRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    room = db.query(models.Room).filter(models.Room.id == payload.room_id).first()
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    if _is_demo_room(room) and not _local_demo_is_active():
        raise HTTPException(status_code=409, detail="Demo rooms are not available for maintenance requests")
    building = None
    if room.building_id is not None:
        building = db.query(models.Building).filter(models.Building.id == room.building_id).first()
        if building is None:
            raise HTTPException(status_code=404, detail="Room building not found")

    request = models.MaintenanceRequest(
        room_id=room.id,
        reported_by=user.id,
        title=(
            f"DEMO | {payload.title[:143]}"
            if _is_demo_room(room) and not payload.title.upper().startswith("DEMO ")
            else payload.title
        ),
        description=(
            f"DEMO: {payload.description or ''}"
            if _is_demo_room(room)
            else payload.description
        ),
        priority=payload.priority.upper(),
        status="OPEN",
    )
    try:
        db.add(request)
        db.commit()
        db.refresh(request)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Maintenance request conflicts with existing database records") from error
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=503, detail="Maintenance request could not be saved") from error

    return _maintenance_request_payload(request, room, building, user)


@app.get(
    "/maintenance/requests",
    response_model=list[MaintenanceRequestResponse],
    dependencies=[Depends(require_roles("admin", "student"))],
)
def get_maintenance_requests(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = _maintenance_request_query(db)
    if (user.role or "").lower() == "student":
        query = query.filter(models.MaintenanceRequest.reported_by == user.id)
    rows = query.order_by(
        models.MaintenanceRequest.created_at.desc().nullslast(),
        models.MaintenanceRequest.id.desc(),
    ).all()
    return [
        _maintenance_request_payload(request, room, building, reporter)
        for request, room, building, reporter in rows
    ]


@app.get(
    "/maintenance/requests/{request_id}",
    response_model=MaintenanceRequestResponse,
    dependencies=[Depends(require_roles("admin", "student"))],
)
def get_maintenance_request(
    request_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _maintenance_request_query(db).filter(
        models.MaintenanceRequest.id == request_id
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Maintenance request not found")
    request, room, building, reporter = row
    if (user.role or "").lower() == "student" and request.reported_by != user.id:
        raise HTTPException(status_code=404, detail="Maintenance request not found")
    return _maintenance_request_payload(request, room, building, reporter)


@app.patch(
    "/maintenance/requests/{request_id}/status",
    response_model=MaintenanceRequestResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def update_maintenance_request_status(
    request_id: int,
    payload: MaintenanceRequestStatusUpdateRequest,
    db: Session = Depends(get_db),
):
    request = db.query(models.MaintenanceRequest).filter(
        models.MaintenanceRequest.id == request_id
    ).first()
    if request is None:
        raise HTTPException(status_code=404, detail="Maintenance request not found")
    room = db.query(models.Room).filter(models.Room.id == request.room_id).first()
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    if _is_demo_room(room) and not _local_demo_is_active():
        raise HTTPException(status_code=409, detail="Demo requests are available only in the isolated local demo")
    request.status = payload.status
    request.resolved_at = datetime.now(timezone.utc) if payload.status == "RESOLVED" else None
    try:
        db.commit()
        db.refresh(request)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=503, detail="Maintenance request status could not be updated") from error

    row = _maintenance_request_query(db).filter(
        models.MaintenanceRequest.id == request_id
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Maintenance request not found")
    return _maintenance_request_payload(*row)


@app.get(
    "/emergency/alerts/published",
    response_model=list[EmergencyAlertResponse],
    dependencies=[Depends(require_roles("admin", "student"))],
)
def get_published_emergency_alerts(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    query = db.query(models.EmergencyAlert).filter(
        models.EmergencyAlert.active.is_(True),
        (models.EmergencyAlert.expires_at.is_(None)) | (models.EmergencyAlert.expires_at > now),
    )
    if not _local_demo_is_active():
        query = query.filter(func.upper(models.EmergencyAlert.title).notlike("DEMO %"))
    return query.order_by(models.EmergencyAlert.created_at.desc(), models.EmergencyAlert.id.desc()).all()


@app.get(
    "/emergency/alerts",
    response_model=list[EmergencyAlertResponse],
    dependencies=[Depends(require_roles("admin"))],
)
def get_all_emergency_alerts(db: Session = Depends(get_db)):
    return db.query(models.EmergencyAlert).order_by(
        models.EmergencyAlert.created_at.desc(), models.EmergencyAlert.id.desc()
    ).all()


@app.post(
    "/emergency/alerts",
    response_model=EmergencyAlertResponse,
    status_code=201,
    dependencies=[Depends(require_roles("admin"))],
)
def create_emergency_alert(payload: EmergencyAlertCreateRequest, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    local_demo = _local_demo_is_active()
    if payload.title.upper().startswith("DEMO ") and not local_demo:
        raise HTTPException(status_code=409, detail="Demo alerts can be created only in the isolated local demo")
    alert = models.EmergencyAlert(
        title=(
            payload.title if payload.title.upper().startswith("DEMO ")
            else f"DEMO | {payload.title[:192]}"
        ) if local_demo else payload.title,
        message=(
            payload.message if payload.message.upper().startswith("DEMO")
            else f"DEMO: fictional local preview alert; not a real campus incident. {payload.message}"
        ) if local_demo else payload.message,
        severity=payload.severity,
        active=True,
        created_by=user.id,
        expires_at=payload.expires_at,
    )
    try:
        db.add(alert)
        db.commit()
        db.refresh(alert)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Emergency alert could not be published") from error
    return alert


@app.patch(
    "/emergency/alerts/{alert_id}/deactivate",
    response_model=EmergencyAlertResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def deactivate_emergency_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(models.EmergencyAlert).filter(models.EmergencyAlert.id == alert_id).first()
    if alert is None:
        raise HTTPException(status_code=404, detail="Emergency alert not found")
    if not alert.active:
        return alert
    alert.active = False
    try:
        db.commit()
        db.refresh(alert)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Emergency alert could not be deactivated") from error
    return alert


# Get all rooms from PostgreSQL
@app.get(
    "/rooms",
    response_model=list[RoomResponse],
    dependencies=[Depends(require_roles("admin", "student"))],
)
def get_rooms(db: Session = Depends(get_db)):
    return db.query(models.Room).order_by(models.Room.id).all()


@app.post(
    "/rooms",
    response_model=RoomResponse,
    status_code=201,
    dependencies=[Depends(require_roles("admin"))],
)
def create_room(payload: RoomCreateRequest, db: Session = Depends(get_db)):
    building = db.query(models.Building).filter(
        models.Building.building_code == payload.building_code
    ).first()
    if building is None:
        raise HTTPException(status_code=404, detail="Building not found")
    if _is_demo_building(building) or payload.room_code.upper().startswith("DEMO-"):
        raise HTTPException(status_code=409, detail="Demo room inventory is fixed and cannot be changed through room management")

    existing_room = db.query(models.Room.id).filter(
        models.Room.room_code == payload.room_code
    ).first()
    if existing_room is not None:
        raise HTTPException(status_code=409, detail="A room with this room code already exists")

    room = models.Room(
        building_id=building.id,
        room_code=payload.room_code,
        room_name=payload.room_name,
        floor_number=payload.floor_number,
        capacity=payload.capacity,
        room_type=payload.room_type,
    )
    try:
        db.add(room)
        db.commit()
        db.refresh(room)
    except IntegrityError as error:
        db.rollback()
        constraint_name = getattr(getattr(error.orig, "diag", None), "constraint_name", "") or ""
        if "room_code" in constraint_name.lower():
            raise HTTPException(status_code=409, detail="A room with this room code already exists") from error
        raise HTTPException(
            status_code=409,
            detail="Room could not be created because it conflicts with existing database records",
        ) from error
    return room


@app.get(
    "/energy/readings",
    response_model=EnergyReadingsResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def get_energy_readings(
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    building_code: str | None = Query(default=None, min_length=1, max_length=30),
    limit: int = Query(default=1000, ge=1, le=2000),
    include_demo: bool = False,
    db: Session = Depends(get_db),
):
    """Read operational kWh by default; include_demo is an explicit preview opt-in."""
    start_utc = start.replace(tzinfo=timezone.utc) if start and start.tzinfo is None else start.astimezone(timezone.utc) if start else None
    end_utc = end.replace(tzinfo=timezone.utc) if end and end.tzinfo is None else end.astimezone(timezone.utc) if end else None
    if start_utc and end_utc and start_utc >= end_utc:
        raise HTTPException(status_code=422, detail="start must be earlier than end")

    query = db.query(models.EnergyReading, models.Building).join(
        models.Building, models.Building.id == models.EnergyReading.building_id
    )
    if not include_demo:
        query = query.filter(func.coalesce(func.upper(models.EnergyReading.reading_source), "").notlike("%SIMULAT%"))
    if building_code is not None:
        building = db.query(models.Building.id).filter(
            models.Building.building_code == building_code
        ).first()
        if building is None:
            raise HTTPException(status_code=404, detail="Building not found")
        query = query.filter(models.Building.building_code == building_code)
    if start_utc is not None:
        query = query.filter(models.EnergyReading.recorded_at >= start_utc)
    if end_utc is not None:
        query = query.filter(models.EnergyReading.recorded_at < end_utc)

    rows = query.order_by(
        models.EnergyReading.recorded_at.desc().nullslast(),
        models.EnergyReading.id.desc(),
    ).limit(limit + 1).all()
    truncated = len(rows) > limit
    rows = rows[:limit]
    rows.sort(key=lambda item: (
        item[0].recorded_at is None,
        item[0].recorded_at or datetime.max.replace(tzinfo=timezone.utc),
        item[0].id,
    ))
    readings = []
    for reading, building in rows:
        if reading.energy_kwh < 0:
            raise HTTPException(status_code=500, detail="Stored energy data contains a negative value")
        readings.append({
            "id": reading.id,
            "building_id": reading.building_id,
            "building_code": building.building_code,
            "building_name": building.name,
            "energy_kwh": reading.energy_kwh,
            "reading_source": reading.reading_source,
            "recorded_at": reading.recorded_at,
        })
    return {"unit": "kWh", "limit": limit, "truncated": truncated, "readings": readings}


@app.get(
    "/occupancy",
    response_model=OccupancyDashboardResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def get_latest_room_occupancy(
    room_id: int | None = Query(default=None, ge=1),
    building_code: str | None = Query(default=None, min_length=1, max_length=30),
    include_demo: bool = False,
    db: Session = Depends(get_db),
):
    """Return operational readings by default; include_demo is an explicit preview opt-in."""
    if room_id is not None and db.query(models.Room.id).filter(models.Room.id == room_id).first() is None:
        raise HTTPException(status_code=404, detail="Room not found")

    if building_code is not None and db.query(models.Building.id).filter(
        models.Building.building_code == building_code
    ).first() is None:
        raise HTTPException(status_code=404, detail="Building not found")

    latest_query = db.query(
        models.RoomOccupancy.id.label("occupancy_id"),
        func.row_number().over(
            partition_by=models.RoomOccupancy.room_id,
            order_by=(models.RoomOccupancy.recorded_at.desc().nullslast(), models.RoomOccupancy.id.desc()),
        ).label("reading_rank"),
    )
    if include_demo:
        # Preview mode is specifically for simulated readings. Keep a later
        # operational reading from replacing the latest simulated sample.
        latest_query = latest_query.filter(
            func.coalesce(func.upper(models.RoomOccupancy.source), "").like("%SIMULAT%")
        )
    else:
        latest_query = latest_query.filter(
            func.coalesce(func.upper(models.RoomOccupancy.source), "").notlike("%SIMULAT%")
        )
    latest_ids = latest_query.subquery()

    query = (
        db.query(models.RoomOccupancy, models.Room, models.Building)
        .join(latest_ids, and_(latest_ids.c.occupancy_id == models.RoomOccupancy.id, latest_ids.c.reading_rank == 1))
        .join(models.Room, models.Room.id == models.RoomOccupancy.room_id)
        .outerjoin(models.Building, models.Building.id == models.Room.building_id)
    )
    if room_id is not None:
        query = query.filter(models.Room.id == room_id)
    if building_code is not None:
        query = query.filter(models.Building.building_code == building_code)
    if not include_demo:
        query = query.filter(models.Room.room_code.notilike("DEMO-%"))

    room_count_query = db.query(func.count(models.Room.id))
    if not include_demo:
        room_count_query = room_count_query.filter(models.Room.room_code.notilike("DEMO-%"))
    room_count = room_count_query.scalar() or 0
    readings = []
    for occupancy, room, building in query.order_by(
        models.Building.building_code,
        models.Room.floor_number,
        models.Room.room_code,
    ).all():
        if occupancy.occupied_count < 0:
            raise HTTPException(status_code=500, detail="Stored occupancy data contains a negative count")
        readings.append({
            "id": occupancy.id,
            "room_id": room.id,
            "room_code": room.room_code,
            "room_name": room.room_name,
            "building_code": building.building_code if building else None,
            "building_name": building.name if building else None,
            "floor_number": room.floor_number,
            "capacity": room.capacity,
            "is_demo": _is_demo_room(room),
            "occupied_count": occupancy.occupied_count,
            "source": occupancy.source,
            "recorded_at": occupancy.recorded_at,
        })

    return {"room_count": room_count, "demo_preview": include_demo, "readings": readings}


@app.get(
    "/student/occupancy/history",
    response_model=OccupancyDashboardResponse,
    dependencies=[Depends(require_roles("student"))],
)
def get_student_simulated_occupancy_history(
    building_code: str | None = Query(default=None, min_length=1, max_length=30),
    limit: int = Query(default=2000, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    """Authenticated student view of explicitly simulated occupancy only."""
    query = (
        db.query(models.RoomOccupancy, models.Room, models.Building)
        .join(models.Room, models.Room.id == models.RoomOccupancy.room_id)
        .join(models.Building, models.Building.id == models.Room.building_id)
        .filter(func.coalesce(func.upper(models.RoomOccupancy.source), "").like("%SIMULAT%"))
    )
    if building_code:
        query = query.filter(models.Building.building_code == building_code)
    rows = query.order_by(
        models.RoomOccupancy.recorded_at.asc(), models.RoomOccupancy.id.asc()
    ).limit(limit + 1).all()
    readings = []
    for occupancy, room, building in rows[:limit]:
        readings.append({
            "id": occupancy.id, "room_id": room.id, "room_code": room.room_code,
            "room_name": room.room_name, "building_code": building.building_code,
            "building_name": building.name, "floor_number": room.floor_number,
            "capacity": room.capacity, "is_demo": _is_demo_room(room),
            "occupied_count": occupancy.occupied_count, "source": occupancy.source,
            "recorded_at": occupancy.recorded_at,
        })
    return {
        "room_count": len({reading["room_id"] for reading in readings}),
        "demo_preview": True,
        "readings": readings,
    }


@app.get(
    "/student/energy/readings",
    response_model=EnergyReadingsResponse,
    dependencies=[Depends(require_roles("student"))],
)
def get_student_simulated_energy_readings(
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    building_code: str | None = Query(default=None, min_length=1, max_length=30),
    limit: int = Query(default=1000, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    """Authenticated student view of explicitly simulated kWh readings only."""
    start_utc = start.replace(tzinfo=timezone.utc) if start and start.tzinfo is None else start.astimezone(timezone.utc) if start else None
    end_utc = end.replace(tzinfo=timezone.utc) if end and end.tzinfo is None else end.astimezone(timezone.utc) if end else None
    if start_utc and end_utc and start_utc >= end_utc:
        raise HTTPException(status_code=422, detail="start must be earlier than end")
    query = (
        db.query(models.EnergyReading, models.Building)
        .join(models.Building, models.Building.id == models.EnergyReading.building_id)
        .filter(func.coalesce(func.upper(models.EnergyReading.reading_source), "").like("%SIMULAT%"))
    )
    if building_code:
        query = query.filter(models.Building.building_code == building_code)
    if start_utc is not None:
        query = query.filter(models.EnergyReading.recorded_at >= start_utc)
    if end_utc is not None:
        query = query.filter(models.EnergyReading.recorded_at < end_utc)
    rows = query.order_by(
        models.EnergyReading.recorded_at.asc(), models.EnergyReading.id.asc()
    ).limit(limit + 1).all()
    truncated = len(rows) > limit
    readings = [{
        "id": reading.id, "building_id": reading.building_id,
        "building_code": building.building_code, "building_name": building.name,
        "energy_kwh": reading.energy_kwh, "reading_source": reading.reading_source,
        "recorded_at": reading.recorded_at,
    } for reading, building in rows[:limit]]
    return {"unit": "kWh", "limit": limit, "truncated": truncated, "readings": readings}


@app.get(
    "/analytics/summary",
    response_model=AnalyticsSummaryResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def get_analytics_summary(
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    limit: int = Query(default=2000, ge=1, le=5000),
    include_demo: bool = False,
    db: Session = Depends(get_db),
):
    """Read operational analytics by default; include_demo opts into a labeled preview."""
    start_utc = start.replace(tzinfo=timezone.utc) if start and start.tzinfo is None else start.astimezone(timezone.utc) if start else None
    end_utc = end.replace(tzinfo=timezone.utc) if end and end.tzinfo is None else end.astimezone(timezone.utc) if end else None
    if start_utc and end_utc and start_utc >= end_utc:
        raise HTTPException(status_code=422, detail="start must be earlier than end")

    def apply_period(query, timestamp_column):
        if start_utc is not None:
            query = query.filter(timestamp_column >= start_utc)
        if end_utc is not None:
            query = query.filter(timestamp_column < end_utc)
        return query

    buildings_query = db.query(func.count(models.Building.id)).filter(
        models.Building.building_code.notilike("DEMO-%")
    )
    rooms_query = db.query(func.count(models.Room.id)).filter(models.Room.room_code.notilike("DEMO-%"))
    buildings_total = buildings_query.scalar() or 0
    rooms_total = rooms_query.scalar() or 0

    occupancy_query = apply_period(
        db.query(models.RoomOccupancy, models.Room, models.Building)
        .join(models.Room, models.Room.id == models.RoomOccupancy.room_id)
        .outerjoin(models.Building, models.Building.id == models.Room.building_id),
        models.RoomOccupancy.recorded_at,
    )
    operational_occupancy_query = occupancy_query.filter(
        models.Room.room_code.notilike("DEMO-%"),
        func.coalesce(func.upper(models.RoomOccupancy.source), "").notlike("%SIMULAT%"),
    )
    occupancy_count = operational_occupancy_query.with_entities(
        func.count(models.RoomOccupancy.id)
    ).scalar() or 0
    if not include_demo:
        occupancy_query = operational_occupancy_query
    occupancy_rows = occupancy_query.order_by(
        models.RoomOccupancy.recorded_at.asc().nullsfirst(), models.RoomOccupancy.id.asc()
    ).limit(limit + 1).all()
    occupancy_truncated = len(occupancy_rows) > limit
    occupancy_rows = occupancy_rows[:limit]

    energy_query = apply_period(
        db.query(models.EnergyReading, models.Building)
        .join(models.Building, models.Building.id == models.EnergyReading.building_id),
        models.EnergyReading.recorded_at,
    )
    operational_energy_query = energy_query.filter(
        models.Building.building_code.notilike("DEMO-%"),
        func.coalesce(func.upper(models.EnergyReading.reading_source), "").notlike("%SIMULAT%"),
    )
    energy_count = operational_energy_query.with_entities(
        func.count(models.EnergyReading.id)
    ).scalar() or 0
    if not include_demo:
        energy_query = operational_energy_query
    energy_rows = energy_query.order_by(
        models.EnergyReading.recorded_at.asc().nullsfirst(), models.EnergyReading.id.asc()
    ).limit(limit + 1).all()
    energy_truncated = len(energy_rows) > limit
    energy_rows = energy_rows[:limit]

    energy_by_building = apply_period(
        db.query(
            models.Building.building_code.label("building_code"),
            models.Building.name.label("building_name"),
            models.EnergyReading.reading_source.label("source"),
            func.avg(models.EnergyReading.energy_kwh).label("average_kwh"),
            func.count(models.EnergyReading.id).label("reading_count"),
        ).join(models.EnergyReading, models.EnergyReading.building_id == models.Building.id),
        models.EnergyReading.recorded_at,
    )
    if not include_demo:
        energy_by_building = energy_by_building.filter(
            models.Building.building_code.notilike("DEMO-%"),
            func.coalesce(func.upper(models.EnergyReading.reading_source), "").notlike("%SIMULAT%"),
        )
    energy_by_building = energy_by_building.group_by(
        models.Building.building_code,
        models.Building.name,
        models.EnergyReading.reading_source,
    ).order_by(
        models.Building.building_code,
        models.EnergyReading.reading_source,
    ).all()

    maintenance_query = apply_period(
        db.query(models.MaintenanceRequest)
        .join(models.Room, models.Room.id == models.MaintenanceRequest.room_id),
        models.MaintenanceRequest.created_at,
    )
    maintenance_query = maintenance_query.filter(models.Room.room_code.notilike("DEMO-%"))
    maintenance_open = maintenance_query.filter(
        func.upper(models.MaintenanceRequest.status) == "OPEN",
        models.MaintenanceRequest.resolved_at.is_(None),
    ).with_entities(func.count(models.MaintenanceRequest.id)).scalar() or 0
    maintenance_resolved = maintenance_query.filter(
        models.MaintenanceRequest.resolved_at.isnot(None)
    ).with_entities(func.count(models.MaintenanceRequest.id)).scalar() or 0
    demo_maintenance_query = apply_period(
        db.query(models.MaintenanceRequest)
        .join(models.Room, models.Room.id == models.MaintenanceRequest.room_id)
        .filter(models.Room.room_code.ilike("DEMO-%")),
        models.MaintenanceRequest.created_at,
    )
    demo_maintenance_open = demo_maintenance_query.filter(
        func.upper(models.MaintenanceRequest.status) == "OPEN",
        models.MaintenanceRequest.resolved_at.is_(None),
    ).with_entities(func.count(models.MaintenanceRequest.id)).scalar() or 0
    demo_maintenance_resolved = demo_maintenance_query.filter(
        models.MaintenanceRequest.resolved_at.isnot(None)
    ).with_entities(func.count(models.MaintenanceRequest.id)).scalar() or 0

    # Utilization is meaningful only when every verified room has a positive
    # capacity and a latest occupancy reading.
    capacity_query = db.query(
        func.count(models.Room.id),
        func.count(models.Room.id).filter(models.Room.capacity.isnot(None), models.Room.capacity > 0),
        func.sum(models.Room.capacity),
    )
    capacity_query = capacity_query.filter(models.Room.room_code.notilike("DEMO-%"))
    capacity_stats = capacity_query.one()
    latest_occupancy_query = db.query(
        models.RoomOccupancy.room_id.label("room_id"),
        models.RoomOccupancy.occupied_count.label("occupied_count"),
        func.row_number().over(
            partition_by=models.RoomOccupancy.room_id,
            order_by=(models.RoomOccupancy.recorded_at.desc().nullslast(), models.RoomOccupancy.id.desc()),
        ).label("reading_rank"),
    ).join(
        models.Room, models.Room.id == models.RoomOccupancy.room_id
    )
    latest_occupancy_query = latest_occupancy_query.filter(
        models.Room.room_code.notilike("DEMO-%"),
        func.coalesce(func.upper(models.RoomOccupancy.source), "").notlike("%SIMULAT%"),
    )
    latest_occupancy = latest_occupancy_query.subquery()
    latest_stats = db.query(
        func.count(latest_occupancy.c.room_id),
        func.sum(latest_occupancy.c.occupied_count),
    ).filter(latest_occupancy.c.reading_rank == 1).one()
    utilization_percent = None
    room_count, rooms_with_capacity, total_capacity = capacity_stats
    readings_for_rooms, total_occupancy = latest_stats
    if room_count and rooms_with_capacity == room_count and readings_for_rooms == room_count and total_capacity:
        utilization_percent = round(float(total_occupancy or 0) / float(total_capacity) * 100, 2)

    demo_buildings_total = db.query(func.count(models.Building.id)).filter(
        models.Building.building_code.ilike("DEMO-%")
    ).scalar() or 0
    demo_rooms_total = db.query(func.count(models.Room.id)).filter(
        models.Room.room_code.ilike("DEMO-%")
    ).scalar() or 0
    demo_occupancy_query = apply_period(
        db.query(models.RoomOccupancy)
        .join(models.Room, models.Room.id == models.RoomOccupancy.room_id)
        .filter(
            (models.Room.room_code.ilike("DEMO-%"))
            | (func.coalesce(func.upper(models.RoomOccupancy.source), "").like("%SIMULAT%"))
        ),
        models.RoomOccupancy.recorded_at,
    )
    demo_energy_query = apply_period(
        db.query(models.EnergyReading)
        .join(models.Building, models.Building.id == models.EnergyReading.building_id)
        .filter(
            (models.Building.building_code.ilike("DEMO-%"))
            | (func.coalesce(func.upper(models.EnergyReading.reading_source), "").like("%SIMULAT%"))
        ),
        models.EnergyReading.recorded_at,
    )
    return {
        "period": {"start": start_utc, "end": end_utc},
        "demo_preview": include_demo,
        "buildings_total": buildings_total,
        "verified_rooms_total": rooms_total,
        "demo_buildings_total": demo_buildings_total if include_demo else 0,
        "demo_rooms_total": demo_rooms_total if include_demo else 0,
        "occupancy_readings_total": occupancy_count,
        "demo_occupancy_readings_total": (
            demo_occupancy_query.with_entities(func.count(models.RoomOccupancy.id)).scalar() or 0
        ) if include_demo else 0,
        "energy_readings_total": energy_count,
        "demo_energy_readings_total": (
            demo_energy_query.with_entities(func.count(models.EnergyReading.id)).scalar() or 0
        ) if include_demo else 0,
        "maintenance_open_total": maintenance_open,
        "maintenance_resolved_total": maintenance_resolved,
        "demo_maintenance_open_total": demo_maintenance_open if include_demo else 0,
        "demo_maintenance_resolved_total": demo_maintenance_resolved if include_demo else 0,
        "room_utilization_percent": utilization_percent,
        "occupancy_truncated": occupancy_truncated,
        "energy_truncated": energy_truncated,
        "occupancy_readings": [
            {
                "id": reading.id,
                "room_id": room.id,
                "room_code": room.room_code,
                "building_code": building.building_code if building else None,
                "building_name": building.name if building else None,
                "occupied_count": reading.occupied_count,
                "source": reading.source,
                "is_demo": _is_demo_room(room),
                "recorded_at": reading.recorded_at,
            }
            for reading, room, building in occupancy_rows
        ],
        "energy_readings": [
            {
                "id": reading.id,
                "building_code": building.building_code,
                "building_name": building.name,
                "energy_kwh": reading.energy_kwh,
                "source": reading.reading_source,
                "is_demo": _is_demo_building(building),
                "recorded_at": reading.recorded_at,
            }
            for reading, building in energy_rows
        ],
        "energy_by_building": [
            {
                "building_code": row.building_code,
                "building_name": row.building_name,
                "source": row.source,
                "average_kwh_per_reading": row.average_kwh,
                "reading_count": row.reading_count,
            }
            for row in energy_by_building
        ],
    }


@app.get(
    "/buildings/{building_code}/rooms",
    response_model=list[RoomResponse],
    dependencies=[Depends(require_roles("admin", "student"))],
)
def get_building_rooms(
    building_code: str,
    floor_number: int | None = Query(default=None, ge=0),
    db: Session = Depends(get_db),
):
    building = (
        db.query(models.Building)
        .filter(models.Building.building_code == building_code)
        .first()
    )
    if building is None:
        raise HTTPException(status_code=404, detail="Building not found")

    query = db.query(models.Room).filter(models.Room.building_id == building.id)
    if floor_number is not None:
        query = query.filter(models.Room.floor_number == floor_number)
    return query.order_by(models.Room.floor_number, models.Room.room_code).all()



@app.get(
    "/buildings/{building_code}/floor-labels",
    dependencies=[Depends(require_roles("admin", "student"))],
)
def get_building_floor_labels(
    building_code: str,
    floor_number: int | None = Query(default=None, ge=0),
    db: Session = Depends(get_db)
):
    building = (
        db.query(models.Building)
        .filter(models.Building.building_code == building_code)
        .first()
    )

    if building is None:
        raise HTTPException(
            status_code=404,
            detail="Building not found"
        )

    label_query = db.query(models.BuildingFloorLabel).filter(
        models.BuildingFloorLabel.building_id == building.id
    )
    if floor_number is not None:
        label_query = label_query.filter(
            models.BuildingFloorLabel.floor_number == floor_number
        )
    labels = (
        label_query
        .order_by(
            models.BuildingFloorLabel.floor_number,
            models.BuildingFloorLabel.id
        )
        .all()
    )

    return {
        "building_code": building.building_code,
        "building_name": building.name,
        "is_demo": _is_demo_building(building),
        "floor_labels": [
            {
                "floor_number": item.floor_number,
                "floor_name": (
                    "Ground Floor"
                    if item.floor_number == 0
                    else "First Floor"
                    if item.floor_number == 1
                    else f"Floor {item.floor_number}"
                ),
                "label": item.label,
                "is_demo": item.is_demo,
            }
            for item in labels
        ]
    }


@app.get(
    "/buildings",
    response_model=list[BuildingResponse],
    dependencies=[Depends(require_roles("admin", "student"))],
)
def get_buildings(db: Session = Depends(get_db)):
    buildings = (
        db.query(models.Building)
        .order_by(models.Building.building_code)
        .all()
    )

    return [
        {
            "id": building.id,
            "building_code": building.building_code,
            "name": building.name,
            "description": building.description,
            "is_demo": _is_demo_building(building),
        }
        for building in buildings
    ]
