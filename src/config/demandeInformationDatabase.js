// Only code-side routing is prepared here. Creating/configuring the additional
// cache-disabled binding is a separate infrastructure operation requiring approval.
export function isInformationRequest(pathname) {
  // Express routes are case-insensitive by default. Classifying only the lower-
  // case spelling would let a case variant use the shared cached connection.
  let path = pathname;
  try { path = decodeURIComponent(pathname); } catch { /* Keep malformed paths conservative. */ }
  return /^\/api\/demandes-information(?:\/|$)/i.test(path);
}

export function databaseBindingForRequest(pathname, env) {
  if (!isInformationRequest(pathname)) return env.HYPERDRIVE;
  const binding = env.HYPERDRIVE_INFORMATION;
  if (typeof binding?.connectionString !== "string" || !binding.connectionString) {
    // Never fall back to the shared, potentially cached connection for this module.
    throw Object.assign(new Error("INFORMATION_DATABASE_UNAVAILABLE"), { code: "INFORMATION_DATABASE_UNAVAILABLE" });
  }
  return binding;
}
