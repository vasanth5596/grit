from datetime import date, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StudentSummary(BaseModel):
    id: str
    name: str
    email: str
    badge: str
    eligible: bool
    skills_cleared: int
    skills_required: int
    model_config = ConfigDict(from_attributes=True)


class StudentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=6, max_length=255)
    badge: str = Field(min_length=2, max_length=160)
    eligible: bool = True

    @field_validator("name", "badge")
    @classmethod
    def require_non_whitespace(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("This field cannot be blank.")
        return value.strip()


class InterviewerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=6, max_length=255)

    @field_validator("name")
    @classmethod
    def require_non_whitespace_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Name cannot be blank.")
        return value.strip()


class InterviewerRead(BaseModel):
    id: str
    name: str
    email: str
    model_config = ConfigDict(from_attributes=True)


class SlotCreate(BaseModel):
    interviewer: str = Field(min_length=2, max_length=120)
    date: date
    start: time


class SlotRead(BaseModel):
    id: int
    interviewer: str
    date: date
    start: time
    end: time
    status: str
    model_config = ConfigDict(from_attributes=True)


class BookingCreate(BaseModel):
    student_id: str
    slot_id: int


class BookingRead(BaseModel):
    id: int
    student_id: str
    status: str
    outcome: str | None
    feedback: str | None
    booked_at: str
    student: StudentSummary
    slot: SlotRead


class OutcomeCreate(BaseModel):
    outcome: Literal["pass", "fail", "retake"]
    feedback: str = Field(min_length=3, max_length=2000)


class DashboardRead(BaseModel):
    student: StudentSummary
    latest_booking: BookingRead | None
    history: list[BookingRead]


class TeamRead(BaseModel):
    students: list[StudentSummary]
    ineligible: list[StudentSummary]
    bookings: list[BookingRead]
    eligible_count: int
    booked_count: int
    passed_count: int


class AdminOverview(TeamRead):
    availability: list[SlotRead]
    interviewers: list[InterviewerRead]
    interviewer_count: int
