import { supabase } from "./supabaseClient";

/**
 * Submissions API (Supabase)
 *
 * Table: public."log-creation"
 * Storage bucket: intern-work (PUBLIC)
 *
 * All uploads must go to the public "intern-work" bucket.
 * The DB row's file_url must be set to Supabase's public URL for that file.
 * The UI must always use file_url for downloads/click actions.
 *
 * This module provides a small adapter that maps DB rows to the richer UI submission
 * shape used by `src/App.js`.
 */

const STORAGE_BUCKET = "intern-work";
// IMPORTANT: Table name contains a hyphen, so it must be passed as a quoted identifier.
const TABLE_NAME = "log-creation";

/**
 * Creates a deterministic-ish storage object path for the submission file.
 * This follows a convention that is unique and easy to browse.
 */
function buildSubmissionObjectPath(submissionId, file) {
  const safeName = (file?.name || "file").replace(/[^\w.\-]+/g, "_");
  return `submissions/${submissionId}/${Date.now()}_${safeName}`;
}

/**
 * Best-effort filename extraction for UI display.
 */
function guessFilenameFromUrl(url) {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (!last) return null;
    return last.replace(/^\d+_/, "");
  } catch {
    return null;
  }
}

/**
 * Best-effort content-type guess from filename.
 * This is used only as fallback if the server does not return Content-Type.
 */
function guessMimeFromFilename(name) {
  const n = (name || "").toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".svg")) return "image/svg+xml";
  if (n.endsWith(".txt")) return "text/plain";
  if (n.endsWith(".csv")) return "text/csv";
  if (n.endsWith(".json")) return "application/json";
  if (n.endsWith(".zip")) return "application/zip";
  if (n.endsWith(".doc")) return "application/msword";
  if (n.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (n.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (n.endsWith(".pptx"))
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (n.endsWith(".xls")) return "application/vnd.ms-excel";
  if (n.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/octet-stream";
}

/**
 * Convert a Supabase row into the UI submission shape used by App.js.
 * Note: DB schema is simpler than UI (meeting, files[] list, timestampLabel).
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

  // UI uses files[]; DB stores a single file_url. Display a single file row if present.
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
    meeting: null, // not persisted in current DB schema
    mentorRemark: row.mentor_remark ?? undefined,
    fileUrl: row.file_url || null,
    internEmail: row.intern_email || undefined
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

  return dbPatch;
}

/**
 * Attempt to determine the storage object's path from a Supabase public URL.
 * Expected pattern for public buckets:
 *   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<objectPath>
 *
 * Returns: { bucket, objectPath } or null if not derivable.
 */
function parseSupabasePublicObjectUrl(url) {
  if (!url) return null;

  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);

    // storage/v1/object/public/<bucket>/<...objectPath>
    const storageIdx = parts.indexOf("storage");
    if (storageIdx < 0) return null;

    const v1Idx = storageIdx + 1;
    const objectIdx = storageIdx + 2;
    const publicIdx = storageIdx + 3;
    const bucketIdx = storageIdx + 4;

    if (
      parts[v1Idx] !== "v1" ||
      parts[objectIdx] !== "object" ||
      parts[publicIdx] !== "public"
    ) {
      return null;
    }

    const bucket = parts[bucketIdx];
    const objectPathParts = parts.slice(bucketIdx + 1);
    const objectPath = objectPathParts.join("/");
    if (!bucket || !objectPath) return null;

    return { bucket, objectPath };
  } catch {
    return null;
  }
}

/**
 * Adds actionable guidance when a Supabase request fails due to RLS/policies.
 */
function decorateRlsGuidance(err, { action, tableName }) {
  const msg = String(err?.message || err || "");
  const looksLikeRls =
    msg.toLowerCase().includes("row-level security") ||
    msg.toLowerCase().includes("permission denied") ||
    msg.toLowerCase().includes("not allowed") ||
    msg.toLowerCase().includes("policy");

  if (!looksLikeRls) return err;

  const guidance =
    `\n\nLikely cause: Supabase RLS policy missing for ${action} on public."${tableName}".` +
    `\nFix in Supabase SQL editor (DEV/permissive example):` +
    `\n\ncreate policy "allow ${action.toLowerCase()} all" on public."${tableName}"` +
    `\nfor ${action.toLowerCase()} using (true);` +
    `\n\n(Adjust conditions later for proper auth ownership.)`;

  const enhanced = new Error(`${msg}${guidance}`);
  // Preserve original metadata if present
  enhanced.code = err?.code;
  enhanced.details = err?.details;
  enhanced.hint = err?.hint;
  return enhanced;
}

