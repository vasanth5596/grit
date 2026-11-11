import { useCallback, useEffect, useMemo, useState } from "react";

const STUDENT_ID = "student";
const INTERVIEWER = "Vasanth";
// const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const API_BASE_URL = "https://grit-yehv.onrender.com";
const BADGE_OPTIONS = ["AI Product", "AI Systems", "AI Models", "AI Robotics"].flatMap((track) =>
  ["Novice", "Specialist", "Expert", "Master", "Grand Master"].map((level) => `${track} · ${level}`),
);
const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const TIME_FORMAT = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
});

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `Request failed (${response.status}).`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function formatDate(value) {
  return DATE_FORMAT.format(new Date(`${value}T12:00:00`));
}

function formatTime(value) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return TIME_FORMAT.format(new Date(2026, 0, 1, hours, minutes));
}

function initials(name = "") {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function Pill({ children, tone = "neutral" }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function Card({ children, className = "", id }) {
  return <section id={id} className={`card ${className}`}>{children}</section>;
}

function Metric({ label, value, caption }) {
  return (
    <Card className="metric">
      <div className="label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-caption">{caption}</div>
    </Card>
  );
}

function Person({ student }) {
  return (
    <div className="person">
      <span className="avatar">{initials(student.name)}</span>
      <span>
        <strong>{student.name}</strong>
        <small>{student.email}</small>
      </span>
    </div>
  );
}

function PageHeading({ eyebrow, title, subtitle, aside }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p className="subtitle">{subtitle}</p>
      </div>
      {aside}
    </div>
  );
}

function BookingCard({ dashboard, slots, selectedSlot, setSelectedSlot, onBook, onCancel, busy }) {
  const booking = dashboard?.latest_booking;
  if (booking?.status === "booked") {
    return (
      <>
        <div className="appointment">
          <div className="date-tile">
            <b>{new Date(`${booking.slot.date}T12:00:00`).getDate()}</b>
            <small>{new Date(`${booking.slot.date}T12:00:00`).toLocaleDateString("en-IN", { month: "short" })}</small>
          </div>
          <div className="appointment-main">
            <strong>Interview booked · {formatTime(booking.slot.start)}</strong>
            <small>{formatDate(booking.slot.date)} · with {booking.slot.interviewer} · Online</small>
          </div>
          <Pill tone="booked">Confirmed</Pill>
        </div>
        <div className="notice">You can cancel before the interview. Please join online a few minutes early.</div>
        <button className="button small" onClick={onCancel} disabled={busy}>Cancel booking</button>
      </>
    );
  }
  if (booking?.outcome === "pass") {
    return <div className="notice success">Your interview is complete. Your Novice badge has been awarded.</div>;
  }

  const groupedSlots = slots.reduce((groups, slot) => {
    (groups[slot.date] ||= []).push(slot);
    return groups;
  }, {});

  return (
    <>
      {booking?.outcome && (
        <div className="notice warning">
          {booking.outcome === "retake"
            ? "Your interviewer recommended a retake. You can book a new slot when you’re ready."
            : "Your interview result is not a pass. Review the feedback and choose a new slot when you’re ready."}
        </div>
      )}
      {Object.entries(groupedSlots).map(([date, dateSlots]) => (
        <div key={date}>
          <div className="slot-head">{formatDate(date)}</div>
          <div className="slot-grid">
            {dateSlots.map((slot) => (
              <button
                type="button"
                key={slot.id}
                className={`slot ${selectedSlot === slot.id ? "selected" : ""}`}
                onClick={() => setSelectedSlot(slot.id)}
              >
                <strong>{formatTime(slot.start)} – {formatTime(slot.end)}</strong>
                <span>with {slot.interviewer} · Online</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {!slots.length && <div className="empty-state">No interview slots available right now. Check back soon.</div>}
      {slots.length > 0 && (
        <div className="confirm-row">
          <span className="label">Times shown in India Standard Time</span>
          <button className="button primary small" onClick={onBook} disabled={!selectedSlot || busy}>
            {busy ? "Booking…" : "Confirm slot"}
          </button>
        </div>
      )}
      <div className="footnote">Your booking is confirmed when it appears on this dashboard.</div>
    </>
  );
}

function StudentScreen({
  dashboard,
  slots,
  selectedSlot,
  setSelectedSlot,
  onBook,
  onCancel,
  busy,
  preview,
  setPreview,
}) {
  const student = dashboard?.student;
  const booking = dashboard?.latest_booking;
  if (!student) return <div className="empty-state">Loading your GRIT dashboard…</div>;
  const passed = preview === "after" || (preview !== "before" && booking?.outcome === "pass");
  return (
    <>
      <PageHeading
        eyebrow="Student dashboard"
        title={`Good morning, ${student.name.split(" ")[0]}`}
        subtitle="Your GRIT journey, all in one place."
        aside={<span className="demo-badge">Student view</span>}
      />
      <div id="student-overview" className="comparison card">
        <div>
          <strong>Student home screen comparison</strong>
          <div className="label">Preview the dashboard before or after an interview result.</div>
        </div>
        <div className="toggle-group" role="group" aria-label="Dashboard comparison">
          <button className={!preview || preview === "before" ? "active" : ""} onClick={() => setPreview("before")}>Before</button>
          <button className={preview === "after" ? "active" : ""} onClick={() => setPreview("after")}>After pass</button>
          <button className={preview === "live" ? "active" : ""} onClick={() => setPreview("live")}>Live demo</button>
        </div>
      </div>
      {passed ? (
        <>
          <div className="result-hero">
            <div>
              <div className="eyebrow">Interview complete · Novice badge</div>
              <h2>Congratulations, {student.name.split(" ")[0]} — you passed!</h2>
              <p>Your AI Product Mastery Novice badge is now unlocked. Your result is reflected in your GRIT progress.</p>
            </div>
            <div className="result-stamp">✓</div>
          </div>
          <div className="grid three section-gap">
            <Metric label="Badge status" value="Unlocked" caption="AI Product Mastery · Novice" />
            <Metric label="Interview result" value="Passed" caption={`Reviewed by ${booking?.slot.interviewer || INTERVIEWER}`} />
            <Metric label="Next step" value="Keep going" caption="Continue to your next badge" />
          </div>
          <Card className="card-pad section-gap">
            <div className="section-head"><h3 className="section-title">Your badge journey</h3><Pill tone="passed">Badge earned</Pill></div>
            <Milestones passed />
          </Card>
        </>
      ) : (
        <>
          <div className="status-card">
            <div>
              <div className="eyebrow">You’re one step away</div>
              <h2>Your Novice badge is within reach</h2>
              <p>You’ve cleared every required skill for AI Product Mastery. Book your level clearance interview to complete this badge.</p>
            </div>
            <button className="button primary" onClick={() => document.getElementById("booking-card")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
              Book an interview ↗
            </button>
          </div>
          <div className="grid three section-gap">
            <Metric label="Current track" value="AI Product" caption="Novice badge" />
            <div className="card metric">
              <div className="label">Skills cleared</div><div className="metric-value">{student.skills_cleared} / {student.skills_required}</div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${student.skills_cleared / student.skills_required * 100}%` }} /></div>
            </div>
            <Metric
              label="Interview"
              value={booking?.status === "booked" ? "Booked" : booking?.outcome ? "Result recorded" : "Not booked"}
              caption={booking?.status === "booked" ? `${formatDate(booking.slot.date)} · ${formatTime(booking.slot.start)}` : "Choose a time that works for you"}
            />
          </div>
          <div className="grid two section-gap">
            <Card className="card-pad">
              <div className="section-head"><h3 className="section-title">Novice badge checklist</h3><Pill tone={booking?.outcome === "pass" ? "passed" : "pending"}>{booking?.outcome === "pass" ? "Badge earned" : "Interview remaining"}</Pill></div>
              <Milestones passed={booking?.outcome === "pass"} />
            </Card>
            <Card className="card-pad" id="booking-card">
              <div className="section-head">
                <div><h3 className="section-title">{booking?.outcome ? "Book another interview" : "Available interview slots"}</h3><div className="label">30-minute online interview · India Standard Time</div></div>
              </div>
              <BookingCard dashboard={dashboard} slots={slots} selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot} onBook={onBook} onCancel={onCancel} busy={busy} />
            </Card>
          </div>
          {booking?.outcome && <Card className="card-pad section-gap">
            <div className="section-head"><h3 className="section-title">Latest interview feedback</h3><Pill tone={booking.outcome === "pass" ? "passed" : booking.outcome === "fail" ? "failed" : "retake"}>{booking.outcome === "retake" ? "Retake recommended" : booking.outcome === "pass" ? "Passed" : "Not passed"}</Pill></div>
            <p className="feedback">{booking.feedback}</p>
          </Card>}
          {preview === "before" && booking?.outcome === "pass" && <div className="notice section-gap">You’re previewing the before state. Select “Live demo” to return to your current interview result.</div>}
        </>
      )}
      <Card className="card-pad section-gap" id="student-history">
        <div className="section-head"><div><h3 className="section-title">Interview history</h3><div className="label">Your past bookings and decisions stay on your record.</div></div></div>
        {dashboard.history?.length ? <div className="history-list spaced-history">{dashboard.history.map((attempt) => (
          <div className="history-row" key={attempt.id}>
            <div><strong>{formatDate(attempt.slot.date)} · {formatTime(attempt.slot.start)}</strong><small>{attempt.slot.interviewer}</small></div>
            <Pill tone={attempt.outcome === "pass" ? "passed" : attempt.outcome === "fail" ? "failed" : attempt.outcome === "retake" ? "retake" : attempt.status === "booked" ? "booked" : "neutral"}>
              {attempt.outcome === "retake" ? "Retake recommended" : attempt.outcome || (attempt.status === "booked" ? "Upcoming" : "Cancelled")}
            </Pill>
          </div>
        ))}</div> : <div className="empty-state">Your interview bookings and results will appear here.</div>}
      </Card>
    </>
  );
}

function Milestones({ passed = false }) {
  const milestones = [
    ["Computational Thinking", "Level 1 cleared"],
    ["CS Fundamentals", "Level 1 cleared"],
    ["Applied Gen AI Development", "Level 1 cleared"],
    ["UI Engineering", "Level 2 cleared"],
    ["Level clearance interview", passed ? "Passed · Novice badge awarded" : "Book to complete your badge"],
  ];
  return <div className="milestone-list">{milestones.map(([title, detail], index) => (
    <div className="milestone" key={title}>
      <span className={`milestone-icon ${index === 4 && !passed ? "waiting" : ""}`}>{index === 4 ? passed ? "★" : "◷" : "✓"}</span>
      <span>{title}<small>{detail}</small></span>
    </div>
  ))}</div>;
}

function OutcomeButtons({ booking, busy, onOutcome }) {
  if (booking.status !== "booked") return <span className="label">Saved</span>;
  return (
    <div className="outcome-buttons">
      <button className="button small" onClick={() => onOutcome(booking, "pass")} disabled={busy}>Pass</button>
      <button className="button small" onClick={() => onOutcome(booking, "fail")} disabled={busy}>Fail</button>
      <button className="button small" onClick={() => onOutcome(booking, "retake")} disabled={busy}>Retake later</button>
    </div>
  );
}

function InterviewerScreen({ schedule, availability, selectedDate, setSelectedDate, onOutcome, onAddSlot, onRemoveSlot, busy }) {
  const dayBookings = schedule.filter((booking) => booking.slot.date === selectedDate);
  return (
    <>
      <PageHeading eyebrow="Interviewer workspace" title="Daily schedule" subtitle="Review interviews and record a clear outcome." aside={<span className="demo-badge">{INTERVIEWER} · Interviewer</span>} />
      <div className="grid three section-gap">
        <Metric label="Today's interviews" value={dayBookings.length} caption="Scheduled appointments" />
        <Metric label="Outcomes recorded" value={dayBookings.filter((booking) => booking.outcome).length} caption="Saved to student dashboards" />
        <Metric label="Open appointments" value={dayBookings.filter((booking) => !booking.outcome).length} caption="Awaiting an outcome" />
      </div>
      <Card className="card-pad" id="interviewer-schedule">
        <div className="section-head">
          <div><h3 className="section-title">Interview appointments</h3><div className="label">30 minutes · Online · India Standard Time</div></div>
          <label className="label date-field">Date <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
        </div>
        {dayBookings.length ? (
          <div className="table-wrap"><table className="spaced-rows-table"><thead><tr><th>Time</th><th>Student</th><th>Badge</th><th>Outcome</th><th>Record result</th></tr></thead>
            <tbody>{dayBookings.map((booking) => <tr key={booking.id}>
              <td><strong>{formatTime(booking.slot.start)}</strong></td>
              <td><Person student={booking.student} /></td>
              <td>{booking.student.badge}</td>
              <td>{booking.outcome ? <Pill tone={booking.outcome === "pass" ? "passed" : booking.outcome === "fail" ? "failed" : "retake"}>{booking.outcome === "retake" ? "Retake" : booking.outcome}</Pill> : <Pill tone="pending">Awaiting</Pill>}</td>
              <td><OutcomeButtons booking={booking} busy={busy} onOutcome={onOutcome} /></td>
            </tr>)}</tbody>
          </table></div>
        ) : <div className="empty-state">No interviews scheduled for this date.</div>}
        <div className="notice">Recording an outcome updates the student dashboard. “Retake later” is a non-pass result with guidance.</div>
      </Card>
      <Card className="card-pad section-gap" id="interviewer-availability">
        <div className="section-head">
          <div><h3 className="section-title">My availability</h3><div className="label">Open slots students can book</div></div>
          <button className="button small" onClick={onAddSlot}>＋ Add slot</button>
        </div>
        {availability.length ? <div className="availability-list">{availability.map((slot) => (
          <div className="availability-row" key={slot.id}>
            <div><strong>{formatDate(slot.date)} · {formatTime(slot.start)}–{formatTime(slot.end)}</strong><small>{slot.interviewer} · {slot.status}</small></div>
            <button className="remove-button" onClick={() => onRemoveSlot(slot)} disabled={busy || slot.status === "booked"}>{slot.status === "booked" ? "Booked" : "Remove"}</button>
          </div>
        ))}</div> : <div className="empty-state">No future availability published. Add a slot to let students book.</div>}
      </Card>
    </>
  );
}

function TeamScreen({ roster, onGoToSchedule, onAddStudent, busy }) {
  const [filter, setFilter] = useState("all");
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: "", email: "", badge: BADGE_OPTIONS[0], eligible: true });
  const { students = [], bookings = [], eligible_count = 0, booked_count = 0, passed_count = 0 } = roster || {};
  const bookingByStudent = useMemo(() => new Map([...bookings].reverse().map((booking) => [booking.student_id, booking])), [bookings]);
  const visible = students.filter((student) => {
    const booking = bookingByStudent.get(student.id);
    if (filter === "booked") return booking?.status === "booked";
    if (filter === "not-booked") return !booking || booking.status === "cancelled";
    if (filter === "completed") return booking?.status === "completed";
    return true;
  });
  const unbookedCount = students.filter((student) => {
    const booking = bookingByStudent.get(student.id);
    return !booking || booking.status === "cancelled";
  }).length;
  return (
    <>
      <PageHeading eyebrow="Student management" title="Eligible students" subtitle="Track who can book and who still needs to clear the badge requirements." aside={<button className="button" onClick={() => setShowAddStudent((visible) => !visible)}>{showAddStudent ? "Cancel" : "＋ Add student"}</button>} />
      {showAddStudent && <Card className="card-pad section-gap">
        <div className="section-head"><div><h3 className="section-title">Add a student</h3><div className="label">Add the student to the roster and set interview eligibility.</div></div></div>
        <form className="admin-create-form" onSubmit={async (event) => {
          event.preventDefault();
          const created = await onAddStudent(newStudent);
          if (created) {
            setNewStudent({ name: "", email: "", badge: BADGE_OPTIONS[0], eligible: true });
            setShowAddStudent(false);
          }
        }}>
          <label>Full name<input value={newStudent.name} onChange={(event) => setNewStudent({ ...newStudent, name: event.target.value })} required minLength={2} maxLength={120} /></label>
          <label>Email<input type="email" value={newStudent.email} onChange={(event) => setNewStudent({ ...newStudent, email: event.target.value })} required /></label>
          <label>Badge / track<select value={newStudent.badge} onChange={(event) => setNewStudent({ ...newStudent, badge: event.target.value })} required>{BADGE_OPTIONS.map((badge) => <option key={badge} value={badge}>{badge}</option>)}</select></label>
          <label className="checkbox-field"><input type="checkbox" checked={newStudent.eligible} onChange={(event) => setNewStudent({ ...newStudent, eligible: event.target.checked })} /> Eligible to book an interview</label>
          <button className="button primary" disabled={busy}>Add student</button>
        </form>
      </Card>}
      <div className="grid three section-gap">
        <Metric label="Eligible students" value={eligible_count} caption="Ready for level clearance interview" />
        <Metric label="Booked" value={booked_count} caption={`${eligible_count ? Math.round(booked_count / eligible_count * 100) : 0}% of eligible students`} />
        <Metric label="Badges awarded" value={passed_count} caption="Interview pass recorded" />
      </div>
      <Card className="card-pad">
        <div className="section-head">
          <div><h3 className="section-title">Eligible student queue</h3><div className="label">Only students with all required badge skills cleared are listed.</div></div>
          <select aria-label="Filter roster" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All students ({eligible_count})</option>
            <option value="booked">Booked ({booked_count})</option>
            <option value="not-booked">Not booked ({unbookedCount})</option>
            <option value="completed">Interview completed ({students.filter((student) => bookingByStudent.get(student.id)?.status === "completed").length})</option>
          </select>
        </div>
        {visible.length ? (
          <div className="table-wrap"><table><thead><tr><th>Student</th><th>Badge</th><th>Booking</th><th>Interview result</th><th /></tr></thead>
            <tbody>{visible.map((student) => {
              const booking = bookingByStudent.get(student.id);
              return <tr key={student.id}>
                <td><Person student={student} /></td><td>{student.badge}</td>
                <td>{booking?.status === "booked" ? <>{formatDate(booking.slot.date)} · {formatTime(booking.slot.start)}<br /><Pill tone="booked">Booked</Pill></> : booking?.status === "completed" ? <>{formatDate(booking.slot.date)} · {formatTime(booking.slot.start)}<br /><Pill tone="neutral">Completed</Pill></> : <Pill tone="pending">Not booked</Pill>}</td>
                <td>{booking?.outcome ? <Pill tone={booking.outcome === "pass" ? "passed" : booking.outcome === "fail" ? "failed" : "retake"}>{booking.outcome === "retake" ? "Retake later" : booking.outcome}</Pill> : <span className="label">—</span>}</td>
                <td>{booking?.status === "booked" ? <button className="table-action" onClick={onGoToSchedule}>Open schedule</button> : <span className="label">—</span>}</td>
              </tr>;
            })}</tbody>
          </table></div>
        ) : <div className="empty-state">No students match this filter.</div>}
      </Card>
      <Card className="card-pad section-gap">
        <div className="section-head"><div><h3 className="section-title">Not yet eligible</h3><div className="label">Not shown in the booking queue.</div></div><Pill>Skills in progress</Pill></div>
        {roster?.ineligible?.map((student) => <Person key={student.id} student={student} />)}
        <div className="footnote">Eligibility is evaluated from the badge’s required skill levels. If a student's eligibility changes, retain the booking history and alert the interview team.</div>
      </Card>
    </>
  );
}

function downloadRoster() {
  window.location.assign(`${API_BASE_URL}/api/admin/roster.csv`);
}

function AdminScreen({ data, module, setModule, onGoToSchedule, onAddAvailability, onRemoveAvailability, onAddStudent, onAddInterviewer, busy }) {
  const [interviewer, setInterviewer] = useState("all");
  const [newInterviewer, setNewInterviewer] = useState(INTERVIEWER);
  const [showAddInterviewer, setShowAddInterviewer] = useState(false);
  const [newInterviewerProfile, setNewInterviewerProfile] = useState({ name: "", email: "" });
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("10:00");
  const { bookings = [], availability = [], interviewers: interviewerProfiles = [], eligible_count = 0, booked_count = 0, passed_count = 0, interviewer_count = 0 } = data || {};
  const interviewers = [...new Set([...interviewerProfiles.map((profile) => profile.name), ...availability.map((slot) => slot.interviewer)])];
  const awaiting = bookings.filter((booking) => booking.status === "booked").length;

  return (
    <>
      <PageHeading eyebrow="Programme operations" title="Admin dashboard" subtitle="Manage eligibility, bookings, outcomes, and interviewer availability." />
      {module === "overview" && <>
        <div className="grid four section-gap">
          <Metric label="Eligible students" value={eligible_count} caption="Ready to book an interview" />
          <Metric label="Booked" value={booked_count} caption={`${eligible_count ? Math.round(booked_count / eligible_count * 100) : 0}% of eligible students`} />
          <Metric label="Awaiting outcome" value={awaiting} caption="Scheduled interviews" />
          <Metric label="Badges awarded" value={passed_count} caption="Interview pass recorded" />
        </div>
        <div className="grid two section-gap">
          <Card className="card-pad">
            <div className="section-head"><div><h3 className="section-title">Latest interview activity</h3><div className="label">Recent bookings and decisions</div></div><button className="table-action" onClick={() => setModule("bookings")}>View all</button></div>
            {bookings.length ? <div className="activity-list">{bookings.slice(0, 5).map((booking) => <div className="activity-row" key={booking.id}>
              <Person student={booking.student} /><span className="activity-detail">{formatDate(booking.slot.date)} · {formatTime(booking.slot.start)}</span><Pill tone={booking.outcome === "pass" ? "passed" : booking.outcome === "fail" ? "failed" : booking.outcome === "retake" ? "retake" : "booked"}>{booking.outcome || "Booked"}</Pill>
            </div>)}</div> : <div className="empty-state">No interview activity yet.</div>}
          </Card>
          <Card className="card-pad">
            <div className="section-head"><div><h3 className="section-title">Interviewer coverage</h3><div className="label">Availability across the team</div></div><button className="table-action" onClick={() => setModule("interviewers")}>Manage</button></div>
            <div className="admin-kpis"><div><strong>{interviewer_count}</strong><span>interviewers</span></div><div><strong>{availability.filter((slot) => slot.status === "open").length}</strong><span>open slots</span></div><div><strong>{availability.filter((slot) => slot.status === "booked").length}</strong><span>reserved slots</span></div></div>
            <div className="notice">Only eligible students can reserve an open slot. Completed decisions remain in booking history.</div>
          </Card>
        </div>
      </>}
      {module === "students" && <TeamScreen roster={data} onGoToSchedule={onGoToSchedule} onAddStudent={onAddStudent} busy={busy} />}
      {module === "bookings" && <Card className="card-pad">
        <div className="section-head"><div><h3 className="section-title">All interview bookings</h3><div className="label">Scheduled appointments, completed outcomes, and booking history.</div></div><button className="button" onClick={downloadRoster}>Download roster CSV</button></div>
        {bookings.length ? <div className="table-wrap"><table className="spaced-rows-table"><thead><tr><th>Student</th><th>Badge</th><th>Date & time</th><th>Interviewer</th><th>Status</th><th>Outcome</th></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id}>
          <td><Person student={booking.student} /></td><td>{booking.student.badge}</td><td>{formatDate(booking.slot.date)} · {formatTime(booking.slot.start)}</td><td>{booking.slot.interviewer}</td>
          <td><Pill tone={booking.status === "booked" ? "booked" : "neutral"}>{booking.status}</Pill></td><td>{booking.outcome ? <Pill tone={booking.outcome === "pass" ? "passed" : booking.outcome === "fail" ? "failed" : "retake"}>{booking.outcome}</Pill> : <span className="label">—</span>}</td>
        </tr>)}</tbody></table></div> : <div className="empty-state">No bookings have been made yet.</div>}
      </Card>}
      {module === "interviewers" && <div className="admin-interviewer-layout">
        <Card className="card-pad">
          <div className="section-head"><div><h3 className="section-title">Interviewer availability</h3><div className="label">Review and manage the team’s published slots.</div></div>
            <select aria-label="Filter by interviewer" value={interviewer} onChange={(event) => setInterviewer(event.target.value)}><option value="all">All interviewers</option>{interviewers.map((name) => <option key={name}>{name}</option>)}</select>
          </div>
          <div className="availability-list">{availability.filter((slot) => interviewer === "all" || slot.interviewer === interviewer).map((slot) => <div className="availability-row" key={slot.id}>
            <div><strong>{formatDate(slot.date)} · {formatTime(slot.start)}–{formatTime(slot.end)}</strong><small>{slot.interviewer} · {slot.status}</small></div>
            <button className="remove-button" disabled={busy || slot.status === "booked"} onClick={() => onRemoveAvailability(slot)}>{slot.status === "booked" ? "Booked" : "Remove"}</button>
          </div>)}</div>
        </Card>
        <Card className="card-pad">
          <div className="section-head"><div><h3 className="section-title">Add availability</h3><div className="label">Publish a 30-minute slot for an interviewer.</div></div></div>
          <form className="availability-form" onSubmit={(event) => { event.preventDefault(); if (newDate && newTime) onAddAvailability({ interviewer: newInterviewer, date: newDate, start: newTime }); }}>
            <label>Interviewer<select value={newInterviewer} onChange={(event) => setNewInterviewer(event.target.value)}>{[...new Set([...interviewers, INTERVIEWER, "Dev Patel"])].map((name) => <option key={name}>{name}</option>)}</select></label>
            <label>Date<input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} required /></label>
            <label>Start time<input type="time" value={newTime} onChange={(event) => setNewTime(event.target.value)} required /></label>
            <button className="button primary" disabled={busy}>Publish slot</button>
          </form>
          <div className="notice">Booked slots can’t be removed. Removing an open slot immediately hides it from student booking.</div>
        </Card>
      </div>}
      {module === "interviewers" && <Card className="card-pad section-gap">
        <div className="section-head"><div><h3 className="section-title">Interviewer directory</h3><div className="label">Add team members and use them when publishing availability.</div></div><button className="button" onClick={() => setShowAddInterviewer((visible) => !visible)}>{showAddInterviewer ? "Cancel" : "＋ Add interviewer"}</button></div>
        {showAddInterviewer && <form className="admin-create-form" onSubmit={async (event) => {
          event.preventDefault();
          const created = await onAddInterviewer(newInterviewerProfile);
          if (created) {
            setNewInterviewerProfile({ name: "", email: "" });
            setShowAddInterviewer(false);
          }
        }}>
          <label>Full name<input value={newInterviewerProfile.name} onChange={(event) => setNewInterviewerProfile({ ...newInterviewerProfile, name: event.target.value })} required minLength={2} maxLength={120} /></label>
          <label>Email<input type="email" value={newInterviewerProfile.email} onChange={(event) => setNewInterviewerProfile({ ...newInterviewerProfile, email: event.target.value })} required /></label>
          <button className="button primary" disabled={busy}>Add interviewer</button>
        </form>}
        {interviewerProfiles.length ? <div className="admin-directory">{interviewerProfiles.map((profile) => <div className="availability-row" key={profile.id}>
          <div><strong>{profile.name}</strong><small>{profile.email}</small></div>
          <Pill>Interviewer</Pill>
        </div>)}</div> : <div className="empty-state">No interviewers have been added.</div>}
      </Card>}
    </>
  );
}

export default function App() {
  const [screen, setScreen] = useState(null);
  const [adminModule, setAdminModule] = useState("overview");
  const [studentModule, setStudentModule] = useState("overview");
  const [interviewerModule, setInterviewerModule] = useState("schedule");
  const [comparison, setComparison] = useState("live");
  const [dashboard, setDashboard] = useState(null);
  const [slots, setSlots] = useState([]);
  const [adminData, setAdminData] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [selectedDate, setSelectedDate] = useState("2026-11-13");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [healthResult, studentResult, slotResult, adminResult, availabilityResult, scheduleResult] = await Promise.all([
        api("/health"),
        api(`/students/${STUDENT_ID}/dashboard`),
        api(`/slots?student_id=${STUDENT_ID}`),
        api("/admin/overview"),
        api(`/interviewer/availability?interviewer=${encodeURIComponent(INTERVIEWER)}`),
        api(`/interviewer/schedule?date=${selectedDate}&interviewer=${encodeURIComponent(INTERVIEWER)}`),
      ]);
      setHealth(healthResult);
      setDashboard(studentResult);
      setSlots(slotResult);
      setAdminData(adminResult);
      setAvailability(availabilityResult);
      setSchedule(scheduleResult);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [selectedDate]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function runAction(action, successMessage) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
      setToast(successMessage);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function addStudent(payload) {
    return runAction(
      () => api("/admin/students", { method: "POST", body: JSON.stringify(payload) }),
      `${payload.name} added to the student roster.`,
    );
  }

  function addInterviewer(payload) {
    return runAction(
      () => api("/admin/interviewers", { method: "POST", body: JSON.stringify(payload) }),
      `${payload.name} added to the interviewer directory.`,
    );
  }

  function bookSelectedSlot() {
    if (!selectedSlot) return;
    runAction(async () => {
      await api("/bookings", { method: "POST", body: JSON.stringify({ student_id: STUDENT_ID, slot_id: selectedSlot }) });
      setSelectedSlot(null);
      setComparison("live");
    }, "Interview booked. Your dashboard has been updated.");
  }

  function cancelBooking() {
    const bookingId = dashboard?.latest_booking?.id;
    if (!bookingId) return;
    runAction(() => api(`/bookings/${bookingId}/cancel`, { method: "POST" }), "Your interview booking has been cancelled.");
  }

  function recordOutcome(booking, outcome) {
    const defaultFeedback = outcome === "pass"
      ? "Strong command of the core concepts. Badge requirements met."
      : outcome === "retake"
        ? "Please revisit the fundamentals and schedule a retake when ready."
        : "Review the concepts discussed and strengthen your examples before a future attempt.";
    runAction(
      () => api(`/bookings/${booking.id}/outcome`, { method: "POST", body: JSON.stringify({ outcome, feedback: defaultFeedback }) }),
      `${booking.student.name}: ${outcome === "retake" ? "Retake recommendation" : outcome[0].toUpperCase() + outcome.slice(1)} recorded.`,
    );
  }

  function addAvailability() {
    const initialDate = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10);
    const date = window.prompt("Add a date (YYYY-MM-DD):", initialDate);
    if (date === null) return;
    const start = window.prompt("Start time (24-hour HH:MM):", "10:00");
    if (start === null) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start)) {
      setError("Enter a valid date (YYYY-MM-DD) and time (HH:MM).");
      return;
    }
    runAction(
      () => api("/interviewer/availability", { method: "POST", body: JSON.stringify({ interviewer: INTERVIEWER, date, start }) }),
      "Availability added.",
    );
  }

  function addAdminAvailability(payload) {
    runAction(
      () => api("/interviewer/availability", { method: "POST", body: JSON.stringify(payload) }),
      `Availability added for ${payload.interviewer}.`,
    );
  }

  function removeAvailability(slot) {
    runAction(() => api(`/interviewer/availability/${slot.id}`, { method: "DELETE" }), "Availability removed.");
  }

  function scrollToModule(module, elementId, setModule) {
    setModule(module);
    document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!screen) {
    const workspaces = [
      { id: "student", number: "01", title: "Students", description: "Book a badge interview and track your GRIT progress.", icon: "↗" },
      { id: "interviewer", number: "02", title: "Interviewer", description: "Manage your interview schedule and record outcomes.", icon: "◷" },
      { id: "admin", number: "03", title: "Admin", description: "Oversee eligible students, bookings, and interviewers.", icon: "▤" },
    ];
    return (
      <div className="role-landing">
        <header className="landing-topbar">
          <div className="brand"><div className="brand-mark">G</div><div>GRIT<small>Interview scheduling</small></div></div>
          <span>2026–27 programme</span>
        </header>
        <main className="landing-main">
          <div className="landing-copy">
            <div className="eyebrow">GRIT · NIAT</div>
            <h1>Welcome to your interview workspace</h1>
            <p>Choose your role to continue.</p>
          </div>
          <div className="workspace-choices">
            {workspaces.map((workspace) => (
              <button className="workspace-card" key={workspace.id} onClick={() => {
                setScreen(workspace.id);
                if (workspace.id === "admin") setAdminModule("overview");
              }}>
                <span className="workspace-topline"><span>{workspace.number}</span><span className="workspace-icon">{workspace.icon}</span></span>
                <strong>{workspace.title}</strong>
                <span className="workspace-description">{workspace.description}</span>
                <span className="workspace-action">Open workspace <span aria-hidden="true">→</span></span>
              </button>
            ))}
          </div>
          <div className="landing-footnote">Select Students, Interviewer, or Admin to open that workspace and its modules.</div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">G</div><div>GRIT<small>Student & interview portal</small></div></div>
        <div className="topbar-right">
          <button className="workspace-back" onClick={() => setScreen(null)}>← All workspaces</button>
          <span>2026–27 programme</span>
          <Pill tone={health ? "passed" : "pending"}>{health ? `${health.database} connected` : "API connecting"}</Pill>
          <span className="avatar">{initials(dashboard?.student?.name || "Aanya Rao")}</span>
        </div>
      </header>
      <div className="layout">
        <aside className="sidebar">
          <div className="side-label">{screen === "admin" ? "Admin modules" : screen === "interviewer" ? "Interviewer modules" : "Student modules"}</div>
          {screen === "admin" ? <nav className="nav module-nav" aria-label="Admin modules">{[["overview", "Overview"], ["students", "Students"], ["bookings", "Bookings"], ["interviewers", "Interviewers"]].map(([id, label]) => <button key={id} className={`nav-button ${adminModule === id ? "active" : ""}`} onClick={() => setAdminModule(id)}>{label}</button>)}</nav>
            : screen === "interviewer" ? <nav className="nav module-nav" aria-label="Interviewer modules"><button className={`nav-button ${interviewerModule === "schedule" ? "active" : ""}`} onClick={() => scrollToModule("schedule", "interviewer-schedule", setInterviewerModule)}>Daily schedule</button><button className={`nav-button ${interviewerModule === "availability" ? "active" : ""}`} onClick={() => scrollToModule("availability", "interviewer-availability", setInterviewerModule)}>My availability</button></nav>
              : <nav className="nav module-nav" aria-label="Student modules"><button className={`nav-button ${studentModule === "overview" ? "active" : ""}`} onClick={() => scrollToModule("overview", "student-overview", setStudentModule)}>Overview</button><button className={`nav-button ${studentModule === "booking" ? "active" : ""}`} onClick={() => scrollToModule("booking", "booking-card", setStudentModule)}>Book interview</button><button className={`nav-button ${studentModule === "history" ? "active" : ""}`} onClick={() => scrollToModule("history", "student-history", setStudentModule)}>Interview history</button></nav>}
          <div className="sidebar-note"><strong>{screen === "admin" ? "Programme overview" : screen === "interviewer" ? "Interview operations" : "Badge checkpoint"}</strong>{screen === "admin" ? "See eligible students, follow bookings and results, and manage availability for the interview team." : screen === "interviewer" ? "Review your daily schedule, publish availability, and record a clear interview outcome." : "Interviews validate your skills before the badge is awarded. A pass records the badge; a retake leaves your skills intact."}</div>
        </aside>
        <main>
          {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
          {screen === "student" && <StudentScreen dashboard={dashboard} slots={slots} selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot} onBook={bookSelectedSlot} onCancel={cancelBooking} busy={busy} preview={comparison} setPreview={setComparison} />}
          {screen === "interviewer" && <InterviewerScreen schedule={schedule} availability={availability} selectedDate={selectedDate} setSelectedDate={setSelectedDate} onOutcome={recordOutcome} onAddSlot={addAvailability} onRemoveSlot={removeAvailability} busy={busy} />}
          {screen === "admin" && <AdminScreen data={adminData} module={adminModule} setModule={setAdminModule} onGoToSchedule={() => setScreen("interviewer")} onAddAvailability={addAdminAvailability} onRemoveAvailability={removeAvailability} onAddStudent={addStudent} onAddInterviewer={addInterviewer} busy={busy} />}
        </main>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
