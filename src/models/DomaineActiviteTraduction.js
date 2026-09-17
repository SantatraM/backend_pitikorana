function normalizeLibelle(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Le libellé est obligatoire");
  }

  const libelle = value.trim();
  if (libelle.length > 150) {
    throw new Error("Le libellé ne doit pas dépasser 150 caractères");
  }

  return libelle;
}

export default class DomaineActiviteTraduction {
  constructor({
    id = null,
    id_domaine_activite = null,
    id_langue,
    code_langue = null,
    nom_langue = null,
    libelle,
  }) {
    if (!id_langue || String(id_langue).trim() === "") {
      throw new Error("La langue est obligatoire");
    }

    this.id = id;
    this.id_domaine_activite = id_domaine_activite;
    this.id_langue = id_langue;
    this.code_langue = code_langue;
    this.nom_langue = nom_langue;
    this.libelle = normalizeLibelle(libelle);
  }

  toJSON() {
    return {
      id: this.id,
      id_langue: this.id_langue,
      code_langue: this.code_langue,
      libelle: this.libelle,
    };
  }
}
