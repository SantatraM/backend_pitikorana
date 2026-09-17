export default class PersonneCentreInteret {
  constructor({ id = null, id_personne, id_centre_interet, centre_interet = null }) {
    if (!id_personne || String(id_personne).trim() === "") throw new Error("La personne est obligatoire");
    if (!id_centre_interet || String(id_centre_interet).trim() === "") throw new Error("Le centre d'intérêt est obligatoire");
    this.id = id;
    this.id_personne = id_personne;
    this.id_centre_interet = id_centre_interet;
    this.centre_interet = centre_interet ?? null;
  }
  toJSON() {
    return { id: this.id, id_personne: this.id_personne, id_centre_interet: this.id_centre_interet, centre_interet: this.centre_interet };
  }
}
