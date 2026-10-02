export default class SosoKevitraCategorieContribution {
  constructor({ id = null, code, ordre, libelle = null, actif = true }) {
    this.id = id;
    this.code = code;
    this.ordre = ordre;
    this.libelle = libelle;
    this.actif = actif;
  }

  toJSON() {
    return {
      id: this.id,
      code: this.code,
      ordre: this.ordre,
      libelle: this.libelle,
      actif: this.actif,
    };
  }
}
