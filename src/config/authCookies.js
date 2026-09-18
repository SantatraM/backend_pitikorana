import { getRequestContext } from "./requestContext.js";

const DEFAULT_REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function getEnvironmentValue(name) {
  return getRequestContext()?.env?.[name] ?? process.env[name];
}

function isSecureCookie() {
  const configured = getEnvironmentValue("AUTH_COOKIE_SECURE");
  if (configured !== undefined) return configured === "true";
  return getEnvironmentValue("NODE_ENV") === "production";
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax",
    path: "/",
  };
}

export function accessTokenCookieOptions(session) {
  const maxAge = positiveInteger(session.expires_in, 3600) * 1000;
  return { ...baseCookieOptions(), maxAge };
}

export function refreshTokenCookieOptions() {
  const maxAge = positiveInteger(
    getEnvironmentValue("AUTH_REFRESH_COOKIE_MAX_AGE_MS"),
    DEFAULT_REFRESH_MAX_AGE_MS,
  );
  return { ...baseCookieOptions(), maxAge };
}

export function setAuthSessionCookies(res, session) {
  res.cookie(
    "pitikorana_access_token",
    session.access_token,
    accessTokenCookieOptions(session),
  );
  res.cookie(
    "pitikorana_refresh_token",
    session.refresh_token,
    refreshTokenCookieOptions(),
  );
}

export function clearAuthSessionCookies(res) {
  const options = baseCookieOptions();
  res.clearCookie("pitikorana_access_token", options);
  res.clearCookie("pitikorana_refresh_token", options);
}

export function getRequestCookie(req, name) {
  const header = req.headers?.cookie;
  if (typeof header !== "string") return null;

  for (const value of header.split(";")) {
    const [key, ...parts] = value.trim().split("=");
    if (key !== name) continue;
    const encoded = parts.join("=");
    if (!encoded) return null;
    try {
      return decodeURIComponent(encoded);
    } catch {
      return null;
    }
  }
  return null;
}
