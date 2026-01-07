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

// PUBLIC_INTERFACE
export const listSubmissions = async () => {
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .order("created_at", { ascending: false });

  return { data, error };
};

// PUBLIC_INTERFACE
export const createSubmission = async (payload) => {
  const { data, error } = await supabase
    .from("submissions")
    .insert([payload])
    .select("*")
    .single();

  return { data, error };
};

// PUBLIC_INTERFACE
export const updateSubmission = async (id, patch) => {
  const { data, error } = await supabase
    .from("submissions")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  return { data, error };
};
