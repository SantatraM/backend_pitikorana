export default class Utilisateur {
  constructor({ id, personne, contact, role, statut } = {}) {
    this.id = id;
    this.personne = personne;
    this.contact = contact;
    this.role = role;
    this.statut = statut;
  }

  toJSON() {
    return { id: this.id, personne: this.personne, contact: this.contact, role: this.role, statut: this.statut };
  }
}