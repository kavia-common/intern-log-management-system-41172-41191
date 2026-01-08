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
export const createSubmissionWithOptionalUpload = async ({
  payload,
  file
}) => {
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
