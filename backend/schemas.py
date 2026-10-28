
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional


class BuildingResponse(BaseModel):
    id: int
    building_code: str
    name: str
    description: Optional[str] = None
    is_demo: bool = False

    model_config = ConfigDict(from_attributes=True)


class RoomResponse(BaseModel):
    id: int
    building_id: Optional[int] = None
    room_code: str
    room_name: Optional[str] = None
    floor_number: int
    capacity: Optional[int] = None
    room_type: str
    is_demo: bool = False

    model_config = ConfigDict(from_attributes=True)


class RoomCreateRequest(BaseModel):
    building_code: str = Field(min_length=1, max_length=30, strict=True)
    room_code: str = Field(min_length=1, max_length=30, strict=True)
    room_name: str | None = Field(default=None, max_length=100, strict=True)
    floor_number: int = Field(strict=True)
    capacity: int = Field(strict=True, ge=0)
    room_type: str = Field(min_length=1, max_length=30, strict=True)

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("room_name", mode="before")
    @classmethod
    def blank_room_name_is_none(cls, value):
        if isinstance(value, str) and not value.strip():
            return None
        return value


class NoticeResponse(BaseModel):
    id: int
    title: str
    content: str
    published: bool
    created_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_demo: bool = False

    model_config = ConfigDict(from_attributes=True)


class NoticeCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200, strict=True)
    content: str = Field(min_length=1, strict=True)
    published: bool = True
    expires_at: Optional[datetime] = None

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="after")
    def expiry_must_be_future(self):
        if self.expires_at is not None:
            expiry = self.expires_at
            if expiry.tzinfo is None:
                raise ValueError("expires_at must include a timezone")
            now = datetime.now(expiry.tzinfo) if expiry.tzinfo else datetime.now()
            if expiry <= now:
                raise ValueError("expires_at must be in the future")
        return self


class NoticeUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200, strict=True)
    content: str | None = Field(default=None, min_length=1, strict=True)
    published: bool | None = None
    expires_at: datetime | None = None

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_update(self):
        if not self.model_fields_set:
            raise ValueError("At least one notice field must be provided")
        if "title" in self.model_fields_set and self.title is None:
            raise ValueError("title cannot be null")
        if "content" in self.model_fields_set and self.content is None:
            raise ValueError("content cannot be null")
        if "published" in self.model_fields_set and self.published is None:
            raise ValueError("published cannot be null")
        if self.expires_at is not None:
            if self.expires_at.tzinfo is None:
                raise ValueError("expires_at must include a timezone")
            if self.expires_at <= datetime.now(self.expires_at.tzinfo):
                raise ValueError("expires_at must be in the future")
        return self


class BookingCreateRequest(BaseModel):
    room_id: int = Field(gt=0, strict=True)
    purpose: str = Field(min_length=1, max_length=255, strict=True)
    start_time: datetime
    end_time: datetime

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_booking_interval(self):
        if self.start_time.tzinfo is None or self.end_time.tzinfo is None:
            raise ValueError("Booking times must include a timezone")
        if self.start_time >= self.end_time:
            raise ValueError("start_time must be earlier than end_time")
        if self.start_time <= datetime.now(self.start_time.tzinfo):
            raise ValueError("start_time must be in the future")
        return self


class BookingStatusUpdateRequest(BaseModel):
    status: str = Field(pattern="^(APPROVED|REJECTED)$")


class BookingResponse(BaseModel):
    id: int
    user_id: int
    room_id: int
    room_code: str
    room_name: Optional[str] = None
    is_demo: bool = False
    building_code: Optional[str] = None
    purpose: str
    start_time: datetime
    end_time: datetime
    status: str
    source: str = "DATABASE"
    created_at: Optional[datetime] = None


class MaintenanceRequestCreateRequest(BaseModel):
    room_id: int = Field(gt=0, strict=True)
    title: str = Field(min_length=1, max_length=150, strict=True)
    description: str = Field(min_length=1, max_length=5000, strict=True)
    priority: str = Field(default="MEDIUM", pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")

    model_config = ConfigDict(str_strip_whitespace=True)


class MaintenanceRequestStatusUpdateRequest(BaseModel):
    status: str = Field(pattern="^(OPEN|IN_PROGRESS|RESOLVED)$")


class MaintenanceRequestResponse(BaseModel):
    id: int
    room_id: int
    room_code: str
    is_demo: bool = False
    room_name: Optional[str] = None
    building_code: Optional[str] = None
    building_name: Optional[str] = None
    reported_by: Optional[int] = None
    reporter_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    priority: str
    status: str
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None


class EmergencyAlertCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200, strict=True)
    message: str = Field(min_length=1, strict=True)
    severity: str = Field(default="MEDIUM", pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")
    expires_at: Optional[datetime] = None

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="after")
    def expiry_must_be_future(self):
        if self.expires_at is not None:
            if self.expires_at.tzinfo is None:
                raise ValueError("expires_at must include a timezone")
            now = datetime.now(self.expires_at.tzinfo) if self.expires_at.tzinfo else datetime.now()
            if self.expires_at <= now:
                raise ValueError("expires_at must be in the future")
        return self


