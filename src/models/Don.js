const DONATEUR_TYPES = new Set(["TARANAKA", "SAMPANA", "FOYER", "PERSONNE"]);
const DON_TYPES = new Set(["ARGENT", "MATERIEL"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POSITIVE_DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeText(value, field, maxLength, code) {
  if (typeof value !== "string") {
    throw businessError(`${field} est obligatoire.`, code);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw businessError(`${field} est invalide.`, code);
  }
  return normalized;
}

function normalizeOptionalText(value, field) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw businessError(`${field} est invalide.`, "DON_INVALID");
  }
  return value.trim() || null;
}

function normalizePositiveDecimal(value, field, code, decimalScale) {
  const normalized = typeof value === "number" ? String(value) : value;
  if (typeof normalized !== "string" || !POSITIVE_DECIMAL_PATTERN.test(normalized)) {
    throw businessError(`${field} doit être strictement positif.`, code);
  }
  const [integerPart, decimals = ""] = normalized.split(".");
  if (decimals.length > decimalScale || integerPart.length > 14 - decimalScale) {
    throw businessError(`${field} dépasse la précision autorisée.`, code);
  }
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw businessError(`${field} doit être strictement positif.`, code);
  }
  return normalized;
}

export default class Don {
  constructor(payload = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw businessError("Les données du don sont invalides.", "DON_INVALID");
    }
    if (!DONATEUR_TYPES.has(payload.type_donateur)) {
      throw businessError("Le type de donateur est invalide.", "DON_DONATEUR_INVALID");
    }
    if (typeof payload.id_donateur !== "string" || !UUID_PATTERN.test(payload.id_donateur)) {
      throw businessError("L'identifiant du donateur est invalide.", "DON_DONATEUR_INVALID");
    }
    if (!DON_TYPES.has(payload.type_don)) {
      throw businessError("Le type de don est invalide.", "DON_INVALID");
    }

    this.type_donateur = payload.type_donateur;
    this.id_donateur = payload.id_donateur.toLowerCase();
    this.type_don = payload.type_don;
    this.observation = normalizeOptionalText(payload.observation, "L'observation");

    if (this.type_don === "ARGENT") {
      this.montant = normalizePositiveDecimal(payload.montant, "Le montant", "DON_ARGENT_INVALID", 2);
      this.devise = normalizeText(payload.devise, "La devise", 10, "DON_ARGENT_INVALID").toUpperCase();
      this.designation = null;
      this.quantite = null;
      this.unite = null;
      return;
    }

    this.montant = null;
    this.devise = null;
    this.designation = normalizeText(payload.designation, "La désignation", 200, "DON_MATERIEL_INVALID");
    this.quantite = normalizePositiveDecimal(payload.quantite, "La quantité", "DON_MATERIEL_INVALID", 3);
    this.unite = normalizeText(payload.unite, "L'unité", 50, "DON_MATERIEL_INVALID");
  }
}