function normalizeNullableString(value, fieldName) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`Le champ ${fieldName} doit être une chaîne de caractères`);
  }

  return value.trim() || null;
}

export default class PersonneActivite {
  constructor({
    id = null,
    id_personne,
    id_activite,
    id_domaine_activite = null,
    activite = null,
    domaine_activite = null,
    lieu_travail = null,
    etude_en_cours = null,
    formations = null,
    experience_anterieur = null,
    diplome_ou_apprentissage = null,
  }) {
    if (!id_personne || String(id_personne).trim() === "") {
      throw new Error("La personne est obligatoire");
    }

    if (!id_activite || String(id_activite).trim() === "") {
      throw new Error("L'activité est obligatoire");
    }

    this.id = id;
    this.id_personne = id_personne;
    this.id_activite = id_activite;
    this.id_domaine_activite = id_domaine_activite ?? null;
    this.activite = activite ?? null;
    this.domaine_activite = domaine_activite ?? null;
    this.lieu_travail = normalizeNullableString(lieu_travail, "lieu_travail");
    this.etude_en_cours = normalizeNullableString(
      etude_en_cours,
      "etude_en_cours",
    );
    this.formations = normalizeNullableString(formations, "formations");
    this.experience_anterieur = normalizeNullableString(
      experience_anterieur,
      "experience_anterieur",
    );
    this.diplome_ou_apprentissage = normalizeNullableString(
      diplome_ou_apprentissage,
      "diplome_ou_apprentissage",
    );
  }

  toJSON() {
    return {
      id: this.id,
      id_personne: this.id_personne,
      id_activite: this.id_activite,
      id_domaine_activite: this.id_domaine_activite,
      activite: this.activite,
      domaine_activite: this.domaine_activite,
      lieu_travail: this.lieu_travail,
      etude_en_cours: this.etude_en_cours,
      formations: this.formations,
      experience_anterieur: this.experience_anterieur,
      diplome_ou_apprentissage: this.diplome_ou_apprentissage,
    };
  }
}
