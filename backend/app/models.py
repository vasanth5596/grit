from datetime import date, datetime, time as time_type, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text, Time, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Student(Base):
    __tablename__ = "students"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    badge: Mapped[str] = mapped_column(String(160), nullable=False)
    eligible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    skills_cleared: Mapped[int] = mapped_column(Integer, default=4, nullable=False)
    skills_required: Mapped[int] = mapped_column(Integer, default=4, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    bookings: Mapped[list["Booking"]] = relationship(back_populates="student")


class Interviewer(Base):
    __tablename__ = "interviewers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class AvailabilitySlot(Base):
    __tablename__ = "availability_slots"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    interviewer: Mapped[str] = mapped_column(String(120), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    start: Mapped[time_type] = mapped_column(Time, nullable=False)
    end: Mapped[time_type] = mapped_column(Time, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="open", nullable=False)
    bookings: Mapped[list["Booking"]] = relationship(back_populates="slot")

    __table_args__ = (
        Index("ix_availability_date_status", "date", "status"),
    )


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), nullable=False)
    slot_id: Mapped[int] = mapped_column(ForeignKey("availability_slots.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="booked", nullable=False)
    outcome: Mapped[str | None] = mapped_column(String(16))
    feedback: Mapped[str | None] = mapped_column(Text)
    booked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    student: Mapped[Student] = relationship(back_populates="bookings")
    slot: Mapped[AvailabilitySlot] = relationship(back_populates="bookings")

    __table_args__ = (
        Index("uq_bookings_active_slot", "slot_id", unique=True, sqlite_where=text("status = 'booked'"), postgresql_where=text("status = 'booked'")),
        Index("uq_bookings_active_student", "student_id", unique=True, sqlite_where=text("status = 'booked'"), postgresql_where=text("status = 'booked'")),
        Index("ix_bookings_status", "status"),
    )
