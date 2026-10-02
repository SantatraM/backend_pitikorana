const JOURNEE_STATUTS = new Set(["BROUILLON", "OUVERTE", "CLOTUREE"]);

function normalizeDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("La date de la journée est invalide.");
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("La date de la journée est invalide.");
  }

  return value;
}

function normalizeObservation(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("L'observation est invalide.");
  }

  return value.trim() || null;
}

export default class JourneeAlahadinTaranaka {
  constructor({
    id = null,
    date_journee,
    statut = "BROUILLON",
    observation = null,
    id_compte_createur = null,
    date_creation = null,
    date_modification = null,
    taranaka = [],
    createur = null,
  }) {
    if (!JOURNEE_STATUTS.has(statut)) {
      throw new Error("Le statut de la journée est invalide.");
    }

    this.id = id;
    this.date_journee = normalizeDate(date_journee);
    this.statut = statut;
    this.observation = normalizeObservation(observation);
    this.id_compte_createur = id_compte_createur;
    this.date_creation = date_creation;
    this.date_modification = date_modification;
    this.taranaka = Array.isArray(taranaka) ? taranaka : [];
    this.createur = createur;
  }
}