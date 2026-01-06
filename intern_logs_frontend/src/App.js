import React, { useMemo, useState } from "react";
import "./App.css";

/**
 * T3Log UI (frontend-only)
 * - Professional teal theme
 * - No sidebar; full-width content container
 * - Role-based views (Intern, Mentor) via frontend-only toggles
 * - Starts empty (no default cards/list items)
 */

// Small utility for className concatenation
function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Badge({ variant, children }) {
  const styles = {
    success:
      "bg-emerald-50 text-emerald-800 ring-emerald-200 border-emerald-200",
    connect:
      "bg-orange-50 text-orange-800 ring-orange-200 border-orange-200",
    alert:
      "bg-amber-50 text-amber-900 ring-amber-200 border-amber-200"
  };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        styles[variant] || "bg-slate-50 text-slate-800 ring-slate-200 border-slate-200"
      )}
    >
      {children}
    </span>
  );
}

function Button({
  variant = "primary",
  size = "md",
  type = "button",
  onClick,
  disabled,
  children
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl font-semibold transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tealbrand-500 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed";
  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-sm"
  };
  const variants = {
    primary:
      "bg-tealbrand-600 text-white hover:bg-tealbrand-700 active:bg-tealbrand-800",
    secondary:
      "bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 active:bg-slate-100",
    ghost:
      "bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200",
    danger:
      "bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950",
    success:
      "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800",
    connect:
      "bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700"
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(base, sizes[size] || sizes.md, variants[variant] || variants.primary)}
    >
      {children}
    </button>
  );
}

function Card({ title, subtitle, children, right }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {(title || subtitle || right) && (
        <header className="flex flex-col gap-1 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title && <h2 className="text-base font-bold text-slate-900">{title}</h2>}
            {subtitle && (
              <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            )}
          </div>
          {right && <div className="mt-2 sm:mt-0">{right}</div>}
        </header>
      )}
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
        {description}
      </p>
    </div>
  );
}

function FieldLabel({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-semibold text-slate-900">
      {children}
    </label>
  );
}

function TextInput({ id, placeholder }) {
  return (
    <input
      id={id}
      placeholder={placeholder}
      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-tealbrand-500 focus:ring-2 focus:ring-tealbrand-200"
    />
  );
}

function TextArea({ id, placeholder }) {
  return (
    <textarea
      id={id}
      placeholder={placeholder}
      rows={5}
      className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-tealbrand-500 focus:ring-2 focus:ring-tealbrand-200"
    />
  );
}

function FileUpload({ id }) {
  return (
    <div className="mt-2">
      <input
        id={id}
        type="file"
        className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-white text-sm text-slate-700 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-tealbrand-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-tealbrand-700"
      />
      <p className="mt-2 text-xs text-slate-500">
        Upload is UI-only for now. (No backend logic yet.)
      </p>
    </div>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        // Close when clicking backdrop, not when clicking the panel
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">
              UI-only. Submission history starts empty.
            </p>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

function Header({ role, setRole }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-tealbrand-600 text-white shadow-sm">
            <span className="text-sm font-black">T3</span>
          </div>
          <div>
            <div className="text-lg font-black tracking-tight text-slate-900">
              T3Log
            </div>
            <div className="text-xs font-semibold text-slate-500">
              Intern work logging • Mentor review • Meeting scheduling
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className="hidden rounded-2xl border border-slate-200 bg-slate-50 p-1 sm:flex"
            aria-label="Role selector"
          >
            <button
              className={cx(
                "rounded-xl px-3 py-2 text-sm font-bold transition",
                role === "intern"
                  ? "bg-white text-tealbrand-700 shadow-sm"
                  : "text-slate-600 hover:bg-white"
              )}
              onClick={() => setRole("intern")}
              type="button"
            >
              Intern
            </button>
            <button
              className={cx(
                "rounded-xl px-3 py-2 text-sm font-bold transition",
                role === "mentor"
                  ? "bg-white text-tealbrand-700 shadow-sm"
                  : "text-slate-600 hover:bg-white"
              )}
              onClick={() => setRole("mentor")}
              type="button"
            >
              Mentor
            </button>
          </div>

          {/* Mobile role selector */}
          <select
            className="sm:hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            aria-label="Role selector"
          >
            <option value="intern">Intern</option>
            <option value="mentor">Mentor</option>
          </select>

          <Button variant="secondary">Logout</Button>
        </div>
      </div>
    </header>
  );
}

function InternView() {
  const [hasMeetingScheduled] = useState(false);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Card
            title="Submit Work"
            subtitle="Log what you worked on. Date and time are automatically captured upon submission."
          >
            <form className="space-y-4">
              <div>
                <FieldLabel htmlFor="workTitle">Work Title</FieldLabel>
                <TextInput id="workTitle" placeholder="e.g., Weekly progress report" />
              </div>

              <div>
                <FieldLabel htmlFor="workDesc">Description</FieldLabel>
                <TextArea
                  id="workDesc"
                  placeholder="Write a short summary of what you completed, blockers, and next steps…"
                />
              </div>

              <div>
                <FieldLabel htmlFor="workFile">File Upload</FieldLabel>
                <FileUpload id="workFile" />
              </div>

              <div className="rounded-xl border border-tealbrand-100 bg-tealbrand-50 px-4 py-3">
                <div className="text-sm font-bold text-tealbrand-900">
                  Auto-timestamp
                </div>
                <div className="mt-1 text-sm text-tealbrand-800">
                  Date and time will be captured automatically when you submit.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button variant="secondary" type="reset">
                  Clear
                </Button>
                <Button type="submit">Submit</Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card
            title="History"
            subtitle="Your submitted works will appear here."
            right={
              <div className="flex items-center gap-2">
                <Badge variant="success">Reviewed Successful</Badge>
                <Badge variant="connect">Want to Connect</Badge>
              </div>
            }
          >
            {hasMeetingScheduled ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-amber-950">
                      Meeting Scheduled
                    </div>
                    <div className="mt-1 text-sm text-amber-900">
                      A mentor scheduled a meeting. Check details in your next
                      notification.
                    </div>
                  </div>
                  <Badge variant="alert">Attention</Badge>
                </div>
              </div>
            ) : null}

            <EmptyState
              title="No submissions yet"
              description="Once you submit work, it will show up here with status badges such as Reviewed Successful (green) or Want to Connect (orange)."
            />
          </Card>
        </div>
      </div>
    </main>
  );
}

