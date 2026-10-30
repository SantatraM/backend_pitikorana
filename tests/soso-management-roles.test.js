import test from 'node:test';
import assert from 'node:assert/strict';
import { runWithDatabaseClient } from '../src/config/db.js';
import { demanderCorrectionSosoKevitra, nonPublierSosoKevitra, publierSosoKevitra, getSosoKevitraAVerifier } from '../src/services/sosoKevitra.service.js';

const auth = role => ({ personne: { id: 'acteur' }, compte: { role } });
const operations = [
  [demanderCorrectionSosoKevitra, { raison: 'Motif' }],
  [nonPublierSosoKevitra, { raison: 'Motif' }],
  [publierSosoKevitra, { date_fin_consultation: '2099-01-01T00:00:00Z' }],
];
function fakeDb(status = 'EN_ATTENTE_VERIFICATION') {
  return { async query(sql, params = []) {
    if (sql.includes('SELECT s.*, statut.code AS statut_code')) return { rows: [{ id: 'suggestion', id_auteur: 'auteur', statut_code: status, id_statut_soso_kevitra: 'statut' }] };
    if (sql.includes('SELECT id FROM statut_soso_kevitra WHERE code = $1')) return { rows: [{ id: params[0] }] };
    if (sql.includes('UPDATE soso_kevitra')) { status = params[0]; return { rows: [] }; }
    if (sql.includes('AS nombre_soutiens')) return { rows: [{ nombre_soutiens: 0, utilisateur_soutient: false }] };
    if (sql.includes('COALESCE(SUM') && sql.includes('AS total')) return { rows: [{ total: '0' }] };
    return { rows: [] };
  } };
}
test('ADMIN et PASTEUR peuvent gérer ; BUREAU et MEMBRE restent exclus', async () => {
  for (const role of ['ADMIN', 'PASTEUR', 'BUREAU_ZANAKA_AMPIELEZANA', 'MEMBRE']) {
    const authorized = role === 'ADMIN' || role === 'PASTEUR';
    for (const [operation, body] of operations) {
      const work = () => runWithDatabaseClient(fakeDb(), () => operation('suggestion', body, auth(role)));
      if (authorized) assert.ok(await work(), `${role} ${operation.name}`);
      else await assert.rejects(work, { code: 'SOSO_KEVITRA_ADMIN_FORBIDDEN' });
    }
    const list = () => runWithDatabaseClient(fakeDb(), () => getSosoKevitraAVerifier(auth(role)));
    if (authorized) assert.deepEqual(await list(), []);
    else await assert.rejects(list, { code: 'SOSO_KEVITRA_ADMIN_FORBIDDEN' });
  }
});
test('transitions interdites restent interdites pour les deux rôles autorisés', async () => {
  for (const role of ['ADMIN', 'PASTEUR']) for (const [operation, body] of operations) {
    await assert.rejects(() => runWithDatabaseClient(fakeDb('BROUILLON'), () => operation('suggestion', body, auth(role))), { code: 'WORKFLOW_TRANSITION_INVALID' });
  }
});
