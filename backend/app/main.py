import os
import re
import csv
import io
from uuid import uuid4
from contextlib import asynccontextmanager
from datetime import date, datetime, time, timedelta

from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from .database import Base, SessionLocal, engine, get_db
from .models import AvailabilitySlot, Booking, Interviewer, Student, utc_now
from .schemas import AdminOverview, BookingCreate, BookingRead, DashboardRead, InterviewerCreate, InterviewerRead, OutcomeCreate, SlotCreate, SlotRead, StudentCreate, StudentSummary, TeamRead

DEMO_STUDENT_ID = "student"
DEMO_INTERVIEWER = "Vasanth"
def seed_demo_data() -> None:
    with SessionLocal() as db:
        legacy_interviewer = db.scalar(select(Interviewer).where(Interviewer.name == "Mira Shah"))
        if legacy_interviewer is not None:
            legacy_interviewer.name = DEMO_INTERVIEWER
            db.query(AvailabilitySlot).filter(AvailabilitySlot.interviewer == "Mira Shah").update(
                {AvailabilitySlot.interviewer: DEMO_INTERVIEWER},
                synchronize_session=False,
            )
        if not db.scalar(select(Interviewer.id).limit(1)):
            db.add_all([
                Interviewer(id=str(uuid4()), name=DEMO_INTERVIEWER, email="vasanth@niat.edu"),
                Interviewer(id=str(uuid4()), name="Dev Patel", email="dev.patel@niat.edu"),
            ])
        if db.scalar(select(Student.id).limit(1)):
            db.commit()
            return
        students = [
            Student(id="student", name="Aanya Rao", email="aanya.rao@niat.edu", badge="AI Product · Novice", eligible=True),
            Student(id="arjun", name="Arjun Mehta", email="arjun.mehta@niat.edu", badge="AI Systems · Novice", eligible=True),
            Student(id="diya", name="Diya Nair", email="diya.nair@niat.edu", badge="AI Models · Specialist", eligible=True),
            Student(id="kabir", name="Kabir Sethi", email="kabir.sethi@niat.edu", badge="AI Product · Specialist", eligible=True),
            Student(id="meera", name="Meera Iyer", email="meera.iyer@niat.edu", badge="AI Robotics · Novice", eligible=False, skills_cleared=3),
        ]
        db.add_all(students)
        db.flush()
        slots = [
            AvailabilitySlot(interviewer=DEMO_INTERVIEWER, date=date(2026, 11, 13), start=time(10), end=time(10, 30), status="booked"),
            AvailabilitySlot(interviewer=DEMO_INTERVIEWER, date=date(2026, 11, 13), start=time(11), end=time(11, 30), status="booked"),
            AvailabilitySlot(interviewer=DEMO_INTERVIEWER, date=date(2026, 11, 14), start=time(14), end=time(14, 30)),
            AvailabilitySlot(interviewer=DEMO_INTERVIEWER, date=date(2026, 11, 14), start=time(15), end=time(15, 30)),
            AvailabilitySlot(interviewer="Dev Patel", date=date(2026, 11, 14), start=time(14), end=time(14, 30)),
        ]
        db.add_all(slots)
        db.flush()
        db.add_all([
            Booking(student_id="arjun", slot_id=slots[0].id),
            Booking(student_id="kabir", slot_id=slots[1].id),
        ])
        db.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    if os.getenv("SEED_DEMO_DATA", "true").lower() == "true":
        seed_demo_data()
    yield


app = FastAPI(title="GRIT Interview API", version="1.0.0", lifespan=lifespan)
cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def booking_query():
    return select(Booking).options(joinedload(Booking.student), joinedload(Booking.slot))


def as_booking_read(booking: Booking) -> BookingRead:
    return BookingRead(
        id=booking.id,
        student_id=booking.student_id,
        status=booking.status,
        outcome=booking.outcome,
        feedback=booking.feedback,
        booked_at=booking.booked_at.isoformat(),
        student=booking.student,
        slot=booking.slot,
    )


@app.get("/api/health")
def health():
    return {"status": "ok", "database": "postgresql" if engine.dialect.name == "postgresql" else "sqlite"}


def validate_email(email: str) -> str:
    normalized = email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    return normalized


@app.post("/api/admin/students", response_model=StudentSummary, status_code=status.HTTP_201_CREATED)
def create_student(payload: StudentCreate, db: Session = Depends(get_db)):
    student = Student(
        id=str(uuid4()),
        name=payload.name.strip(),
        email=validate_email(payload.email),
        badge=payload.badge.strip(),
        eligible=payload.eligible,
        skills_cleared=4 if payload.eligible else 0,
        skills_required=4,
    )
    db.add(student)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="A student with that email already exists.") from error
    db.refresh(student)
    return student


