import test from 'node:test';
import assert from 'node:assert/strict';
import { runWithDatabaseClient } from '../src/config/db.js';
import { getBrouillon, getContributions } from '../src/controllers/sosoKevitra.controller.js';
import { requireAuth } from '../src/middlewares/auth.middleware.js';

const id = '11111111-1111-4111-8111-111111111111';
const statuses = ['BROUILLON', 'EN_ATTENTE_VERIFICATION', 'A_CORRIGER', 'NON_PUBLIE', 'EN_CONSULTATION', 'A_L_ETUDE', 'ACCEPTE', 'REFUSE', 'INCONNU'];
const roles = ['ADMIN', 'PASTEUR', 'BUREAU_ZANAKA_AMPIELEZANA', 'MEMBRE', 'INCONNU'];
const auth = (role, author) => ({ personne: { id: author ? 'author' : 'other' }, compte: { role } });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
function fakeDb(status, exists = true) {
  return { async query(sql) {
    if (sql.includes('SELECT s.*, statut.code AS statut_code')) return { rows: exists ? [{ id, id_auteur: 'author', statut_code: status, id_statut_soso_kevitra: 'statut' }] : [] };
    if (sql.includes('AS nombre_soutiens')) return { rows: [{ nombre_soutiens: 0, utilisateur_soutient: false }] };
    if (sql.includes('COALESCE(SUM') && sql.includes('AS total')) return { rows: [{ total: '0' }] };
    return { rows: [] };
  } };
}
function allowed(status, role, author) {
  if (status === 'BROUILLON') return author;
  if (['EN_ATTENTE_VERIFICATION', 'A_CORRIGER', 'NON_PUBLIE'].includes(status)) return author || role === 'ADMIN' || role === 'PASTEUR';
  return ['EN_CONSULTATION', 'A_L_ETUDE', 'ACCEPTE', 'REFUSE'].includes(status);
}
test('détail et contributions appliquent les mêmes droits pour tous les statuts et rôles', async () => {
  for (const status of statuses) for (const role of roles) for (const author of [true, false]) {
    const request = { params: { id }, query: {}, auth: auth(role, author) };
    for (const handler of [getBrouillon, getContributions]) {
      const res = response();
      await runWithDatabaseClient(fakeDb(status), () => handler(request, res));
      assert.equal(res.statusCode, allowed(status, role, author) ? 200 : 404, `${status} ${role} auteur=${author}`);
      if (handler === getContributions && res.statusCode === 200) assert.deepEqual(res.body.data, []);
    }
  }
});
test('UUID invalide, suggestion absente et authentification obligatoire', async () => {
  for (const handler of [getBrouillon, getContributions]) {
    const invalid = response();
    await handler({ params: { id: 'invalide' }, query: {}, auth: auth('MEMBRE', false) }, invalid);
    assert.equal(invalid.statusCode, 400);
    const missing = response();
    await runWithDatabaseClient(fakeDb('ACCEPTE', false), () => handler({ params: { id }, query: {}, auth: auth('MEMBRE', false) }, missing));
    assert.equal(missing.statusCode, 404);
    const noAuth = response();
    await handler({ params: { id }, query: {} }, noAuth);
    assert.equal(noAuth.statusCode, 401);
  }
  const res = response();
  await requireAuth({ headers: {} }, res, () => assert.fail('requête non authentifiée acceptée'));
  assert.equal(res.statusCode, 401);
});