function MentorView() {
  const [selectedIntern, setSelectedIntern] = useState(null);
  const [meetingOpen, setMeetingOpen] = useState(false);

  const participants = useMemo(() => {
    // Requirement: No default data. Keep empty until backend is wired.
    return [];
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900">
            Participants
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Select an intern to review submissions and schedule meetings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setMeetingOpen(true)}>
            <span className="mr-2 text-base" aria-hidden="true">
              📅
            </span>
            Schedule Meeting
          </Button>
        </div>
      </div>

      <div className="mt-6">
        {participants.length === 0 ? (
          <EmptyState
            title="No interns to display"
            description="Intern cards will appear here in a grid once participant data is available."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {participants.map((intern) => (
              <button
                key={intern.id}
                type="button"
                onClick={() => setSelectedIntern(intern)}
                className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-tealbrand-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tealbrand-500 focus-visible:ring-offset-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-900">
                      {intern.name}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {intern.email}
                    </div>
                  </div>
                  <span className="rounded-xl bg-tealbrand-50 px-2 py-1 text-xs font-bold text-tealbrand-800">
                    View
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Badge variant="success">Reviewed Successful</Badge>
                  <Badge variant="connect">Want to Connect</Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(selectedIntern)}
        title={selectedIntern ? `${selectedIntern.name}` : "Intern Detail"}
        onClose={() => setSelectedIntern(null)}
      >
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Card
              title="Submission History"
              subtitle="Each submission will have Download and status controls."
            >
              <EmptyState
                title="No submissions yet"
                description="Once this intern submits work, items will appear here with buttons: Download, Mark Success (green), Want to Connect (orange)."
              />
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card
              title="Action Controls (Preview)"
              subtitle="UI-only controls (no data yet)."
            >
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-black text-slate-900">
                    Submission Item Controls
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Shown on each submission:
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm">
                      Download
                    </Button>
                    <Button variant="success" size="sm">
                      Success
                    </Button>
                    <Button variant="connect" size="sm">
                      Connect
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-black text-slate-900">
                        Meeting Scheduler
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        Date, time, and a short description.
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setMeetingOpen(true)}
                    >
                      Open
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </Modal>

      <Modal
        open={meetingOpen}
        title="Schedule Meeting"
        onClose={() => setMeetingOpen(false)}
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <Card
            title="Meeting Details"
            subtitle="Choose a date/time and add a short description."
          >
            <form className="space-y-4">
              <div>
                <FieldLabel htmlFor="meetingDate">Date</FieldLabel>
                <input
                  id="meetingDate"
                  type="date"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-tealbrand-500 focus:ring-2 focus:ring-tealbrand-200"
                />
              </div>

              <div>
                <FieldLabel htmlFor="meetingTime">Time</FieldLabel>
                <input
                  id="meetingTime"
                  type="time"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-tealbrand-500 focus:ring-2 focus:ring-tealbrand-200"
                />
              </div>

              <div>
                <FieldLabel htmlFor="meetingDesc">Short Description</FieldLabel>
                <TextArea
                  id="meetingDesc"
                  placeholder="e.g., Quick check-in on recent submission and next steps."
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button variant="secondary" onClick={() => setMeetingOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Schedule</Button>
              </div>
            </form>
          </Card>

          <Card
            title="How it will appear (Intern)"
            subtitle="High-contrast alert card in intern history when scheduled."
          >
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-amber-950">
                    Meeting Scheduled
                  </div>
                  <div className="mt-1 text-sm text-amber-900">
                    Date/time and description will be visible here once integrated.
                  </div>
                </div>
                <Badge variant="alert">Alert</Badge>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-bold text-slate-900">Status Badges</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="success">Reviewed Successful</Badge>
                <Badge variant="connect">Want to Connect</Badge>
              </div>
            </div>
          </Card>
        </div>
      </Modal>
    </main>
  );
}

// PUBLIC_INTERFACE
function App() {
  const [role, setRole] = useState("intern");

  return (
    <div className="min-h-screen">
      <Header role={role} setRole={setRole} />

      {/* Full-width content, no sidebar */}
      {role === "intern" ? <InternView /> : <MentorView />}

      <footer className="border-t border-slate-200 bg-white/70">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-slate-500 sm:px-6">
          <span className="font-semibold text-slate-700">T3Log</span> • UI-only
          prototype • Teal theme • No backend/data yet
        </div>
      </footer>
    </div>
  );
}

export default App;