// PUBLIC_INTERFACE
export const listSubmissions = async () => {
  /** List submissions newest-first from public."log-creation". */
  const { data, error } = await supabase
    .from(TABLE_NAME)
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
export const refreshSubmissionsAsUi = async () => {
  /**
   * PUBLIC_INTERFACE
   * Hard refresh: re-fetch from DB to guarantee UI matches persisted state.
   * Useful after deletes and to recover from missed realtime events.
   */
  return listSubmissionsAsUi();
};

// PUBLIC_INTERFACE
export const createSubmission = async (payload) => {
  /** Create a submission row. */
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert([payload])
    .select("*")
    .single();

  return { data, error };
};

// PUBLIC_INTERFACE
export const updateSubmission = async (id, patch) => {
  /** Update a submission row by id. */
  const { data, error } = await supabase
    .from(TABLE_NAME)
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
export const deleteSubmission = async (id, opts = {}) => {
  /**
   * PUBLIC_INTERFACE
   * Delete a submission row by id, and optionally delete the Storage file.
   *
   * Why this exists:
   * - The user's bug ("deleted cards reappear after refresh") is usually caused by:
   *   (a) the DB row never actually deleted (RLS policy missing for DELETE), or
   *   (b) the UI only removed locally but refresh pulls from DB again.
   *
   * Options:
   * - { removeStorage: boolean, fileUrl?: string }
   *
   * NOTE:
   * - DB DELETE requires Supabase RLS policy allowing DELETE on public."log-creation".
   * - Storage deletion requires appropriate policies on storage.objects for bucket intern-work.
   */
  const { removeStorage = true, fileUrl = null } = opts;

  if (!id) return { error: new Error("Missing submission id"), storageError: null };

  let storageError = null;

  // Best effort: delete the storage object if we can derive its path and policies allow it.
  if (removeStorage && fileUrl) {
    const parsed = parseSupabasePublicObjectUrl(fileUrl);
    if (parsed?.bucket === STORAGE_BUCKET && parsed.objectPath) {
      const { error: rmError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([parsed.objectPath]);

      if (rmError) {
        // Non-fatal: we still want the DB row removed even if the file could not be removed.
        storageError = rmError;
      }
    }
  }

  const { error: dbErrorRaw } = await supabase.from(TABLE_NAME).delete().eq("id", id);

  const error = dbErrorRaw
    ? decorateRlsGuidance(dbErrorRaw, { action: "DELETE", tableName: TABLE_NAME })
    : null;

  return { error, storageError };
};

// PUBLIC_INTERFACE
export const uploadSubmissionFile = async (submissionId, file) => {
  /**
   * Upload a single file to Supabase Storage and return a public URL.
   *
   * Bucket: intern-work (expected PUBLIC)
   * Path: submissions/<submission_id>/<timestamp>_<original_filename>
   *
   * This method ensures uploaded files are visible in the "intern-work" bucket
   * and that we always extract and return the public URL (file_url).
   */
  if (!submissionId) {
    return {
      publicUrl: null,
      objectPath: null,
      error: new Error("Missing submissionId")
    };
  }
  if (!file) {
    return { publicUrl: null, objectPath: null, error: new Error("Missing file") };
  }

  const objectPath = buildSubmissionObjectPath(submissionId, file);

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(objectPath, file, { upsert: false });

  if (uploadError) {
    return { publicUrl: null, objectPath, error: uploadError };
  }

  // getPublicUrl returns { publicUrl: ... }
  const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath);
  const publicUrl = publicData?.publicUrl || null;

  if (!publicUrl) {
    return {
      publicUrl: null,
      objectPath,
      error: new Error(
        "Upload succeeded but could not derive public URL (bucket may not be public)."
      )
    };
  }

  return { publicUrl, objectPath, error: null };
};

// PUBLIC_INTERFACE
export const createSubmissionWithOptionalUpload = async ({ payload, file }) => {
  /**
   * PUBLIC_INTERFACE
   * Handles Supabase upload flow:
   * 1) Inserts row in DB (table: log-creation)
   * 2) If file present, uploads file to the public "intern-work" bucket, retrieves its public URL,
   *    and updates the corresponding DB row's file_url column.
   * 3) Returns the DB row (with file_url set if upload succeeded).
   */
  const { data: created, error: createError } = await createSubmission(payload);
  if (createError || !created) return { data: null, error: createError };

  if (!file) return { data: created, error: null };

  // Attempt file upload. If fails, row is left with file_url set to null.
  const { publicUrl, error: uploadError } = await uploadSubmissionFile(created.id, file);

  if (uploadError) {
    // Keep the created submission even if file upload fails; caller can show a warning.
    return { data: created, error: uploadError };
  }

  // Update the newly created DB row with the file_url (public URL from Supabase Storage)
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
   * Subscribe to realtime changes for public."log-creation".
   *
   * Returns an object with an unsubscribe() function.
   *
   * NOTE: Requires Supabase Realtime enabled and appropriate RLS/policies allowing SELECT.
   */
  const channel = supabase
    .channel(`realtime:public.${TABLE_NAME}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: TABLE_NAME },
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
      { event: "UPDATE", schema: "public", table: TABLE_NAME },
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
      { event: "DELETE", schema: "public", table: TABLE_NAME },
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
      console.log(`[realtime] ${TABLE_NAME} channel status:`, status);
    });

  return {
    // PUBLIC_INTERFACE
    unsubscribe() {
      /** Unsubscribe from the realtime channel. */
      supabase.removeChannel(channel);
    }
  };
};

// PUBLIC_INTERFACE
export const mapDbRowToUi = (row) => {
  /** Exported for cases where App.js wants to map returned rows directly. */
  return mapRowToUiSubmission(row);
};

// PUBLIC_INTERFACE
export const downloadFileFromUrl = async ({ url, filename }) => {
  /**
   * PUBLIC_INTERFACE
   * Download the actual file bytes from a public URL, and trigger a browser download.
   *
   * Why: opening the URL in a new tab often works, but can result in inline preview
   * or a confusing filename. Fetch->blob->a[download] gives consistent behavior and
   * ensures the saved file is not placeholder content.
   */
  if (!url) return { error: new Error("Missing file URL") };

  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      return { error: new Error(`Failed to download file (HTTP ${response.status})`) };
    }

    const contentType =
      response.headers.get("content-type") ||
      guessMimeFromFilename(filename) ||
      "application/octet-stream";

    const blobData = await response.blob();
    const blob = blobData.type ? blobData : new Blob([blobData], { type: contentType });

    const safeName = filename || guessFilenameFromUrl(url) || "download";
    const objectUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error("Download failed") };
  }
};
