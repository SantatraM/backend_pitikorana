function normalizePath(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Le chemin de la photo est obligatoire");
  }
  return value.trim();
}

export default class PhotoPersonne {
  constructor({ id = null, id_personne, chemin_photo }) {
    if (!id_personne || String(id_personne).trim() === "") {
      throw new Error("La personne est obligatoire");
    }

    this.id = id;
    this.id_personne = id_personne;
    this.chemin_photo = normalizePath(chemin_photo);
  }

  toJSON() {
    return {
      id: this.id,
      id_personne: this.id_personne,
      chemin_photo: this.chemin_photo,
    };
  }
}
