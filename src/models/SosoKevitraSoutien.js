export default class SosoKevitraSoutien {
  constructor({ id_soso_kevitra, id_personne, date_soutien }) {
    this.id_soso_kevitra = id_soso_kevitra;
    this.id_personne = id_personne;
    this.date_soutien = date_soutien;
  }

  toJSON() {
    return {
      id_soso_kevitra: this.id_soso_kevitra,
      id_personne: this.id_personne,
      date_soutien: this.date_soutien,
    };
  }
}