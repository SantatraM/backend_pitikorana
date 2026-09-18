import { createClient } from "@supabase/supabase-js";
import { getRequestContext } from "../config/requestContext.js";

function authError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function createSupabaseAuthClient() {
  const env = getRequestContext()?.env;
  const url = env?.SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = env?.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw authError(
      "La configuration Supabase Auth est indisponible",
      "AUTH_CONFIG_UNAVAILABLE",
    );
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
