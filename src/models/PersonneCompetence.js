export default class PersonneCompetence {
  constructor({
    id = null,
    id_personne,
    id_competence,
    competence = null,
    partageable = false,
  }) {
    if (!id_personne || String(id_personne).trim() === "") {
      throw new Error("La personne est obligatoire");
    }

    if (!id_competence || String(id_competence).trim() === "") {
      throw new Error("La compétence est obligatoire");
    }

    if (typeof partageable !== "boolean") {
      throw new Error("Le champ partageable doit être un booléen");
    }

    this.id = id;
    this.id_personne = id_personne;
    this.id_competence = id_competence;
    this.competence = competence ?? null;
    this.partageable = partageable;
  }

  toJSON() {
    return {
      id: this.id,
      id_personne: this.id_personne,
      id_competence: this.id_competence,
      competence: this.competence,
      partageable: this.partageable,
    };
  }
}