@app.post("/api/admin/interviewers", response_model=InterviewerRead, status_code=status.HTTP_201_CREATED)
def create_interviewer(payload: InterviewerCreate, db: Session = Depends(get_db)):
    interviewer = Interviewer(
        id=str(uuid4()),
        name=payload.name.strip(),
        email=validate_email(payload.email),
    )
    db.add(interviewer)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="An interviewer with that email already exists.") from error
    db.refresh(interviewer)
    return interviewer


@app.get("/api/admin/roster.csv")
def download_admin_roster(db: Session = Depends(get_db)):
    students = db.scalars(select(Student).order_by(Student.name)).all()
    bookings = db.scalars(booking_query().order_by(Booking.booked_at.desc())).unique().all()
    latest_booking_by_student: dict[str, Booking] = {}
    for booking in bookings:
        latest_booking_by_student.setdefault(booking.student_id, booking)

    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow([
        "Student",
        "Email",
        "Badge / track",
        "Eligible",
        "Skills cleared",
        "Skills required",
        "Booking status",
        "Interview date",
        "Interview time",
        "Interviewer",
        "Outcome",
        "Feedback",
    ])
    for student in students:
        booking = latest_booking_by_student.get(student.id)
        writer.writerow([
            student.name,
            student.email,
            student.badge,
            "Yes" if student.eligible else "No",
            student.skills_cleared,
            student.skills_required,
            booking.status if booking else "Not booked",
            booking.slot.date.isoformat() if booking else "",
            booking.slot.start.isoformat(timespec="minutes") if booking else "",
            booking.slot.interviewer if booking else "",
            (booking.outcome or "Pending") if booking else "Pending",
            (booking.feedback or "") if booking else "",
        ])
    return Response(
        content=f"\ufeff{output.getvalue()}",
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="grit-interview-roster.csv"'},
    )


@app.get("/api/students/{student_id}/dashboard", response_model=DashboardRead)
def student_dashboard(student_id: str, db: Session = Depends(get_db)):
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found.")
    bookings = db.scalars(
        booking_query().where(Booking.student_id == student_id).order_by(Booking.booked_at.desc())
    ).unique().all()
    return DashboardRead(
        student=student,
        latest_booking=as_booking_read(bookings[0]) if bookings else None,
        history=[as_booking_read(booking) for booking in bookings],
    )


@app.get("/api/slots", response_model=list[SlotRead])
def available_slots(
    badge: str | None = None,
    student_id: str = Query(default=DEMO_STUDENT_ID),
    db: Session = Depends(get_db),
):
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found.")
    if not student.eligible:
        raise HTTPException(status_code=403, detail="Complete your badge skills before booking an interview.")
    today = datetime.now().date()
    return db.scalars(
        select(AvailabilitySlot)
        .where(AvailabilitySlot.status == "open", AvailabilitySlot.date >= today)
        .order_by(AvailabilitySlot.date, AvailabilitySlot.start)
    ).all()


@app.post("/api/bookings", response_model=BookingRead, status_code=status.HTTP_201_CREATED)
def create_booking(payload: BookingCreate, db: Session = Depends(get_db)):
    student = db.get(Student, payload.student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found.")
    if not student.eligible or student.skills_cleared < student.skills_required:
        raise HTTPException(status_code=403, detail="This student is not eligible to book this interview.")
    existing_bookings = db.scalars(select(Booking).where(Booking.student_id == student.id)).all()
    if any(booking.outcome == "pass" for booking in existing_bookings):
        raise HTTPException(status_code=409, detail="This badge has already been awarded.")
    active_booking = db.scalar(select(Booking.id).where(Booking.student_id == student.id, Booking.status == "booked"))
    if active_booking:
        raise HTTPException(status_code=409, detail="You already have an active interview booking.")
    slot = db.scalar(
        select(AvailabilitySlot).where(AvailabilitySlot.id == payload.slot_id).with_for_update()
    )
    if slot is None or slot.status != "open":
        raise HTTPException(status_code=409, detail="That interview slot is no longer available.")
    if datetime.combine(slot.date, slot.start) < datetime.now():
        raise HTTPException(status_code=409, detail="That interview slot has already passed.")
    slot.status = "booked"
    booking = Booking(student_id=student.id, slot=slot)
    db.add(booking)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="That student or slot already has an active booking.") from error
    booking = db.scalars(booking_query().where(Booking.id == booking.id)).unique().one()
    return as_booking_read(booking)


@app.post("/api/bookings/{booking_id}/cancel", response_model=BookingRead)
def cancel_booking(booking_id: int, db: Session = Depends(get_db)):
    booking = db.scalars(booking_query().where(Booking.id == booking_id).with_for_update(of=Booking)).unique().one_or_none()
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if booking.status != "booked":
        raise HTTPException(status_code=409, detail="Only an active booking can be cancelled.")
    booking.status = "cancelled"
    booking.slot.status = "open"
    db.commit()
    return as_booking_read(booking)


