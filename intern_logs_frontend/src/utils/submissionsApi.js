import { supabase } from "./supabaseClient";

/**
 * Submissions API
 * Table: public.submissions
 *
 * Columns:
 * - id (uuid)
 * - created_at (timestamptz)
 * - intern_email (text)
 * - title (text)
 * - description (text)
 * - status (text)
 * - mentor_remark (text, nullable)
 * - file_url (text, nullable)
 * - github_username (text, nullable)
 */

const STORAGE_BUCKET = "intern-work";

/**
 * Creates a deterministic-ish storage object path for the submission file.
 * This follows the convention documented in assets/supabase.md.
 */
function buildSubmissionObjectPath(submissionId, file) {
  const safeName = (file?.name || "file").replace(/[^\w.\-]+/g, "_");
  return `submissions/${submissionId}/${Date.now()}_${safeName}`;
}

/**
 * Convert a Supabase row into the UI submission shape used by App.js.
 * NOTE: The UI currently tracks a richer shape (timestampLabel, files[], meeting),
 * while the DB schema is simpler. We derive reasonable defaults here.
 */
function mapRowToUiSubmission(row) {
  const createdAt = row?.created_at ? new Date(row.created_at) : new Date();

  const timestampIso = createdAt.toISOString();
  const timestampLabel = createdAt.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

  // The DB stores only file_url. For UI, show a single file row if file_url exists.
  const files = row?.file_url
    ? [
        {
          id: `file-${row.id}`,
          name: guessFilenameFromUrl(row.file_url) || "uploaded_file",
          size: 0
        }
      ]
    : [];

  return {
    id: row.id,
    title: row.title || "",
    description: row.description || "",
    timestampIso,
    timestampLabel,
    files,
    status: row.status || "none",
    meeting: null, // not persisted in schema currently
    mentorRemark: row.mentor_remark ?? undefined,
    fileUrl: row.file_url || null,
    internEmail: row.intern_email || undefined,
    githubUsername: row.github_username || undefined
  };
}

/**
 * Convert UI patch into DB patch (only fields that exist in schema).
 */
function mapUiPatchToDbPatch(patch) {
  const dbPatch = {};

  if (Object.prototype.hasOwnProperty.call(patch, "status")) {
    dbPatch.status = patch.status;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "mentorRemark")) {
    dbPatch.mentor_remark = patch.mentorRemark ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "fileUrl")) {
    dbPatch.file_url = patch.fileUrl ?? null;
  }

  // NOTE: meeting is UI-only (not in schema). title/description editing is UI-only in this app currently.
  return dbPatch;
}

function guessFilenameFromUrl(url) {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (!last) return null;
    // remove leading "<timestamp>_" if present
    return last.replace(/^\d+_/, "");
  } catch {
    return null;
  }
}

// PUBLIC_INTERFACE
export const listSubmissions = async () => {
  /** List submissions newest-first. */
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .order("created_at", { ascending: false });

  return { data, error };
};

// PUBLIC_INTERFACE
export const listSubmissionsAsUi = async () => {
  /** List submissions newest-first and map into UI shape. */
  const { data, error } = await listSubmissions();
  if (error) return { data: null, error };
  return { data: (data || []).map(mapRowToUiSubmission), error: null };
};

// PUBLIC_INTERFACE
export const createSubmission = async (payload) => {
  /** Create a submission row. */
  const { data, error } = await supabase
    .from("submissions")
    .insert([payload])
    .select("*")
    .single();

  return { data, error };
};

// PUBLIC_INTERFACE
export const updateSubmission = async (id, patch) => {
  /** Update a submission row by id. */
  const { data, error } = await supabase
    .from("submissions")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  return { data, error };
};

