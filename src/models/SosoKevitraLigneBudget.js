function decimal(value, field, scale, precision) {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "number" && !Number.isFinite(value))
  ) {
    throw new Error(`Le champ ${field} est invalide`);
  }

  const normalized = String(value).trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error(`Le champ ${field} est invalide`);
  }

  const [whole, fraction = ""] = normalized.split(".");
  if (whole.length + fraction.length > precision || fraction.length > scale) {
    throw new Error(`Le champ ${field} est invalide`);
  }

  return normalized;
}

function ordre(value) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new Error("L'ordre de la ligne budget est invalide");
  }
  return normalized;
}

export default class SosoKevitraLigneBudget {
  constructor({
    id = null,
    id_soso_kevitra = null,
    designation,
    quantite,
    prix_unitaire_estime,
    ordre: position,
  }) {
    if (typeof designation !== "string" || !designation.trim()) {
      throw new Error("La désignation du budget est obligatoire");
    }

    this.id = id;
    this.id_soso_kevitra = id_soso_kevitra;
    this.designation = designation.trim();
    this.quantite = decimal(quantite, "quantite", 3, 12);
    this.prix_unitaire_estime = decimal(
      prix_unitaire_estime,
      "prix_unitaire_estime",
      2,
      18,
    );
    if (Number(this.quantite) <= 0 || Number(this.prix_unitaire_estime) < 0) {
      throw new Error("Les valeurs du budget sont invalides");
    }
    this.ordre = ordre(position);
  }

  toJSON() {
    return {
      id: this.id,
      id_soso_kevitra: this.id_soso_kevitra,
      designation: this.designation,
      quantite: this.quantite,
      prix_unitaire_estime: this.prix_unitaire_estime,
      ordre: this.ordre,
    };
  }
}