class EmergencyAlertResponse(BaseModel):
    id: int
    title: str
    message: str
    severity: str
    active: bool
    created_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_demo: bool = False


class OccupancyReadingResponse(BaseModel):
    id: int
    room_id: int
    room_code: str
    is_demo: bool = False
    room_name: Optional[str] = None
    building_code: Optional[str] = None
    building_name: Optional[str] = None
    floor_number: int
    capacity: Optional[int] = None
    occupied_count: int = Field(ge=0)
    source: Optional[str] = None
    recorded_at: Optional[datetime] = None


class OccupancyDashboardResponse(BaseModel):
    room_count: int = Field(ge=0)
    demo_preview: bool = False
    readings: list[OccupancyReadingResponse]


class EnergyReadingResponse(BaseModel):
    id: int
    building_id: int
    building_code: str
    building_name: str
    energy_kwh: Decimal = Field(ge=0)
    reading_source: Optional[str] = None
    recorded_at: Optional[datetime] = None


class EnergyReadingsResponse(BaseModel):
    unit: str = "kWh"
    limit: int = Field(ge=1)
    truncated: bool
    readings: list[EnergyReadingResponse]


class AnalyticsPeriod(BaseModel):
    start: Optional[datetime] = None
    end: Optional[datetime] = None


class AnalyticsOccupancyPoint(BaseModel):
    id: int
    room_id: int
    room_code: str
    building_code: Optional[str] = None
    building_name: Optional[str] = None
    occupied_count: int = Field(ge=0)
    source: Optional[str] = None
    is_demo: bool = False
    recorded_at: Optional[datetime] = None


class AnalyticsEnergyPoint(BaseModel):
    id: int
    building_code: str
    building_name: str
    energy_kwh: Decimal = Field(ge=0)
    source: Optional[str] = None
    is_demo: bool = False
    recorded_at: Optional[datetime] = None


class AnalyticsBuildingEnergyComparison(BaseModel):
    building_code: str
    building_name: str
    source: Optional[str] = None
    average_kwh_per_reading: Decimal
    reading_count: int = Field(ge=1)


class AnalyticsSummaryResponse(BaseModel):
    period: AnalyticsPeriod
    demo_preview: bool = False
    buildings_total: int = Field(ge=0)
    verified_rooms_total: int = Field(ge=0)
    demo_buildings_total: int = Field(default=0, ge=0)
    demo_rooms_total: int = Field(default=0, ge=0)
    occupancy_readings_total: int = Field(ge=0)
    demo_occupancy_readings_total: int = Field(default=0, ge=0)
    energy_readings_total: int = Field(ge=0)
    demo_energy_readings_total: int = Field(default=0, ge=0)
    maintenance_open_total: int = Field(ge=0)
    maintenance_resolved_total: int = Field(ge=0)
    demo_maintenance_open_total: int = Field(default=0, ge=0)
    demo_maintenance_resolved_total: int = Field(default=0, ge=0)
    room_utilization_percent: Optional[float] = Field(default=None, ge=0)
    occupancy_truncated: bool
    energy_truncated: bool
    occupancy_readings: list[AnalyticsOccupancyPoint]
    energy_readings: list[AnalyticsEnergyPoint]
    energy_by_building: list[AnalyticsBuildingEnergyComparison]


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=1024)


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)


class DemoResetLinkResponse(BaseModel):
    message: str
    reset_url: Optional[str] = None


class PasswordResetRequest(BaseModel):
    token: str = Field(min_length=32, max_length=128)
    new_password: str = Field(min_length=1, max_length=1024)
    confirm_password: str = Field(min_length=1, max_length=1024)

    @model_validator(mode="after")
    def validate_password(self):
        password = self.new_password
        if password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        categories = sum((
            any("a" <= char <= "z" for char in password),
            any("A" <= char <= "Z" for char in password),
            any("0" <= char <= "9" for char in password),
            any(not (char.isascii() and char.isalnum()) for char in password),
        ))
        if len(password) < 12 or categories < 3:
            raise ValueError("Use at least 12 characters and include at least three of: lowercase, uppercase, number, symbol.")
        return self


class AuthUserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthUserResponse
