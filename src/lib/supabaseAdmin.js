import { createClient } from "@supabase/supabase-js";
import { getRequestContext } from "../config/requestContext.js";

function authError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getSupabaseAdminConfig() {
  const env = getRequestContext()?.env;
  const url = env?.SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey =
    env?.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    env?.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    throw authError(
      "La configuration Supabase Auth est indisponible",
      "AUTH_CONFIG_UNAVAILABLE",
    );
  }

  return { url, serviceRoleKey };
}

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
