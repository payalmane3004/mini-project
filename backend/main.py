
from datetime import datetime, timezone

from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, text
from sqlalchemy.exc import IntegrityError

from database import engine, get_db
from demo_mode import is_active_demo_engine
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
    NoticeCreateRequest,
    NoticeResponse,
    NoticeUpdateRequest,
    OccupancyDashboardResponse,
    RoomCreateRequest,
    RoomResponse,
)
from security import create_access_token, get_current_user, require_roles, verify_password

app = FastAPI(title="CampusSphere API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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
            "database": "connected"
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
            purpose=payload.purpose,
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


@app.get(
    "/emergency/alerts/published",
    response_model=list[EmergencyAlertResponse],
    dependencies=[Depends(require_roles("admin", "student"))],
)
def get_published_emergency_alerts(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    return db.query(models.EmergencyAlert).filter(
        models.EmergencyAlert.active.is_(True),
        (models.EmergencyAlert.expires_at.is_(None)) | (models.EmergencyAlert.expires_at > now),
    ).order_by(models.EmergencyAlert.created_at.desc(), models.EmergencyAlert.id.desc()).all()


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
    alert = models.EmergencyAlert(
        title=payload.title,
        message=payload.message,
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
    db: Session = Depends(get_db),
):
    """Read stored kWh readings in chronological order; no meter feed is implied."""
    start_utc = start.replace(tzinfo=timezone.utc) if start and start.tzinfo is None else start.astimezone(timezone.utc) if start else None
    end_utc = end.replace(tzinfo=timezone.utc) if end and end.tzinfo is None else end.astimezone(timezone.utc) if end else None
    if start_utc and end_utc and start_utc >= end_utc:
        raise HTTPException(status_code=422, detail="start must be earlier than end")

    query = db.query(models.EnergyReading, models.Building).join(
        models.Building, models.Building.id == models.EnergyReading.building_id
    )
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
    db: Session = Depends(get_db),
):
    """Return the newest stored occupancy reading for each database room."""
    if room_id is not None and db.query(models.Room.id).filter(models.Room.id == room_id).first() is None:
        raise HTTPException(status_code=404, detail="Room not found")

    if building_code is not None and db.query(models.Building.id).filter(
        models.Building.building_code == building_code
    ).first() is None:
        raise HTTPException(status_code=404, detail="Building not found")

    latest_ids = (
        db.query(
            models.RoomOccupancy.id.label("occupancy_id"),
            func.row_number().over(
                partition_by=models.RoomOccupancy.room_id,
                order_by=(models.RoomOccupancy.recorded_at.desc().nullslast(), models.RoomOccupancy.id.desc()),
            ).label("reading_rank"),
        )
        .subquery()
    )

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

    room_count = db.query(func.count(models.Room.id)).scalar() or 0
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
            "occupied_count": occupancy.occupied_count,
            "source": occupancy.source,
            "recorded_at": occupancy.recorded_at,
        })

    return {"room_count": room_count, "readings": readings}


@app.get(
    "/analytics/summary",
    response_model=AnalyticsSummaryResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def get_analytics_summary(
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    limit: int = Query(default=2000, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    """Read-only analytics summary and timestamped records; no live feed is implied."""
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

    buildings_total = db.query(func.count(models.Building.id)).scalar() or 0
    rooms_total = db.query(func.count(models.Room.id)).scalar() or 0

    occupancy_query = apply_period(
        db.query(models.RoomOccupancy, models.Room, models.Building)
        .join(models.Room, models.Room.id == models.RoomOccupancy.room_id)
        .outerjoin(models.Building, models.Building.id == models.Room.building_id),
        models.RoomOccupancy.recorded_at,
    )
    occupancy_count = occupancy_query.with_entities(func.count(models.RoomOccupancy.id)).scalar() or 0
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
    energy_count = energy_query.with_entities(func.count(models.EnergyReading.id)).scalar() or 0
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
    ).group_by(
        models.Building.building_code,
        models.Building.name,
        models.EnergyReading.reading_source,
    ).order_by(
        models.Building.building_code,
        models.EnergyReading.reading_source,
    ).all()

    maintenance_query = apply_period(
        db.query(models.MaintenanceRequest), models.MaintenanceRequest.created_at
    )
    maintenance_open = maintenance_query.filter(
        func.upper(models.MaintenanceRequest.status) == "OPEN",
        models.MaintenanceRequest.resolved_at.is_(None),
    ).with_entities(func.count(models.MaintenanceRequest.id)).scalar() or 0
    maintenance_resolved = maintenance_query.filter(
        models.MaintenanceRequest.resolved_at.isnot(None)
    ).with_entities(func.count(models.MaintenanceRequest.id)).scalar() or 0

    # Utilization is meaningful only when every verified room has a positive
    # capacity and a latest occupancy reading.
    capacity_stats = db.query(
        func.count(models.Room.id),
        func.count(models.Room.id).filter(models.Room.capacity.isnot(None), models.Room.capacity > 0),
        func.sum(models.Room.capacity),
    ).one()
    latest_occupancy = db.query(
        models.RoomOccupancy.room_id.label("room_id"),
        models.RoomOccupancy.occupied_count.label("occupied_count"),
        func.row_number().over(
            partition_by=models.RoomOccupancy.room_id,
            order_by=(models.RoomOccupancy.recorded_at.desc().nullslast(), models.RoomOccupancy.id.desc()),
        ).label("reading_rank"),
    ).subquery()
    latest_stats = db.query(
        func.count(latest_occupancy.c.room_id),
        func.sum(latest_occupancy.c.occupied_count),
    ).filter(latest_occupancy.c.reading_rank == 1).one()
    utilization_percent = None
    room_count, rooms_with_capacity, total_capacity = capacity_stats
    readings_for_rooms, total_occupancy = latest_stats
    if room_count and rooms_with_capacity == room_count and readings_for_rooms == room_count and total_capacity:
        utilization_percent = round(float(total_occupancy or 0) / float(total_capacity) * 100, 2)

    return {
        "period": {"start": start_utc, "end": end_utc},
        "buildings_total": buildings_total,
        "verified_rooms_total": rooms_total,
        "occupancy_readings_total": occupancy_count,
        "energy_readings_total": energy_count,
        "maintenance_open_total": maintenance_open,
        "maintenance_resolved_total": maintenance_resolved,
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
                "label": item.label
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
            "description": building.description
        }
        for building in buildings
    ]

