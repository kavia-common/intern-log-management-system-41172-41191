import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { supabase } from "./utils/supabaseClient";
console.debug("App.js mounted");

// FEATURE FLAG: Use Supabase (set to true to enable Supabase live mode)
const USE_SUPABASE = true;

let submissionsApi;
if (USE_SUPABASE) {
  // eslint-disable-next-line global-require
  submissionsApi = require("./utils/submissionsApi");
}

/**
 * T3Log UI — Supabase live mode
 *
 * Live mode requirements:
 * - Table: public."log-creation" (hyphenated name -> quoted identifier)
 * - Bucket: intern-work (public)
 * - Intern submit: insert row -> upload file -> update row.file_url with public URL
 * - Mentor actions: update status and mentor_remark in DB
 * - Realtime: keep both intern and mentor views in sync
 */

// Utility for className concatenation
function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

// PUBLIC_INTERFACE
function App() {
  /** Auth/role */
  const [isAuthed, setIsAuthed] = useState(false);
  const [role, setRole] = useState(null);

  /**
   * Shared submissions store. In live mode, this is hydrated from Supabase and kept
   * in sync via realtime subscriptions.
   */
  const [submissions, setSubmissions] = useState([]);

  // Initial load + realtime sync
  useEffect(() => {
    let unsub = null;
    let cancelled = false;

    if (USE_SUPABASE && submissionsApi) {
      async function bootstrap() {
        const { data, error } = await submissionsApi.listSubmissionsAsUi();
        if (!cancelled) {
          if (error) {
            // eslint-disable-next-line no-console
            console.error("Failed to load submissions from Supabase:", error);
          } else if (Array.isArray(data)) {
            setSubmissions(data);
          }
        }

        const sub = submissionsApi.subscribeToSubmissionsChanges({
          onInsert: (uiRow) => {
            setSubmissions((prev) => {
              if (prev.some((s) => s.id === uiRow.id)) return prev;
              return [uiRow, ...prev];
            });
          },
          onUpdate: (uiRow) => {
            setSubmissions((prev) =>
              prev.map((s) => (s.id === uiRow.id ? { ...s, ...uiRow } : s))
            );
          },
          onDelete: (id) => {
            setSubmissions((prev) => prev.filter((s) => s.id !== id));
          }
        });

        unsub = () => sub.unsubscribe();
      }

      bootstrap();

      return () => {
        cancelled = true;
        if (unsub) unsub();
      };
    }

    return () => {};
  }, []);

  // PUBLIC_INTERFACE
  function handleLogout() {
    setIsAuthed(false);
    setRole(null);
  }

  // PUBLIC_INTERFACE
  function handleLogin(nextRole) {
    setRole(nextRole);
    setIsAuthed(true);
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {!isAuthed ? (
        <LoginScreen onSelectRole={handleLogin} />
      ) : (
        <>
          <GlassHeader onLogout={handleLogout} />
          {role === "intern" ? (
            <InternDashboard submissions={submissions} setSubmissions={setSubmissions} />
          ) : (
            <MentorDashboard submissions={submissions} setSubmissions={setSubmissions} />
          )}
          <footer className="mt-10 border-t border-slate-200/70 bg-white/60 backdrop-blur">
            <div className="mx-auto w-full max-w-6xl px-4 py-6 text-xs font-semibold text-slate-500 sm:px-6">
              <span className="text-tealbrand-700">T3Log</span>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

function LoginScreen({ onSelectRole }) {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Soft teal gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-tealbrand-600 via-tealbrand-500 to-tealbrand-800" />
      <div className="absolute inset-0 opacity-70 [background:radial-gradient(900px_600px_at_20%_10%,rgba(255,255,255,0.32),transparent_60%),radial-gradient(800px_500px_at_80%_30%,rgba(255,255,255,0.18),transparent_55%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-4 py-14 sm:px-6">
        <div className="w-full max-w-4xl">
          <div className="text-center">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-3xl bg-white/15 text-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45)] ring-1 ring-white/25 backdrop-blur">
              <span className="text-lg font-black tracking-tight">T3</span>
            </div>
            <h1 className="text-balance text-4xl font-black tracking-tight text-white sm:text-5xl">
              Welcome to T3Log
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm font-semibold text-white/85 sm:text-base">
              Precision Tracking. Seamless Mentorship. Elevated Growth.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <RoleCard
              title="I am an Intern"
              subtitle="Log work with timestamps, manage submissions, and track review/meeting status."
              icon={<InternIcon />}
              buttonLabel="Access Dashboard"
              onClick={() => onSelectRole("intern")}
            />
            <RoleCard
              title="I am a Mentor"
              subtitle="Review intern submissions, set reviewed status, and schedule meetings."
              icon={<MentorIcon />}
              buttonLabel="Review Submissions"
              onClick={() => onSelectRole("mentor")}
            />
          </div>
          <div className="mt-10 text-center text-xs font-semibold text-white/75">
            Choose a role to continue
          </div>
        </div>
      </div>
    </main>
  );
}

function RoleCard({ title, subtitle, icon, buttonLabel, onClick }) {
  return (
    <section
      className={cx(
        "group relative overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-6 shadow-[0_18px_60px_-30px_rgba(0,0,0,0.60)] backdrop-blur",
        "transition duration-300 hover:-translate-y-1 hover:bg-white/14 hover:shadow-[0_25px_70px_-35px_rgba(0,0,0,0.70)]",
        "focus-within:ring-2 focus-within:ring-white/70"
      )}
    >
      {/* Glow on hover */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
        <div className="absolute -left-20 -top-20 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute -bottom-24 -right-24 h-60 w-60 rounded-full bg-tealbrand-200/25 blur-3xl" />
      </div>
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-white ring-1 ring-white/25">
            {icon}
          </div>
          <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold text-white/85 ring-1 ring-white/15">
            Role
          </div>
        </div>
        <h2 className="mt-5 text-xl font-extrabold tracking-tight text-white">
          {title}
        </h2>
        <p className="mt-2 text-sm font-semibold text-white/80">{subtitle}</p>
        <button
          type="button"
          onClick={onClick}
          className={cx(
            "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-tealbrand-800",
            "shadow-sm transition hover:bg-white/95 active:bg-white/90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-tealbrand-700"
          )}
        >
          {buttonLabel}
          <span aria-hidden="true" className="text-base">
            →
          </span>
        </button>
      </div>
    </section>
  );
}

function GlassHeader({ onLogout }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-tealbrand-600 text-white shadow-sm">
            <span className="text-sm font-black">T3</span>
          </div>
          <div className="leading-tight">
            <div className="text-lg font-black tracking-tight text-tealbrand-700">
              T3Log
            </div>
            <div className="text-xs font-semibold text-slate-500">
              Precision tracking • Seamless mentorship
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className={cx(
            "inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-800",
            "shadow-sm transition hover:bg-slate-50 active:bg-slate-100",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tealbrand-500 focus-visible:ring-offset-2"
          )}
        >
          <LogoutIcon />
          Logout
        </button>
      </div>
    </header>
  );
}

function InternDashboard({ submissions, setSubmissions }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileList, setFileList] = useState([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Edit Modal state */
  const [editingSubmissionId, setEditingSubmissionId] = useState(null);

  const editingSubmission = useMemo(() => {
    if (!editingSubmissionId) return null;
    return submissions.find((s) => s.id === editingSubmissionId) || null;
  }, [editingSubmissionId, submissions]);

  const hasAny = submissions.length > 0;
  const isEditModalOpen = Boolean(editingSubmission);

  // PUBLIC_INTERFACE
  async function handleSubmit(e) {
    /**
     * Live mode:
     * 1) create DB row (title, description, intern_email, status)
     * 2) upload selected file (first file only for now; UI can still show multiple names)
     * 3) update DB row with file_url public URL
     */
    e.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    if (!trimmedTitle || !trimmedDesc) return;

    const rawFiles = Array.from(fileList || []);
    const uiFiles = rawFiles.map((f) => ({
      id: cryptoLikeId(),
      name: f.name || "file",
      size: typeof f.size === "number" ? f.size : 0
    }));

    if (!USE_SUPABASE || !submissionsApi) {
      // Local fallback (shouldn't happen with USE_SUPABASE=true, but keep safe)
      const now = new Date();
      const timestampIso = now.toISOString();
      const timestampLabel = now.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });

      setSubmissions((prev) => [
        {
          id: cryptoLikeId(),
          title: trimmedTitle,
          description: trimmedDesc,
          timestampIso,
          timestampLabel,
          files: uiFiles,
          status: "none",
          meeting: null,
          mentorRemark: undefined,
          fileUrl: null
        },
        ...prev
      ]);

      setTitle("");
      setDescription("");
      setFileList([]);
      return;
    }

    setIsSubmitting(true);
    try {
      // Placeholder email per instruction (until auth is added)
      const internEmail = "intern@example.com";

      // Step 1: create row (status defaults in DB, but we also provide it to be explicit)
      const payload = {
        title: trimmedTitle,
        description: trimmedDesc,
        intern_email: internEmail,
        status: "none"
      };

      // Upload: take the first file as the actual uploaded object;
      // UI still lists multiple selected file names for consistency with current UX.
      const fileToUpload = rawFiles[0] || null;

      const { data: createdOrUpdated, error } =
        await submissionsApi.createSubmissionWithOptionalUpload({
          payload,
          file: fileToUpload
        });

      if (error) {
        // eslint-disable-next-line no-console
        console.error("Supabase submit failed:", error);
      }

      if (createdOrUpdated) {
        // Update local state optimistically with returned DB row (but realtime will also reconcile).
        const mapped =
          submissionsApi.mapDbRowToUi?.(createdOrUpdated) ||
          // fallback mapping (should exist)
          {
            id: createdOrUpdated.id,
            title: createdOrUpdated.title,
            description: createdOrUpdated.description,
            status: createdOrUpdated.status || "none",
            mentorRemark: createdOrUpdated.mentor_remark ?? undefined,
            fileUrl: createdOrUpdated.file_url || null,
            files: createdOrUpdated.file_url
              ? [
                  {
                    id: `file-${createdOrUpdated.id}`,
                    name: "uploaded_file",
                    size: 0
                  }
                ]
              : []
          };

        // Preserve UI list of selected files (names/sizes) if user selected multiple.
        // If we got a file URL back, clicking download will open that URL.
        const merged = { ...mapped, files: uiFiles.length ? uiFiles : mapped.files };

        setSubmissions((prev) => {
          if (prev.some((s) => s.id === merged.id)) {
            return prev.map((s) => (s.id === merged.id ? { ...s, ...merged } : s));
          }
          return [merged, ...prev];
        });
      }

      setTitle("");
      setDescription("");
      setFileList([]);
    } finally {
      setIsSubmitting(false);
    }
  }

  // PUBLIC_INTERFACE
  async function deleteSubmission(id) {
    /**
     * Live mode:
     * - DELETE the row in Supabase so the card is gone after refresh.
     * - Optionally remove the uploaded file from Storage (intern-work) if file_url exists.
     * - Update local state immediately for snappy UX.
     * - Realtime DELETE will also reconcile other views.
     */
    if (!id) return;

    const current = submissions.find((s) => s.id === id) || null;

    // Optimistic UI remove
    setSubmissions((prev) => prev.filter((s) => s.id !== id));
    if (editingSubmissionId === id) setEditingSubmissionId(null);

    if (!USE_SUPABASE || !submissionsApi) return;

    const { error, storageError } = await submissionsApi.deleteSubmission(id, {
      removeStorage: true,
      fileUrl: current?.fileUrl || null
    });

    if (storageError) {
      // Non-fatal; the DB row can still be deleted successfully.
      // eslint-disable-next-line no-console
      console.warn("Deleted DB row but failed to remove storage object:", storageError);
    }

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to delete submission in Supabase:", error);

      // Hard refresh to reconcile UI with DB (card may come back if delete failed due to RLS/policy).
      const { data, error: refreshError } = await submissionsApi.refreshSubmissionsAsUi();
      if (refreshError) {
        // eslint-disable-next-line no-console
        console.error("Failed to refresh submissions after delete failure:", refreshError);
      } else if (Array.isArray(data)) {
        setSubmissions(data);
      }
    }
  }

  // PUBLIC_INTERFACE
  function openEditModal(submission) {
    setEditingSubmissionId(submission.id);
  }

  // PUBLIC_INTERFACE
  function closeEditModal() {
    setEditingSubmissionId(null);
  }

  // PUBLIC_INTERFACE
  function updateSubmissionImmediate(id, patch) {
    // Preserve current UI behavior (edit modal affects local-only fields).
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }

  return (
    <>
      {/* Wrapper that can blur when the edit modal is open */}
      <div className={cx(isEditModalOpen && "blur-sm")}>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <section className="rounded-3xl border-2 border-tealbrand-800 bg-tealbrand-50 shadow-sm">
                <header className="border-b border-tealbrand-200 px-5 py-5">
                  <h2 className="text-base font-black text-slate-900">
                    Submit Work
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    Fields: Work Title, Description, File Upload. Timestamp is captured on submission.
                  </p>
                </header>
                <div className="px-5 py-5">
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div>
                      <label htmlFor="workTitle" className="text-sm font-extrabold text-slate-900">
                        Work Title
                      </label>
                      <input
                        id="workTitle"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Weekly progress report"
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-tealbrand-500 focus:ring-2 focus:ring-tealbrand-200"
                      />
                    </div>
                    <div>
                      <label htmlFor="workDesc" className="text-sm font-extrabold text-slate-900">
                        Description
                      </label>
                      <textarea
                        id="workDesc"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Write a short summary of what you completed, blockers, and next steps…"
                        rows={5}
                        className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-tealbrand-500 focus:ring-2 focus:ring-tealbrand-200"
                      />
                    </div>
                    <div>
                      <label htmlFor="workFile" className="text-sm font-extrabold text-slate-900">
                        File Upload
                      </label>
                      <input
                        id="workFile"
                        type="file"
                        multiple
                        onChange={(e) => setFileList(e.target.files)}
                        className="mt-2 block w-full cursor-pointer rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 file:mr-4 file:cursor-pointer file:rounded-xl file:border-0 file:bg-tealbrand-600 file:px-4 file:py-2.5 file:text-sm file:font-extrabold file:text-white hover:file:bg-tealbrand-700"
                      />
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        Uploads to Supabase Storage (intern-work). The first selected file is uploaded; file names are shown as selected.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-tealbrand-100 bg-tealbrand-50 px-4 py-3">
                      <div className="text-sm font-black text-tealbrand-900">Auto-timestamp</div>
                      <div className="mt-1 text-sm font-semibold text-tealbrand-800">
                        Date and time will be captured automatically when you submit.
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="reset"
                        onClick={() => {
                          setTitle("");
                          setDescription("");
                          setFileList([]);
                        }}
                        className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-800 shadow-sm transition hover:bg-slate-50 active:bg-slate-100"
                      >
                        Clear
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className={cx(
                          "inline-flex h-10 items-center justify-center rounded-2xl px-5 text-sm font-extrabold text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tealbrand-500 focus-visible:ring-offset-2",
                          isSubmitting
                            ? "bg-slate-400 cursor-not-allowed"
                            : "bg-tealbrand-600 hover:bg-tealbrand-700 active:bg-tealbrand-800"
                        )}
                      >
                        {isSubmitting ? "Submitting…" : "Submit"}
                      </button>
                    </div>
                  </form>
                </div>
              </section>
            </div>
            <div className="lg:col-span-3">
              <section className="rounded-3xl border-2 border-tealbrand-800 bg-tealbrand-50 shadow-sm">
                <header className="border-b border-tealbrand-200 px-5 py-5">
                  <h2 className="text-base font-black text-slate-900">History</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    Submissions appear below with timestamps, file downloads, and edit/delete controls.
                  </p>
                </header>
                <div className="px-5 py-5">
                  {!hasAny ? (
                    <EmptyState
                      title="No submissions yet"
                      description="Submit your first work item to see it appear here."
                    />
                  ) : (
                    <div className="space-y-4">
                      {submissions.map((s) => (
                        <SubmissionCard
                          key={s.id}
                          submission={s}
                          variant="intern"
                          onEdit={() => openEditModal(s)}
                          onDelete={() => deleteSubmission(s.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
      <EditSubmissionModal
        open={isEditModalOpen}
        submission={editingSubmission}
        onClose={closeEditModal}
        onImmediatePatch={(patch) => {
          if (!editingSubmission) return;
          updateSubmissionImmediate(editingSubmission.id, patch);
        }}
      />
    </>
  );
}

function MentorDashboard({ submissions, setSubmissions }) {
  // Modal state for scheduling meeting
  const [meetingTargetId, setMeetingTargetId] = useState(null);

  // Remark modal state (openFor: submissionId|null)
  const [remarkModal, setRemarkModal] = useState({ openFor: null });

  // Draft for modal textarea
  const [modalDraft, setModalDraft] = useState("");

  const meetingTarget = useMemo(() => {
    if (!meetingTargetId) return null;
    return submissions.find((s) => s.id === meetingTargetId) || null;
  }, [meetingTargetId, submissions]);

  async function persistUiPatch(id, uiPatch) {
    if (!USE_SUPABASE || !submissionsApi) return;

    // Local immediate update for snappy UX
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...uiPatch } : s))
    );

    const { error } = await submissionsApi.updateSubmissionFromUi(id, uiPatch);
    if (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to persist mentor action:", error);
      // Realtime subscription will eventually reconcile if DB update did not apply.
    }
  }

  // PUBLIC_INTERFACE
  function markReviewed(id) {
    if (!id) return;

    if (USE_SUPABASE) {
      persistUiPatch(id, { status: "reviewed" });
      return;
    }

    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "reviewed" } : s))
    );
  }

  // PUBLIC_INTERFACE
  function scheduleMeeting(id, meeting) {
    if (!id) return;

    // Meeting is UI-only currently (not persisted to DB), but status is persisted.
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, meeting, status: "meeting_scheduled" } : s))
    );

    if (USE_SUPABASE) {
      persistUiPatch(id, { status: "meeting_scheduled" });
    }
  }

  // PUBLIC_INTERFACE
  function openRemarkModal(id, currentRemark) {
    setRemarkModal({ openFor: id });
    setModalDraft(typeof currentRemark === "string" ? currentRemark : "");
  }

  // PUBLIC_INTERFACE
  function closeRemarkModal() {
    setRemarkModal({ openFor: null });
    setModalDraft("");
  }

  // PUBLIC_INTERFACE
  function commitMentorRemark(id) {
    const note = (modalDraft || "").trim();
    if (!id || !note) return;

    if (USE_SUPABASE) {
      // Persist to DB and allow realtime to sync intern view
      persistUiPatch(id, { mentorRemark: note });
      closeRemarkModal();
      return;
    }

    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, mentorRemark: note } : s))
    );
    closeRemarkModal();
  }

  function MentorRemarkButton({ submission }) {
    const hasRemark =
      typeof submission.mentorRemark === "string" && submission.mentorRemark.trim();

    return (
      <button
        type="button"
        className={cx(
          "remark-floating-btn absolute right-4 top-4 z-20",
          "inline-flex items-center gap-1.5 rounded-xl border border-tealbrand-900 px-2.5 py-1.5 text-xs font-black bg-tealbrand-800 text-white shadow-md hover:bg-tealbrand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tealbrand-400 focus-visible:ring-offset-2"
        )}
        onClick={() => openRemarkModal(submission.id, submission.mentorRemark)}
        aria-label={hasRemark ? "Edit Remark" : "Add Remark"}
        style={{ minWidth: "2.2rem", minHeight: "1.8rem" }}
      >
        <span className="align-middle text-lg font-bold leading-none">+</span>
        <span className="font-black">Remark</span>
      </button>
    );
  }

  return (
    <>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-xl font-black tracking-tight text-slate-900">
            Mentor Dashboard
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            Review intern submissions as cards. Actions live inside each work card.
          </p>
        </div>
        {submissions.length === 0 ? (
          <EmptyState
            title="No intern submissions yet"
            description="Once an intern submits work, cards will appear here in a grid for review."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {submissions.map((s) => (
              <div key={s.id} className="relative">
                <SubmissionCard
                  submission={s}
                  variant="mentor"
                  onReviewedSuccessfully={() => markReviewed(s.id)}
                  onScheduleMeeting={() => setMeetingTargetId(s.id)}
                  renderExtraActions={null}
                  MentorRemarkButtonSlot={<MentorRemarkButton submission={s} />}
                />
              </div>
            ))}
          </div>
        )}
        <MeetingModal
          open={Boolean(meetingTarget)}
          submission={meetingTarget}
          onClose={() => setMeetingTargetId(null)}
          onSchedule={(meeting) => {
            if (!meetingTarget) return;
            scheduleMeeting(meetingTarget.id, meeting);
            setMeetingTargetId(null);
          }}
        />
      </main>
      <MentorRemarkModal
        open={Boolean(remarkModal.openFor)}
        value={modalDraft}
        onChange={setModalDraft}
        onClose={closeRemarkModal}
        onSend={() => {
          commitMentorRemark(remarkModal.openFor);
        }}
        canSend={modalDraft.trim().length > 0}
      />
    </>
  );
}