@app.post("/api/bookings/{booking_id}/outcome", response_model=BookingRead)
def record_outcome(booking_id: int, payload: OutcomeCreate, db: Session = Depends(get_db)):
    booking = db.scalars(booking_query().where(Booking.id == booking_id).with_for_update(of=Booking)).unique().one_or_none()
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if booking.status != "booked":
        raise HTTPException(status_code=409, detail="This booking already has a recorded outcome or is cancelled.")
    booking.status = "completed"
    booking.outcome = payload.outcome
    booking.feedback = payload.feedback.strip()
    booking.completed_at = utc_now()
    db.commit()
    return as_booking_read(booking)


@app.get("/api/interviewer/schedule", response_model=list[BookingRead])
def interviewer_schedule(
    schedule_date: date = Query(default_factory=date.today, alias="date"),
    interviewer: str = DEMO_INTERVIEWER,
    db: Session = Depends(get_db),
):
    return [
        as_booking_read(booking)
        for booking in db.scalars(
            booking_query()
            .join(AvailabilitySlot)
            .where(
                AvailabilitySlot.date == schedule_date,
                AvailabilitySlot.interviewer == interviewer,
                Booking.status != "cancelled",
            )
            .order_by(AvailabilitySlot.start)
        ).unique().all()
    ]


@app.get("/api/interviewer/availability", response_model=list[SlotRead])
def interviewer_availability(interviewer: str = DEMO_INTERVIEWER, db: Session = Depends(get_db)):
    return db.scalars(
        select(AvailabilitySlot)
        .where(AvailabilitySlot.interviewer == interviewer, AvailabilitySlot.date >= datetime.now().date())
        .order_by(AvailabilitySlot.date, AvailabilitySlot.start)
    ).all()


@app.post("/api/interviewer/availability", response_model=SlotRead, status_code=status.HTTP_201_CREATED)
def create_availability(payload: SlotCreate, db: Session = Depends(get_db)):
    if payload.date < datetime.now().date():
        raise HTTPException(status_code=422, detail="Availability must be on a future date.")
    start = payload.start.replace(second=0, microsecond=0)
    end_dt = datetime.combine(date.today(), start) + timedelta(minutes=30)
    end = end_dt.time()
    duplicate = db.scalar(
        select(AvailabilitySlot.id).where(
            AvailabilitySlot.interviewer == payload.interviewer,
            AvailabilitySlot.date == payload.date,
            AvailabilitySlot.start == start,
        )
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="That availability slot already exists.")
    slot = AvailabilitySlot(interviewer=payload.interviewer, date=payload.date, start=start, end=end)
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@app.delete("/api/interviewer/availability/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_availability(slot_id: int, db: Session = Depends(get_db)):
    slot = db.scalar(select(AvailabilitySlot).where(AvailabilitySlot.id == slot_id).with_for_update())
    if slot is None:
        raise HTTPException(status_code=404, detail="Availability slot not found.")
    if slot.status == "booked":
        raise HTTPException(status_code=409, detail="This slot has an active booking and cannot be removed.")
    db.delete(slot)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/team/roster", response_model=TeamRead)
def team_roster(db: Session = Depends(get_db)):
    students = db.scalars(select(Student).where(Student.eligible.is_(True)).order_by(Student.name)).all()
    ineligible = db.scalars(select(Student).where(Student.eligible.is_(False)).order_by(Student.name)).all()
    bookings = db.scalars(booking_query().order_by(Booking.booked_at.desc())).unique().all()
    eligible_ids = {student.id for student in students}
    eligible_bookings = [booking for booking in bookings if booking.student_id in eligible_ids]
    active_ids = {booking.student_id for booking in eligible_bookings if booking.status == "booked"}
    return TeamRead(
        students=students,
        ineligible=ineligible,
        bookings=[as_booking_read(booking) for booking in eligible_bookings],
        eligible_count=len(students),
        booked_count=len(active_ids),
        passed_count=sum(booking.outcome == "pass" for booking in eligible_bookings),
    )


@app.get("/api/admin/overview", response_model=AdminOverview)
def admin_overview(db: Session = Depends(get_db)):
    roster = team_roster(db)
    bookings = db.scalars(booking_query().order_by(Booking.booked_at.desc())).unique().all()
    availability = db.scalars(
        select(AvailabilitySlot).order_by(AvailabilitySlot.date, AvailabilitySlot.start)
    ).all()
    interviewers = db.scalars(select(Interviewer).order_by(Interviewer.name)).all()
    return AdminOverview(
        students=roster.students,
        ineligible=roster.ineligible,
        bookings=[as_booking_read(booking) for booking in bookings],
        eligible_count=roster.eligible_count,
        booked_count=roster.booked_count,
        passed_count=roster.passed_count,
        availability=availability,
        interviewers=interviewers,
        interviewer_count=len(interviewers),
    )
