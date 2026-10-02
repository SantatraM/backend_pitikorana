function normalizePath(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Le chemin de la photo est obligatoire");
  }
  return value.trim();
}

function normalizeOrder(value) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new Error("L'ordre de la photo est invalide");
  }
  return normalized;
}

export default class SosoKevitraPhoto {
  constructor({
    id = null,
    id_soso_kevitra,
    chemin_photo,
    ordre,
    date_creation = null,
  }) {
    if (!id_soso_kevitra || String(id_soso_kevitra).trim() === "") {
      throw new Error("Le Soso-kevitra est obligatoire");
    }

    this.id = id;
    this.id_soso_kevitra = id_soso_kevitra;
    this.chemin_photo = normalizePath(chemin_photo);
    this.ordre = normalizeOrder(ordre);
    this.date_creation = date_creation;
  }

  toJSON() {
    return {
      id: this.id,
      id_soso_kevitra: this.id_soso_kevitra,
      chemin_photo: this.chemin_photo,
      ordre: this.ordre,
      date_creation: this.date_creation,
    };
  }
}
