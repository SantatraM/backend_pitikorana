import test from 'node:test';
import assert from 'node:assert/strict';
import { runWithDatabaseClient } from '../src/config/db.js';
import { listContributions } from '../src/services/sosoKevitraContribution.service.js';
import { getSosoKevitraById } from '../src/services/sosoKevitra.service.js';
import { getContributions, addContribution } from '../src/controllers/sosoKevitra.controller.js';

const id = '11111111-1111-4111-8111-111111111111';
const auth = (role, person = 'owner') => ({ personne: { id: person }, compte: { role } });
const rows = ['VISIBLE', 'MASQUE', 'RETIRE'].map((etat, index) => ({
  id: `contribution-${index}`, id_auteur: 'owner', auteur_id: 'owner', nom: 'Auteur',
  etat, titre: 'Titre', description: 'Description', id_categorie: 'categorie', code: 'IDEA',
  statut_code: 'EN_CONSULTATION', date_serveur: '2026-01-01', date_fin_consultation: '2027-01-01',
}));
const history = { id_contribution: rows[0].id, action: 'MASQUER', raison: 'motif interne', date_action: '2026-02-01', personne_id: 'moderateur', nom: 'Moderateur' };

function fakeDb() {
  return { async query(sql) {
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [] };
    if (sql.includes('SELECT c.*, cat.code')) return { rows };
    if (sql.includes('FROM soso_kevitra_contribution_photo')) return { rows: [] };
    if (sql.includes('FROM soso_kevitra_moderation_contribution')) return { rows: [history] };
    if (sql.includes('FROM soso_kevitra_categorie_contribution WHERE')) return { rows: [{ id: 'categorie', code: 'IDEA' }] };
    if (sql.includes('FOR UPDATE OF s')) return { rows: [{ id, statut_code: 'EN_CONSULTATION', date_serveur: '2026-01-01', date_fin_consultation: '2027-01-01' }] };
    if (sql.includes('INSERT INTO soso_kevitra_contribution(')) return { rows: [{ id: rows[0].id }] };
    if (sql.includes('SELECT s.*, statut.code AS statut_code')) return { rows: [{ id, id_auteur: 'owner', statut_code: 'ACCEPTE', id_statut_soso_kevitra: 'statut' }] };
    if (sql.includes('AS nombre_soutiens')) return { rows: [{ nombre_soutiens: 0, utilisateur_soutient: false }] };
    if (sql.includes('COALESCE(SUM') && sql.includes('AS total')) return { rows: [{ total: '0' }] };
    return { rows: [] };
  } };
}
function response() { return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }

test('visibilité et confidentialité selon rôle, auteur et état', async () => {
  for (const role of ['MEMBRE', 'INCONNU', undefined, 'ADMIN', 'PASTEUR', 'BUREAU_ZANAKA_AMPIELEZANA']) {
    for (const person of ['owner', 'other']) {
      const manager = ['ADMIN', 'PASTEUR', 'BUREAU_ZANAKA_AMPIELEZANA'].includes(role);
      const data = await runWithDatabaseClient(fakeDb(), () => listContributions(id, auth(role, person)));
      assert.deepEqual(data.map(row => row.etat), manager || person === 'owner' ? ['VISIBLE', 'MASQUE', 'RETIRE'] : ['VISIBLE']);
      for (const row of data) assert.equal(Object.hasOwn(row, 'moderation_historique'), manager);
      if (manager) assert.deepEqual(data[0].moderation_historique[0], { action: 'MASQUER', raison: 'motif interne', date_action: '2026-02-01', personne_action: { id: 'moderateur', nom: 'Moderateur', prenom: undefined, nom_usage: undefined } });
      else assert.doesNotMatch(JSON.stringify(data), /motif interne|moderateur|2026-02-01/);
    }
  }
});

test('détail et GET contributions ne divulguent pas l’historique à l’auteur membre', async () => {
  const detail = await runWithDatabaseClient(fakeDb(), () => getSosoKevitraById(id, auth('MEMBRE')));
  assert.equal(detail.contributions.length, 3);
  assert.ok(detail.contributions.every(row => !Object.hasOwn(row, 'moderation_historique')));
  const res = response();
  await runWithDatabaseClient(fakeDb(), () => getContributions({ params: { id }, auth: auth('MEMBRE'), query: {} }, res));
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.data.every(row => !Object.hasOwn(row, 'moderation_historique')));
});

test('création simulée : réponse sans historique pour un membre auteur', async () => {
  const res = response();
  await runWithDatabaseClient(fakeDb(), () => addContribution({ params: { id }, auth: auth('MEMBRE'), query: {}, body: { categorie: 'IDEA', titre: 'Titre', description: 'Description' } }, res));
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.etat, 'VISIBLE');
  assert.equal(Object.hasOwn(res.body.data, 'moderation_historique'), false);
});