// PUBLIC_INTERFACE
export const updateSubmissionFromUi = async (id, uiPatch) => {
  /**
   * Update submission using UI patch shape (e.g. {status, mentorRemark}).
   * Returns mapped UI submission.
   */
  const dbPatch = mapUiPatchToDbPatch(uiPatch);
  if (!id) return { data: null, error: new Error("Missing submission id") };
  if (!Object.keys(dbPatch).length) {
    return { data: null, error: new Error("No supported fields to update") };
  }

  const { data, error } = await updateSubmission(id, dbPatch);
  if (error) return { data: null, error };
  return { data: mapRowToUiSubmission(data), error: null };
};

// PUBLIC_INTERFACE
export const uploadSubmissionFile = async (submissionId, file) => {
  /**
   * Upload a single file to Supabase Storage and return a public URL.
   *
   * Bucket: intern-work (expected PUBLIC)
   * Path: submissions/<submission_id>/<timestamp>_<original_filename>
   */
  if (!submissionId) {
    return { publicUrl: null, objectPath: null, error: new Error("Missing submissionId") };
  }
  if (!file) {
    return { publicUrl: null, objectPath: null, error: new Error("Missing file") };
  }

  const objectPath = buildSubmissionObjectPath(submissionId, file);

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(objectPath, file, {
      // Avoid overwriting accidentally; path contains timestamp so collisions are unlikely.
      upsert: false
    });

  if (uploadError) {
    return { publicUrl: null, objectPath, error: uploadError };
  }

  const { data: publicData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(objectPath);

  const publicUrl = publicData?.publicUrl || null;

  if (!publicUrl) {
    return {
      publicUrl: null,
      objectPath,
      error: new Error("Upload succeeded but could not derive public URL (bucket may not be public).")
    };
  }

  return { publicUrl, objectPath, error: null };
};

// PUBLIC_INTERFACE
export const createSubmissionWithOptionalUpload = async ({ payload, file }) => {
  /**
   * Convenience wrapper:
   * 1) Create DB row
   * 2) If file present: upload to Storage, then update DB row with file_url
   */
  const { data: created, error: createError } = await createSubmission(payload);
  if (createError || !created) return { data: null, error: createError };

  if (!file) return { data: created, error: null };

  const { publicUrl, error: uploadError } = await uploadSubmissionFile(created.id, file);
  if (uploadError) {
    // Keep the created submission even if file upload fails; caller can show a warning.
    return { data: created, error: uploadError };
  }

  const { data: updated, error: updateError } = await updateSubmission(created.id, {
    file_url: publicUrl
  });

  if (updateError || !updated) {
    return { data: created, error: updateError };
  }

  return { data: updated, error: null };
};

// PUBLIC_INTERFACE
export const subscribeToSubmissionsChanges = ({ onInsert, onUpdate, onDelete }) => {
  /**
   * Subscribe to realtime changes for public.submissions.
   *
   * Returns an object with an unsubscribe() function.
   *
   * NOTE: Requires Supabase Realtime enabled and appropriate RLS/policies allowing SELECT.
   */
  const channel = supabase
    .channel("realtime:public.submissions")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "submissions" },
      (payload) => {
        try {
          const row = payload?.new;
          if (row && onInsert) onInsert(mapRowToUiSubmission(row));
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("Realtime INSERT handler failed:", e);
        }
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "submissions" },
      (payload) => {
        try {
          const row = payload?.new;
          if (row && onUpdate) onUpdate(mapRowToUiSubmission(row));
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("Realtime UPDATE handler failed:", e);
        }
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "submissions" },
      (payload) => {
        try {
          const oldRow = payload?.old;
          const id = oldRow?.id;
          if (id && onDelete) onDelete(id);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("Realtime DELETE handler failed:", e);
        }
      }
    )
    .subscribe((status) => {
      // eslint-disable-next-line no-console
      console.log("[realtime] submissions channel status:", status);
    });

  return {
    // PUBLIC_INTERFACE
    unsubscribe() {
      /** Unsubscribe from the submissions realtime channel. */
      supabase.removeChannel(channel);
    }
  };
};