// Modal for mentor remark (compact, teal, icons)
function MentorRemarkModal({ open, value, onChange, onClose, onSend, canSend }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Mentor Remark"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xs overflow-hidden rounded-2xl border-2 border-tealbrand-900 bg-tealbrand-900 shadow-xl">
        <header className="border-b border-tealbrand-800/70 px-4 py-2.5 text-white flex items-center justify-between">
          <span className="text-xs font-black tracking-wide">Mentor Remark</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white/80 text-xs font-extrabold shadow-sm transition hover:bg-white/20 active:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-tealbrand-900"
          >
            ✕
          </button>
        </header>
        <div className="px-4 py-3">
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder="Add mentor feedback…"
            className="w-full resize-none rounded-xl border border-white/20 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-tealbrand-300 focus:ring-2 focus:ring-white/40"
            style={{ minHeight: "40px" }}
            maxLength={180}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Cancel"
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white shadow-sm hover:bg-white/20 active:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-tealbrand-900"
              title="Cancel"
            >
              <span className="text-base font-black">✗</span>
            </button>
            <button
              type="button"
              disabled={!canSend}
              onClick={onSend}
              aria-label="Send"
              className={cx(
                "inline-flex h-8 w-8 items-center justify-center rounded-xl border px-0 shadow-sm transition",
                canSend
                  ? "bg-white border-white/20 text-tealbrand-900 hover:bg-white/90 active:bg-white/80"
                  : "bg-slate-300 border-slate-300 text-white cursor-not-allowed"
              )}
              title="Send"
            >
              <span className="text-base font-black leading-none">➤</span>
            </button>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-white/60">
            <span>Visible to both mentor & intern</span>
            <span>{(value?.length ?? 0)}/180</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Card tone rules:
 * - meeting scheduled: light orange bg + dark orange border (highest priority)
 * - reviewed: light green bg + dark green border
 * - default: pale teal bg + dark teal border
 */
function getCardToneClasses(submission) {
  const hasMeeting = Boolean(submission.meeting);
  const isReviewed = submission.status === "reviewed";

  if (hasMeeting) return "border-amber-700 bg-amber-200/70";
  if (isReviewed) return "border-emerald-700 bg-emerald-100";
  return "border-tealbrand-800 bg-tealbrand-50";
}

// Supports intern and mentor view variant
function SubmissionCard({
  submission,
  variant,
  onEdit,
  onDelete,
  onReviewedSuccessfully,
  onScheduleMeeting,
  renderExtraActions,
  MentorRemarkButtonSlot
}) {
  const isReviewed = submission.status === "reviewed";
  const hasMeeting = Boolean(submission.meeting);

  const statusBadge = isReviewed ? (
    <StatusBadge kind="success" label="Reviewed Successfully" />
  ) : null;

  const cardTone = getCardToneClasses(submission);

  const fileRowBorder = hasMeeting
    ? "border-amber-200"
    : isReviewed
      ? "border-emerald-200"
      : "border-tealbrand-200";

  const mentorRemarkBottom =
    typeof submission.mentorRemark === "string" && submission.mentorRemark.trim();

  return (
    <article
      className={cx(
        "group relative rounded-3xl border-2 shadow-sm transition",
        cardTone,
        "p-6 pt-6"
      )}
      tabIndex={-1}
    >
      {variant === "mentor" ? MentorRemarkButtonSlot : null}

      <div className="flex items-start justify-between gap-4 pr-14">
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
            Work Name
          </div>
          <h3 className="mt-1 truncate text-sm font-black text-slate-900">
            {submission.title}
          </h3>
          <div className="mt-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
            Submitted
          </div>
          <div className="mt-1 text-xs font-semibold text-slate-700">
            {submission.timestampLabel}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {statusBadge}
          {hasMeeting ? <StatusBadge kind="alert" label="Meeting Scheduled" /> : null}
        </div>
      </div>

      <p className="mt-4 text-sm font-semibold text-slate-800">
        {submission.description}
      </p>

      <div className="mt-5 space-y-2">
        <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
          Files
        </div>
        {submission.files && submission.files.length ? (
          <ul className="space-y-2">
            {submission.files.map((f) => (
              <li
                key={f.id}
                className={cx(
                  "flex items-center justify-between gap-3 rounded-2xl border bg-white/70 px-3 py-2",
                  fileRowBorder
                )}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">
                    {f.name}
                  </div>
                  <div className="text-xs font-semibold text-slate-600">
                    {formatBytes(f.size)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (submission.fileUrl && submissionsApi?.downloadFileFromUrl) {
                      const { error } = await submissionsApi.downloadFileFromUrl({
                        url: submission.fileUrl,
                        filename: f.name
                      });
                      if (error) {
                        // eslint-disable-next-line no-console
                        console.error("Download failed:", error);
                        // As a last resort, open in a new tab (may preview inline depending on browser)
                        window.open(submission.fileUrl, "_blank", "noopener,noreferrer");
                      }
                      return;
                    }

                    // Fallback: keep old placeholder behavior only when no actual file URL exists.
                    downloadPlaceholderFile(f.name);
                  }}
                  className={cx(
                    "inline-flex items-center justify-center rounded-xl border bg-white px-3 py-2",
                    fileRowBorder,
                    "text-xs font-extrabold text-slate-700 shadow-sm transition hover:bg-white active:bg-slate-50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tealbrand-500 focus-visible:ring-offset-2"
                  )}
                  aria-label={`Download ${f.name}`}
                  title={submission.fileUrl ? "Download uploaded file" : "Download"}
                >
                  <DownloadIcon />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div
            className={cx(
              "rounded-2xl border border-dashed px-4 py-4 text-sm font-semibold",
              hasMeeting
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : isReviewed
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-tealbrand-200 bg-white/60 text-slate-700"
            )}
          >
            No files attached.
          </div>
        )}
      </div>

      {submission.meeting ? (
        <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="text-xs font-extrabold uppercase tracking-wide text-amber-900">
            Scheduled Meeting
          </div>
          <div className="mt-1 text-sm font-semibold text-amber-950">
            {submission.meeting.date} • {submission.meeting.time}
          </div>
          <div className="mt-1 text-sm font-semibold text-amber-900">
            {submission.meeting.description}
          </div>
        </div>
      ) : null}

      {variant === "intern" ? (
        <div className="mt-6 flex items-center justify-end gap-2">
          <IconButton label="Edit" onClick={onEdit}>
            <EditIcon />
          </IconButton>
          <IconButton label="Delete" onClick={onDelete} danger>
            <TrashIcon />
          </IconButton>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ActionButton kind="success" onClick={onReviewedSuccessfully}>
            Reviewed Successfully
          </ActionButton>
          <ActionButton kind="schedule" onClick={onScheduleMeeting}>
            Schedule Meeting
          </ActionButton>
        </div>
      )}

      {mentorRemarkBottom ? (
        <div className={cx("mt-6 rounded-2xl border-2 border-tealbrand-300 bg-white/90 px-4 py-3")}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold uppercase tracking-wide text-tealbrand-800">
              remarks added
            </span>
            <span className="text-xs font-semibold text-tealbrand-700 bg-tealbrand-50 px-2 py-0.5 rounded border border-tealbrand-100">
              New
            </span>
          </div>
          <div className="text-sm font-semibold text-tealbrand-900 whitespace-pre-line">
            {submission.mentorRemark}
          </div>
        </div>
      ) : null}

      {renderExtraActions}
    </article>
  );
}

// PUBLIC_INTERFACE
function EditSubmissionModal({ open, submission, onClose, onImmediatePatch }) {
  const titleId = "editWorkTitle";
  const descId = "editWorkDesc";
  const fileId = "editWorkFiles";

  const titleInputRef = useRef(null);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftFiles, setDraftFiles] = useState([]);

  useEffect(() => {
    if (!open || !submission) return;

    setDraftTitle(submission.title || "");
    setDraftDescription(submission.description || "");
    setDraftFiles(Array.isArray(submission.files) ? submission.files : []);

    const t = setTimeout(() => titleInputRef.current?.focus?.(), 0);
    return () => clearTimeout(t);
  }, [open, submission]);

  if (!open || !submission) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Edit Submission"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border-2 border-tealbrand-900 bg-tealbrand-900 shadow-xl">
        <header className="border-b border-tealbrand-800/70 px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-black tracking-tight">Edit Submission</h2>
              <div className="mt-1 text-xs font-semibold text-white/85">
                Submitted:{" "}
                <span className="font-extrabold text-white">{submission.timestampLabel}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={cx(
                "inline-flex h-9 items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-3 text-xs font-extrabold text-white",
                "shadow-sm transition hover:bg-white/15 active:bg-white/20",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-tealbrand-900"
              )}
            >
              ✕
              <span className="sr-only">Close</span>
            </button>
          </div>
        </header>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            <div>
              <label htmlFor={titleId} className="text-sm font-extrabold text-white">
                Work Title
              </label>
              <input
                ref={titleInputRef}
                id={titleId}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="e.g., Weekly progress report"
                className="mt-2 w-full rounded-2xl border border-white/20 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-tealbrand-200 focus:ring-2 focus:ring-white/40"
              />
            </div>

            <div>
              <label htmlFor={descId} className="text-sm font-extrabold text-white">
                Description
              </label>
              <textarea
                id={descId}
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="Write a short summary…"
                rows={6}
                className="mt-2 w-full resize-none rounded-2xl border border-white/20 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-tealbrand-200 focus:ring-2 focus:ring-white/40"
              />
              <div className="mt-1 text-xs font-semibold text-white/75">
                Scroll inside the modal if content is long.
              </div>
            </div>

            <div>
              <div className="text-sm font-extrabold text-white">Attached Files</div>
              <div className="mt-1 text-xs font-semibold text-white/75">
                Remove existing files or add new ones. Changes apply when you click “Save Changes”.
              </div>

              {draftFiles && draftFiles.length ? (
                <ul className="mt-3 space-y-2">
                  {draftFiles.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/10 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{f.name}</div>
                        <div className="text-xs font-semibold text-white/70">
                          {formatBytes(f.size)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (submission.fileUrl && submissionsApi?.downloadFileFromUrl) {
                              const { error } = await submissionsApi.downloadFileFromUrl({
                                url: submission.fileUrl,
                                filename: f.name
                              });
                              if (error) {
                                // eslint-disable-next-line no-console
                                console.error("Download failed:", error);
                                window.open(submission.fileUrl, "_blank", "noopener,noreferrer");
                              }
                              return;
                            }
                            downloadPlaceholderFile(f.name);
                          }}
                          className={cx(
                            "inline-flex items-center justify-center rounded-xl border border-white/20 bg-white px-3 py-2",
                            "text-xs font-extrabold text-tealbrand-900 shadow-sm transition hover:bg-white/95 active:bg-white/90",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-tealbrand-900"
                          )}
                          aria-label={`Download ${f.name}`}
                          title={submission.fileUrl ? "Download uploaded file" : "Download"}
                        >
                          <DownloadIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDraftFiles((prev) => prev.filter((x) => x.id !== f.id))}
                          className={cx(
                            "inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 px-3 py-2",
                            "text-xs font-extrabold text-white shadow-sm transition hover:bg-white/15 active:bg-white/20",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-tealbrand-900"
                          )}
                          aria-label={`Remove ${f.name}`}
                          title="Remove"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 rounded-2xl border border-dashed border-white/25 bg-white/10 px-4 py-4 text-sm font-semibold text-white/85">
                  No files attached.
                </div>
              )}

              <div className="mt-4">
                <label htmlFor={fileId} className="text-sm font-extrabold text-white">
                  Add Files
                </label>
                <input
                  id={fileId}
                  type="file"
                  multiple
                  onChange={(e) => {
                    const toAdd = Array.from(e.target.files || []).map((file) => ({
                      id: cryptoLikeId(),
                      name: file.name || "file",
                      size: typeof file.size === "number" ? file.size : 0
                    }));
                    if (toAdd.length) setDraftFiles((prev) => [...prev, ...toAdd]);
                    e.target.value = "";
                  }}
                  className="mt-2 block w-full cursor-pointer rounded-2xl border border-white/20 bg-white text-sm font-semibold text-slate-700 file:mr-4 file:cursor-pointer file:rounded-xl file:border-0 file:bg-tealbrand-800 file:px-4 file:py-2.5 file:text-sm file:font-extrabold file:text-white hover:file:bg-tealbrand-700"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-tealbrand-800/70 bg-tealbrand-900 px-5 py-4">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-white/15 active:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-tealbrand-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onImmediatePatch({
                  title: draftTitle,
                  description: draftDescription,
                  files: draftFiles
                });
                onClose();
              }}
              className="inline-flex h-10 items-center justify-center rounded-2xl bg-white px-5 text-sm font-extrabold text-tealbrand-900 shadow-sm transition hover:bg-white/95 active:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-tealbrand-900"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Simple compact modal for scheduling a meeting */
