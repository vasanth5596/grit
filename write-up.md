# GRIT interview scheduling — product write-up

## 1. Target student journey and state transitions

The state machine below describes intended product behavior; it is not a claim that every state or transition exists in the current prototype. The prototype supports eligibility checks when booking, booking and cancellation, and recording `pass`, `fail`, or `retake` outcomes with feedback. It does not implement eligibility synchronization, rescheduling, an in-progress state, attendance/no-show tracking, cooldowns, appeals, malpractice revocation, outbound notifications, or leaderboard updates.

| State                         | Entry / transition                                                                                                                                                                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Not eligible**        | Required badge skill levels are incomplete or the student fails a programme eligibility check. Skill/eligibility sync makes them **Eligible to book**.                                                                                                         |
| **Eligible to book**    | All badge skills are cleared and programme eligibility is confirmed. Student books an open slot → **Booked**.                                                                                                                                                 |
| **Booked**              | The slot is reserved and confirmation is shown in the application. The target product may allow rescheduling or cancellation according to a defined cutoff; the prototype supports cancellation before an outcome, but not rescheduling or a cutoff policy. Interview start → **In progress** is a target transition, not implemented. |
| **In progress**         | Interviewer has started the session. Interviewer records a decision → **Passed**, **Not passed**, or **Retake recommended**.                                                                                                                      |
| **Passed**              | Target: award the badge and update the dashboard/leaderboard. In the prototype, a recorded pass appears on the dashboard and prevents another booking for that student; there is no separate badge-award record or leaderboard. Later verified malpractice → **Revoked** is a target transition, not implemented. |
| **Not passed**          | Feedback is visible. After a configurable cooldown and eligibility recheck → **Eligible to book** for another attempt.                                                                                                                                        |
| **Retake recommended**  | Not a pass; feedback and retake guidance are visible. Student books another slot when ready → **Booked**.                                                                                                                                                     |
| **No-show / cancelled** | Target: record no-show separately from an outcome, notify the student and team, then allow rebooking under policy. The prototype supports student cancellation; it does not track no-shows or send notifications. |
| **Revoked**             | Target: a verified malpractice decision nullifies the badge, preserves interview history, removes badge credit, and provides notice and an appeal path. This state is not implemented in the prototype. |

The target model is badge-specific, so a student could have different interview states for different track badges. The prototype stores one badge string per student and enforces at most one active booking per student overall (not one per badge). In PostgreSQL, booking uses a row lock and database uniqueness constraints to prevent multiple active bookings for a slot or student.

## 2. Edge cases and assumptions

- **Eligibility changes after booking:** re-check before confirmation and before the interview; do not silently delete a booking. Hold it for team review and notify both parties if eligibility is revoked.
- **Concurrent booking / interviewer edits:** atomically reserve a slot; reject stale selections with refreshed availability. Prevent editing/removing a booked slot unless the booking is first moved/cancelled.
- **Interviewer unavailable, student reschedule/cancel, or interviewer cancellation:** retain the audit history, release the old slot, notify both parties, and offer alternatives. Define a cancellation cutoff and escalation owner.
- **No-show, late arrival, connectivity failure, interviewer absence:** record attendance separately from pass/fail; define a grace period and whether a free rebook is allowed. Do not infer failure from absence.
- **Retake vs fail:** both are non-pass; retake is guidance, not a second result category implying eligibility. Policy must define attempt limits, cooldown, and appeal process.
- **Result correction / malpractice after a pass:** require authorized, reasoned, timestamped changes; preserve old values. Keep badge revocation distinct from interview outcome and provide notice/appeal.
- **Time zones and accessibility:** the prototype stores interview dates and times as timezone-naive values and labels displayed times IST. For the target product, define timezone storage/conversion, display the confirmed zone, and provide accessible keyboard controls, captions/alternate accommodations, and reminders.
- **Privacy and notifications:** the prototype has no login, role-based authorization, or outbound notification integration. For the target product, disclose what feedback is visible, limit team access by role, and deliver booking/result messages in the dashboard and configured notification channel.

**Assumptions to confirm:** 30-minute online interviews; whether to support multiple badge tracks per student; interview team owns eligibility overrides; student may rebook after a fail/retake; malpractice is a verified administrative decision, not an interviewer outcome. The prototype uses 30-minute slots and currently allows only one active booking per student overall. Cooldown, attendance grace period, retake limits, cancellation cutoff, appeal process, and notification channels need policy-owner sign-off.

## 3. Data model

The current application uses four SQLAlchemy tables. PostgreSQL is used when configured for the hosted deployment; SQLite is the local-development default:

- **Student** (`students`): `id` (primary key), `name`, `email` (unique), `badge`, `eligible`, `skills_cleared`, `skills_required`, `created_at`.
- **Interviewer** (`interviewers`): `id` (primary key), `name`, `email` (unique), `created_at`.
- **AvailabilitySlot** (`availability_slots`): `id` (primary key), `interviewer` (name stored as text), `date`, `start`, `end`, `status`. An index covers (`date`, `status`). The interviewer name is not a foreign key to `interviewers`.
- **Booking** (`bookings`): `id` (primary key), `student_id` (foreign key to `students.id`), `slot_id` (foreign key to `availability_slots.id`), `status`, nullable `outcome`, nullable `feedback`, `booked_at`, nullable `completed_at`. Partial unique indexes on `slot_id` and `student_id`, each where `status = 'booked'`, prevent a slot or student from having more than one active booking. Another index covers `status`.

The current schema does not have separate badge, skill-clearance, eligibility-snapshot, attendance, award, malpractice, notification, or audit-event tables. `badge` and eligibility/skill counts are stored directly on `students`; outcome and feedback are stored on `bookings`. The SQLAlchemy models do not declare `CHECK` constraints for status or outcome values, while [backend/schema.sql](./backend/schema.sql) does. Startup `create_all()` creates missing tables but does not migrate existing tables, so do not assume the DDL checks exist in an already-created database without inspecting it.

## Student-facing copy

1. **Ready (shown in the prototype):** “You’ve cleared every required skill for AI Product Mastery. Book your level clearance interview to complete this badge.”
2. **Booked (suggested copy):** “Your interview is booked for [date] at [time] IST with [interviewer]. Join online a few minutes early.” The prototype shows booking confirmation in the dashboard; it does not send this message, offer rescheduling, or enforce a 24-hour cancellation cutoff.
3. **Passed (dashboard preview):** “Congratulations, [first name] — you passed! Your AI Product Mastery Novice badge is now unlocked.” The prototype includes an “After pass” dashboard preview; selecting it previews the passed state and does not itself record an interview result.

The prototype includes student booking and live status, interviewer availability and daily outcome recording, student and interviewer directory management, the eligible-student booking queue, CSV roster export, and before/after-pass dashboard previews. Application data and interactions are persisted through the FastAPI backend to the configured database (PostgreSQL when configured for hosting; SQLite by default for local development).
