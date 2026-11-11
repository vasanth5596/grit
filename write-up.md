# GRIT interview scheduling — product write-up

## 1. Student journey and state transitions

| State | Entry / transition |
|---|---|
| **Not eligible** | Required badge skill levels are incomplete or the student fails a programme eligibility check. Skill/eligibility sync makes them **Eligible to book**. |
| **Eligible to book** | All badge skills are cleared and programme eligibility is confirmed. Student books an open slot → **Booked**. |
| **Booked** | Slot is reserved and confirmation sent. Student may reschedule/cancel before the cutoff → **Eligible to book**; interview start → **In progress**. Slot cancellation by interviewer/admin → **Eligible to book** with a prompt to choose again. |
| **In progress** | Interviewer has started the session. Interviewer records a decision → **Passed**, **Not passed**, or **Retake recommended**. |
| **Passed** | Badge is awarded and dashboard/leaderboard update. Later verified malpractice flag → **Revoked** and badge/miles are recalculated with an audit record. |
| **Not passed** | Feedback is visible. After a configurable cooldown and eligibility recheck → **Eligible to book** for another attempt. |
| **Retake recommended** | Not a pass; feedback and retake guidance are visible. Student books another slot when ready → **Booked**. |
| **No-show / cancelled** | No-show is recorded separately from an outcome; notify student and team, then allow rebooking under policy. Student cancellation returns to **Eligible to book**. |
| **Revoked** | A verified malpractice decision nullifies the badge. Notify student, preserve the interview/result history, remove badge credit, and provide an appeal path. Not bookable for that badge while the flag stands. |

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

- **Student**(`id`, `name`, `email`, `timezone`, `programme_status`)
- **BadgeRequirement**(`badge_id`, `skill_id`, `required_level`); **StudentSkillClearance**(`student_id`, `skill_id`, `level`, `cleared_at`)
- **EligibilitySnapshot**(`id`, `student_id`, `badge_id`, `eligible`, `reason`, `evaluated_at`, `source_version`) — auditable eligibility at booking/result time.
- **Interviewer**(`id`, `name`, `active`); **AvailabilitySlot**(`id`, `interviewer_id`, `starts_at_utc`, `ends_at_utc`, `status`, `version`) — status: open/held/booked/blocked.
- **InterviewBooking**(`id`, `student_id`, `badge_id`, `slot_id`, `status`, `booked_at`, `cancelled_at`, `cancel_reason`, `eligibility_snapshot_id`, `version`) — enforce one active booking per student+badge and one active booking per slot.
- **InterviewOutcome**(`id`, `booking_id`, `decision`, `feedback`, `recorded_by`, `recorded_at`, `supersedes_id`) — decision: pass/fail/retake; append corrections instead of overwriting.
- **Attendance**(`id`, `booking_id`, `student_status`, `interviewer_status`, `joined_at`, `left_at`, `notes`) — no-show is not an outcome.
- **BadgeAward**(`id`, `student_id`, `badge_id`, `booking_id`, `status`, `awarded_at`, `revoked_at`); **MalpracticeCase**(`id`, `student_id`, `badge_id`, `status`, `decision_by`, `decided_at`, `reason`, `appeal_status`) — audited revocation links to the affected award.
- **Notification**(`id`, `recipient_id`, `booking_id`, `type`, `channel`, `sent_at`, `delivery_status`); **AuditEvent**(`id`, `actor_id`, `entity_type`, `entity_id`, `action`, `before_json`, `after_json`, `created_at`).

Use database constraints/transactions for slot exclusivity, an append-only audit trail for results and revocations, and role-based authorization for interviewer outcomes and team eligibility overrides.

## Student messages (exact copy)

1. **Ready:** “You’ve cleared every required skill for AI Product Mastery. Book your level clearance interview to complete this badge.”
2. **Booked:** “Your interview is booked for [date] at [time] IST with [interviewer]. Join online a few minutes early. You can reschedule or cancel up to 24 hours before your interview.”
3. **Passed:** “Congratulations, [first name] — you passed! Your AI Product Mastery Novice badge is now unlocked.”

The prototype includes student booking and live status, interviewer availability and daily outcome recording, the eligible-student booking queue, and before/after-pass dashboard previews. Demo data and interactions are stored in the browser.
