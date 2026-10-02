function nullableText(value, field, maxLength = null) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error(`Le champ ${field} est invalide`);

  const normalized = value.trim();
  if (!normalized) return null;
  if (maxLength !== null && normalized.length > maxLength) {
    throw new Error(`Le champ ${field} est trop long`);
  }
  return normalized;
}

function boolean(value, field, defaultValue) {
  if (value === undefined) return defaultValue;
  if (typeof value !== "boolean") {
    throw new Error(`Le champ ${field} doit être un booléen`);
  }
  return value;
}

function devise(value) {
  if (value === undefined || value === null || value === "") return "MGA";
  if (typeof value !== "string" || !/^[A-Za-z]{3}$/.test(value.trim())) {
    throw new Error("La devise est invalide");
  }
  return value.trim().toUpperCase();
}

export default class SosoKevitra {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.id_auteur = data.id_auteur ?? null;
    this.titre = nullableText(data.titre, "titre", 200);
    this.description = nullableText(data.description, "description");
    this.raison = nullableText(data.raison, "raison");
    this.objectif = nullableText(data.objectif, "objectif");
    this.beneficiaires = nullableText(data.beneficiaires, "beneficiaires");
    this.lieu = nullableText(data.lieu, "lieu");
    this.lieu_non_defini = boolean(
      data.lieu_non_defini,
      "lieu_non_defini",
      false,
    );
    this.details_realisation = nullableText(
      data.details_realisation,
      "details_realisation",
    );
    this.ressources_necessaires = nullableText(
      data.ressources_necessaires,
      "ressources_necessaires",
    );
    this.budget_non_defini = boolean(
      data.budget_non_defini,
      "budget_non_defini",
      false,
    );
    this.devise = devise(data.devise);
    this.periode_souhaitee = nullableText(
      data.periode_souhaitee,
      "periode_souhaitee",
    );
    this.id_statut_soso_kevitra = data.id_statut_soso_kevitra ?? null;
    this.date_publication = data.date_publication ?? null;
    this.date_fin_consultation = data.date_fin_consultation ?? null;
    this.date_creation = data.date_creation ?? null;
    this.date_modification = data.date_modification ?? null;
  }

  toJSON() {
    return {
      id: this.id,
      id_auteur: this.id_auteur,
      titre: this.titre,
      description: this.description,
      raison: this.raison,
      objectif: this.objectif,
      beneficiaires: this.beneficiaires,
      lieu: this.lieu,
      lieu_non_defini: this.lieu_non_defini,
      details_realisation: this.details_realisation,
      ressources_necessaires: this.ressources_necessaires,
      budget_non_defini: this.budget_non_defini,
      devise: this.devise,
      periode_souhaitee: this.periode_souhaitee,
      id_statut_soso_kevitra: this.id_statut_soso_kevitra,
      date_publication: this.date_publication,
      date_fin_consultation: this.date_fin_consultation,
      date_creation: this.date_creation,
      date_modification: this.date_modification,
    };
  }
}
