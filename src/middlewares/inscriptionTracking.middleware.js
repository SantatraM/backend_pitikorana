import { consumeTrackingQuota, trackingError } from "../services/inscriptionTracking.service.js";

export async function inscriptionTrackingLimit(req, res, next) {
  res.set("Cache-Control", "no-store");
  try {
    // Never trust caller-supplied forwarding headers. Shared proxies need their
    // own edge quota; do not change the application's authentication/proxy rules.
    const ip = req.socket?.remoteAddress;
    if (!ip) throw trackingError("TRACKING_UNAVAILABLE");
    await consumeTrackingQuota(`network:${ip}`, 30);
    const reference = typeof req.body?.reference === "string" ? req.body.reference.trim().toUpperCase() : "";
    const subject = /^PIT-\d{4}-[A-HJ-NP-Z2-9]{8}$/.test(reference) ? reference : "invalid";
    await consumeTrackingQuota(`reference:${subject}`, 10);
    return next();
  } catch (error) {
    const limited = error.code === "TRACKING_RATE_LIMIT";
    if (limited) res.set("Retry-After", String(error.retryAfter));
    return res.status(limited ? 429 : 503).json({ success: false, code: limited ? "TRACKING_RATE_LIMIT" : "TRACKING_UNAVAILABLE", message: limited ? "Trop de tentatives. Réessayez plus tard." : "Service temporairement indisponible." });
  }
}
