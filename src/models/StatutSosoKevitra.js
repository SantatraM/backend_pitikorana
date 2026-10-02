export default class StatutSosoKevitra {
  constructor({ id = null, code, ordre, libelle = null }) {
    this.id = id;
    this.code = code;
    this.ordre = ordre;
    this.libelle = libelle;
  }

  toJSON() {
    return {
      id: this.id,
      code: this.code,
      ordre: this.ordre,
      libelle: this.libelle,
    };
  }
}
