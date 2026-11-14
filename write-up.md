# GRIT interview scheduling — product write-up

## 1. Student journey and state transitions

| State                         | Entry / transition                                                                                                                                                                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Not eligible**        | Required badge skill levels are incomplete or the student fails a programme eligibility check. Skill/eligibility sync makes them **Eligible to book**.                                                                                                         |
| **Eligible to book**    | All badge skills are cleared and programme eligibility is confirmed. Student books an open slot → **Booked**.                                                                                                                                                 |
| **Booked**              | Slot is reserved and confirmation sent. Student may reschedule/cancel before the cutoff → **Eligible to book**; interview start → **In progress**. Slot cancellation by interviewer/admin → **Eligible to book** with a prompt to choose again. |
| **In progress**         | Interviewer has started the session. Interviewer records a decision → **Passed**, **Not passed**, or **Retake recommended**.                                                                                                                      |
| **Passed**              | Badge is awarded and dashboard/leaderboard update. Later verified malpractice flag → **Revoked** and badge/miles are recalculated with an audit record.                                                                                                       |
| **Not passed**          | Feedback is visible. After a configurable cooldown and eligibility recheck → **Eligible to book** for another attempt.                                                                                                                                        |
| **Retake recommended**  | Not a pass; feedback and retake guidance are visible. Student books another slot when ready → **Booked**.                                                                                                                                                     |
| **No-show / cancelled** | No-show is recorded separately from an outcome; notify student and team, then allow rebooking under policy. Student cancellation returns to **Eligible to book**.                                                                                              |
| **Revoked**             | A verified malpractice decision nullifies the badge. Notify student, preserve the interview/result history, remove badge credit, and provide an appeal path. Not bookable for that badge while the flag stands.                                                      |

States are badge-specific: a student can have different interview states for different track badges. Booking should use a transactional slot lock; only an eligible student can book, and a slot can have at most one active booking.

## 2. Edge cases and assumptions

- **Eligibility changes after booking:** re-check before confirmation and before the interview; do not silently delete a booking. Hold it for team review and notify both parties if eligibility is revoked.
- **Concurrent booking / interviewer edits:** atomically reserve a slot; reject stale selections with refreshed availability. Prevent editing/removing a booked slot unless the booking is first moved/cancelled.
- **Interviewer unavailable, student reschedule/cancel, or interviewer cancellation:** retain the audit history, release the old slot, notify both parties, and offer alternatives. Define a cancellation cutoff and escalation owner.
- **No-show, late arrival, connectivity failure, interviewer absence:** record attendance separately from pass/fail; define a grace period and whether a free rebook is allowed. Do not infer failure from absence.
- **Retake vs fail:** both are non-pass; retake is guidance, not a second result category implying eligibility. Policy must define attempt limits, cooldown, and appeal process.
- **Result correction / malpractice after a pass:** require authorized, reasoned, timestamped changes; preserve old values. Keep badge revocation distinct from interview outcome and provide notice/appeal.
- **Time zones and accessibility:** store UTC plus the student's/interviewer's zone; display the confirmed zone, provide accessible keyboard controls, captions/alternate accommodations, and reminders.
- **Privacy and notifications:** disclose what feedback is visible, limit team access by role, and deliver booking/result messages in dashboard plus the configured notification channel.

**Assumptions to confirm:** 30-minute online interviews; one active booking per student per badge; interview team owns eligibility overrides; student may rebook after a fail/retake; malpractice is a verified administrative decision, not an interviewer outcome. Cooldown, attendance grace period, retake limits, cancellation cutoff, appeal process, and notification channels need policy-owner sign-off.

## 3. Data model

The current application uses four SQLAlchemy tables in PostgreSQL (Supabase in the deployed configuration):

- **Student** (`students`): `id` (primary key), `name`, `email` (unique), `badge`, `eligible`, `skills_cleared`, `skills_required`, `created_at`.
- **Interviewer** (`interviewers`): `id` (primary key), `name`, `email` (unique), `created_at`.
- **AvailabilitySlot** (`availability_slots`): `id` (primary key), `interviewer` (name stored as text), `date`, `start`, `end`, `status`. An index covers (`date`, `status`). The interviewer name is not a foreign key to `interviewers`.
- **Booking** (`bookings`): `id` (primary key), `student_id` (foreign key to `students.id`), `slot_id` (foreign key to `availability_slots.id`), `status`, nullable `outcome`, nullable `feedback`, `booked_at`, nullable `completed_at`. Partial unique indexes on `slot_id` and `student_id`, each where `status = 'booked'`, prevent a slot or student from having more than one active booking. Another index covers `status`.

The current schema does not have separate badge, skill-clearance, eligibility-snapshot, attendance, award, malpractice, notification, or audit-event tables. `badge` and eligibility/skill counts are stored directly on `students`; outcome and feedback are stored on `bookings`. The live PostgreSQL schema has no `CHECK` constraints for status or outcome values. Although [backend/schema.sql](./backend/schema.sql) declares such checks, they are not declared by the SQLAlchemy models and are not present in the inspected live database. Startup table creation does not migrate existing tables.

## Student messages 

1. **Ready:** “You’ve cleared every required skill for AI Product Mastery. Book your level clearance interview to complete this badge.”
2. **Booked:** “Your interview is booked for [date] at [time] IST with [interviewer]. Join online a few minutes early. You can reschedule or cancel up to 24 hours before your interview.”
3. **Passed:** “Congratulations, [first name] — you passed! Your AI Product Mastery Novice badge is now unlocked.”

The prototype includes student booking and live status, interviewer availability and daily outcome recording, the eligible-student booking queue, and before/after-pass dashboard previews. Application data and interactions are persisted through the FastAPI backend to the configured database (Supabase PostgreSQL in the deployed configuration; SQLite by default for local development).