function MeetingModal({ open, submission, onClose, onSchedule }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [desc, setDesc] = useState("");

  const lastOpenRef = useRef(false);
  if (open && !lastOpenRef.current) {
    lastOpenRef.current = true;
    queueMicrotask(() => {
      setDate("");
      setTime("");
      setDesc("");
    });
  }
  if (!open && lastOpenRef.current) lastOpenRef.current = false;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Schedule Meeting"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border-2 border-tealbrand-900 bg-tealbrand-900 shadow-xl">
        <header className="border-b border-tealbrand-800/70 px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-black tracking-tight">Schedule Meeting</h2>
              {submission ? (
                <div className="mt-2 text-xs font-semibold text-white/80">
                  For: <span className="font-extrabold text-white">{submission.title}</span>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className={cx(
                "inline-flex h-9 items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-3 text-xs font-extrabold text-white",
                "shadow-sm transition hover:bg-white/15 active:bg-white/20",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-tealbrand-900"
              )}
            >
              ✕
              <span className="sr-only">Close</span>
            </button>
          </div>
        </header>

        <div className="px-5 py-5">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const d = date.trim();
              const t = time.trim();
              const s = desc.trim();
              if (!d || !t || !s) return;
              onSchedule({ date: d, time: t, description: s });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="mDate" className="text-sm font-extrabold text-white">
                  Date
                </label>
                <input
                  id="mDate"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-tealbrand-200 focus:ring-2 focus:ring-white/40"
                />
              </div>
              <div>
                <label htmlFor="mTime" className="text-sm font-extrabold text-white">
                  Time
                </label>
                <input
                  id="mTime"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-tealbrand-200 focus:ring-2 focus:ring-white/40"
                />
              </div>
            </div>

            <div>
              <label htmlFor="mDesc" className="text-sm font-extrabold text-white">
                Short Description
              </label>
              <textarea
                id="mDesc"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="e.g., Quick check-in on the latest submission and next steps."
                rows={3}
                className="mt-2 w-full resize-none rounded-2xl border border-white/20 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-tealbrand-200 focus:ring-2 focus:ring-white/40"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-white/15 active:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-tealbrand-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-2xl bg-white px-5 text-sm font-extrabold text-tealbrand-900 shadow-sm transition hover:bg-white/95 active:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-tealbrand-900"
              >
                Schedule
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <h3 className="text-sm font-black text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-slate-600">
        {description}
      </p>
    </div>
  );
}

function StatusBadge({ kind, label }) {
  const styles = {
    success: "bg-emerald-50 text-emerald-800 ring-emerald-200 border-emerald-200",
    alert: "bg-amber-50 text-amber-900 ring-amber-200 border-amber-200"
  };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold ring-1 ring-inset",
        styles[kind] || "bg-slate-50 text-slate-800 ring-slate-200 border-slate-200"
      )}
    >
      {label}
    </span>
  );
}

