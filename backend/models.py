
from sqlalchemy import (
    Column, BigInteger, Integer, String, Text,
    Boolean, Numeric, ForeignKey, DateTime, func,
    CheckConstraint
)
from database import Base

ID_TYPE = BigInteger().with_variant(Integer, "sqlite")


class User(Base):
    __tablename__ = "users"

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    role = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    user_id = Column(ID_TYPE, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Building(Base):
    __tablename__ = "buildings"

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    building_code = Column(String(30), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)

    @property
    def is_demo(self):
        return isinstance(self.building_code, str) and self.building_code.upper().startswith("DEMO-")


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = (
        CheckConstraint("capacity >= 0", name="rooms_capacity_check"),
    )

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    building_id = Column(BigInteger, ForeignKey("buildings.id"))
    room_code = Column(String(30), unique=True, nullable=False)
    room_name = Column(String(100))
    floor_number = Column(Integer, nullable=False)
    capacity = Column(Integer, default=0)
    room_type = Column(String(30), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    @property
    def is_demo(self):
        return isinstance(self.room_code, str) and self.room_code.upper().startswith("DEMO-")


class RoomOccupancy(Base):
    __tablename__ = "room_occupancy"
    __table_args__ = (
        CheckConstraint("occupied_count >= 0", name="room_occupancy_occupied_count_check"),
    )

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    room_id = Column(BigInteger, ForeignKey("rooms.id"), nullable=False)
    occupied_count = Column(Integer, nullable=False, default=0)
    source = Column(String(30), default="RECORDED_VIDEO")
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())


class RoomBooking(Base):
    __tablename__ = "room_bookings"

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    room_id = Column(BigInteger, ForeignKey("rooms.id"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    purpose = Column(String(255), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), nullable=False, default="PENDING")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    room_id = Column(BigInteger, ForeignKey("rooms.id"), nullable=False)
    reported_by = Column(BigInteger, ForeignKey("users.id"))
    title = Column(String(150), nullable=False)
    description = Column(Text)
    priority = Column(String(20), default="MEDIUM")
    status = Column(String(20), default="OPEN")
    qr_code_value = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True))


class Notice(Base):
    __tablename__ = "notices"

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    created_by = Column(BigInteger, ForeignKey("users.id"))
    published = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))

    @property
    def is_demo(self):
        return isinstance(self.title, str) and self.title.upper().startswith("DEMO ")


class EnergyReading(Base):
    __tablename__ = "energy_readings"
    __table_args__ = (
        CheckConstraint("energy_kwh >= 0", name="energy_readings_energy_kwh_check"),
    )

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    building_id = Column(BigInteger, ForeignKey("buildings.id"), nullable=False)
    energy_kwh = Column(Numeric(12, 3), nullable=False)
    reading_source = Column(String(30), default="SIMULATED")
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())


class EmergencyAlert(Base):
    __tablename__ = "emergency_alerts"

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False, default="MEDIUM")
    active = Column(Boolean, default=True)
    created_by = Column(BigInteger, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))

    @property
    def is_demo(self):
        return isinstance(self.title, str) and self.title.upper().startswith("DEMO ")


class BuildingFloorLabel(Base):
    __tablename__ = "building_floor_labels"

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    building_id = Column(
        BigInteger,
        ForeignKey("buildings.id"),
        nullable=False
    )
    floor_number = Column(Integer, nullable=False)
    label = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    @property
    def is_demo(self):
        return isinstance(self.label, str) and self.label.upper().startswith("DEMO ")
