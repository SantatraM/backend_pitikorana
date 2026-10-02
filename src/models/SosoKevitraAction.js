function ordre(value) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new Error("L'ordre de l'action est invalide");
  }
  return normalized;
}

export default class SosoKevitraAction {
  constructor({ id = null, id_soso_kevitra = null, description, ordre: position }) {
    if (typeof description !== "string" || !description.trim()) {
      throw new Error("La description de l'action est obligatoire");
    }
    this.id = id;
    this.id_soso_kevitra = id_soso_kevitra;
    this.description = description.trim();
    this.ordre = ordre(position);
  }

  toJSON() {
    return {
      id: this.id,
      id_soso_kevitra: this.id_soso_kevitra,
      description: this.description,
      ordre: this.ordre,
    };
  }
}