function ActionButton({ kind, children, onClick }) {
  const variants = {
    success:
      "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 focus-visible:ring-emerald-300",
    schedule:
      "bg-tealbrand-600 text-white hover:bg-tealbrand-700 active:bg-tealbrand-800 focus-visible:ring-tealbrand-300"
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex h-10 items-center justify-center rounded-2xl px-3 text-xs font-extrabold shadow-sm transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        variants[kind] || variants.schedule
      )}
    >
      {children}
    </button>
  );
}

function IconButton({ label, onClick, danger, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-extrabold shadow-sm transition",
        danger
          ? "border-slate-200 bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950"
          : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tealbrand-500 focus-visible:ring-offset-2"
      )}
      aria-label={label}
      title={label}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/** Helpers */

function cryptoLikeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, idx);
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function downloadPlaceholderFile(filename) {
  const safeName = filename || "download.txt";
  const content = `T3Log UI-only download\n\nFilename: ${safeName}\nGenerated: ${new Date().toLocaleString()}\n\nThis is placeholder content to demonstrate a download action without a backend.`;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName.endsWith(".txt") ? safeName : `${safeName}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

/** Icons (inline SVG, no deps) */

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path
        d="M12 3v10m0 0 4-4m-4 4-4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 17v3h16v-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path
        d="M3 6h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8 6V4h8v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M6 6l1 16h10l1-16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path
        d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M13 12H3m0 0 3-3m-3 3 3 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InternIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M4 21a8 8 0 0 1 16 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MentorIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path
        d="M3 7l9-4 9 4-9 4-9-4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M21 10v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M5 11v5c0 1 3 3 7 3s7-2 7-3v-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default App;
